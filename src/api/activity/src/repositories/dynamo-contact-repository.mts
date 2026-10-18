import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, UpdateCommandOutput } from '@aws-sdk/lib-dynamodb';
import { RepositoryError } from '../errors/index.mjs';
import { fail, ok } from '../types/index.mjs';
import type { ContactMessage, ContactRepository } from '../interfaces/index.mjs';
import type { Result } from '../types/index.mjs';

/** Contact requests are kept a year; rate-limit counters only outlive their window by a day. */
const MESSAGE_TTL_SECONDS: number = 365 * 24 * 60 * 60;
const COUNTER_GRACE_SECONDS: number = 24 * 60 * 60;

/** Fixed-window bucket, so all requests in the same hour share one counter item. */
export const windowStart = (now: Date, windowSeconds: number): number =>
  Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds;

/**
 * Shares the activity table:
 *  pk=CONTACT       sk=<iso>#<id>         -> one contact request (audit copy)
 *  pk=CONTACT_RATE  sk=<key>#<windowStart> -> request counter, expired by TTL
 */
export class DynamoContactRepository implements ContactRepository {

  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(doc: DynamoDBDocumentClient, tableName: string) {
    this.doc = doc;
    this.tableName = tableName;
  }

  public async recordHit(key: string, windowSeconds: number, now: Date): Promise<Result<number>> {
    const start: number = windowStart(now, windowSeconds);
    try {
      const out: UpdateCommandOutput = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: 'CONTACT_RATE', sk: `${key}#${start}` },
          UpdateExpression: 'ADD hits :one SET expiresAt = if_not_exists(expiresAt, :exp)',
          ExpressionAttributeValues: { ':one': 1, ':exp': start + windowSeconds + COUNTER_GRACE_SECONDS },
          ReturnValues: 'UPDATED_NEW',
        }),
      );
      const hits: unknown = out.Attributes?.['hits'];
      return ok(typeof hits === 'number' ? hits : 1);
    } catch (error: unknown) {
      return fail(new RepositoryError('recordHit failed', { cause: error }));
    }
  }

  public async save(message: ContactMessage): Promise<Result<void>> {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: 'CONTACT',
            sk: `${message.receivedAt}#${message.id}`,
            data: JSON.stringify(message),
            expiresAt: Math.floor(Date.parse(message.receivedAt) / 1000) + MESSAGE_TTL_SECONDS,
          },
        }),
      );
      return ok(undefined);
    } catch (error: unknown) {
      return fail(new RepositoryError('save contact failed', { cause: error }));
    }
  }
}
