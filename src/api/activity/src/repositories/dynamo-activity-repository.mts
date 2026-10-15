import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, GetCommandOutput, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import { Value } from '@sinclair/typebox/value';
import type { Logger } from 'winston';
import { RepositoryError } from '../errors/index.mjs';
import { ActivitySnapshotSchema, LiveEventSchema } from '../schemas/index.mjs';
import { fail, ok } from '../types/index.mjs';
import type { ActivityRepository } from '../interfaces/index.mjs';
import type { ActivitySnapshot, LiveEvent, Result } from '../types/index.mjs';

const SNAPSHOT_PK: string = 'SNAPSHOT';
const SNAPSHOT_SK: string = 'latest';
const LIVE_PK: string = 'LIVE';

/** Sort key for live events. It doubles as the polling cursor handed to the browser. */
export const liveCursor = (event: Pick<LiveEvent, 'receivedAt' | 'id'>): string =>
  `${event.receivedAt}#${event.id}`;

/**
 * Single-table layout:
 *  pk=SNAPSHOT sk=latest            -> the aggregated snapshot (JSON string)
 *  pk=LIVE     sk=<iso>#<delivery>  -> one webhook push, expired by DynamoDB TTL
 * Everything read back is parsed with TypeBox before it is trusted.
 */
export class DynamoActivityRepository implements ActivityRepository {

  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly logger: Logger;

  public constructor(doc: DynamoDBDocumentClient, tableName: string, logger: Logger) {
    this.doc = doc;
    this.tableName = tableName;
    this.logger = logger;
  }

  public async getSnapshot(): Promise<Result<ActivitySnapshot | null>> {
    try {
      const out: GetCommandOutput = await this.doc.send(
        new GetCommand({ TableName: this.tableName, Key: { pk: SNAPSHOT_PK, sk: SNAPSHOT_SK } }),
      );
      const raw: unknown = out.Item?.['data'];
      if (typeof raw !== 'string') return ok(null);
      const parsed: unknown = JSON.parse(raw);
      if (!Value.Check(ActivitySnapshotSchema, parsed)) {
        this.logger.warn('stored snapshot failed schema validation; treating as missing');
        return ok(null);
      }
      return ok(parsed);
    } catch (error: unknown) {
      return fail(new RepositoryError('getSnapshot failed', { cause: error }));
    }
  }

  public async putSnapshot(snapshot: ActivitySnapshot): Promise<Result<void>> {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: SNAPSHOT_PK, sk: SNAPSHOT_SK, data: JSON.stringify(snapshot), generatedAt: snapshot.generatedAt },
        }),
      );
      return ok(undefined);
    } catch (error: unknown) {
      return fail(new RepositoryError('putSnapshot failed', { cause: error }));
    }
  }

  public async putLiveEvent(event: LiveEvent, ttlDays: number): Promise<Result<void>> {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: LIVE_PK,
            sk: liveCursor(event),
            data: JSON.stringify(event),
            expiresAt: Math.floor(Date.parse(event.receivedAt) / 1000) + ttlDays * 86400,
          },
          // GitHub redelivers on timeout; the delivery id makes the write idempotent.
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return ok(undefined);
      return fail(new RepositoryError('putLiveEvent failed', { cause: error }));
    }
  }

  public async listLiveEvents(since: string | null, limit: number): Promise<Result<LiveEvent[]>> {
    try {
      const out: QueryCommandOutput = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: since ? 'pk = :pk AND sk > :since' : 'pk = :pk',
          ExpressionAttributeValues: since ? { ':pk': LIVE_PK, ':since': since } : { ':pk': LIVE_PK },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );
      const events: LiveEvent[] = [];
      for (const item of out.Items ?? []) {
        const raw: unknown = item['data'];
        const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : null;
        if (Value.Check(LiveEventSchema, parsed)) events.push(parsed);
      }
      return ok(events);
    } catch (error: unknown) {
      return fail(new RepositoryError('listLiveEvents failed', { cause: error }));
    }
  }
}
