import { BatchWriteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type {
  BatchWriteCommandOutput,
  DynamoDBDocumentClient,
  GetCommandOutput,
  QueryCommandInput,
  QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { Value } from '@sinclair/typebox/value';
import type { TSchema, Static } from '@sinclair/typebox';
import { RepositoryError } from '../errors/index.mjs';
import { InsightsMetaSchema, LedgerCommitSchema, PendingCommitSchema, RepoRunsSchema, RepoScanSchema } from '../schemas/index.mjs';
import { fail, ok } from '../types/index.mjs';
import type { InsightsRepository } from '../interfaces/index.mjs';
import type { InsightsMeta, LedgerCommit, PendingCommit, RepoRuns, RepoScan, Result } from '../types/index.mjs';

const PK = { Commit: 'COMMIT', Repo: 'REPO', Pending: 'PENDING', Runs: 'RUNS', Meta: 'META' } as const;
const BATCH: number = 25;

type Item = Record<string, unknown>;

/**
 * Same single table as the snapshot:
 *  COMMIT  <date>#<sha>   classified commit (TTL)
 *  REPO    <owner/name>   cached default-branch scan
 *  PENDING <sha>          pushed commit waiting for classification
 *  RUNS    <owner/name>   weekly workflow-run counts
 *  META    insights       PRs, career years, fetch timestamps
 * Every item is parsed with TypeBox on read.
 */
export class DynamoInsightsRepository implements InsightsRepository {

  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(doc: DynamoDBDocumentClient, tableName: string) {
    this.doc = doc;
    this.tableName = tableName;
  }

  public listLedger(fromIso: string): Promise<Result<LedgerCommit[]>> {
    return this.query(LedgerCommitSchema, {
      KeyConditionExpression: 'pk = :pk AND sk >= :from',
      ExpressionAttributeValues: { ':pk': PK.Commit, ':from': fromIso },
    });
  }

  public putLedger(commits: LedgerCommit[], ttlDays: number): Promise<Result<void>> {
    return this.batchPut(
      commits.map((c: LedgerCommit): Item => ({
        pk: PK.Commit,
        sk: `${c.date}#${c.sha}`,
        data: JSON.stringify(c),
        expiresAt: Math.floor(Date.parse(c.date) / 1000) + ttlDays * 86_400,
      })),
    );
  }

  public listScans(): Promise<Result<RepoScan[]>> {
    return this.query(RepoScanSchema, { KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': PK.Repo } });
  }

  public putScan(scan: RepoScan): Promise<Result<void>> {
    return this.put({ pk: PK.Repo, sk: scan.repo, data: JSON.stringify(scan) });
  }

  public listPending(limit: number): Promise<Result<PendingCommit[]>> {
    return this.query(PendingCommitSchema, { KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': PK.Pending }, Limit: limit });
  }

  public async countPending(): Promise<Result<number>> {
    try {
      let count: number = 0;
      let start: Record<string, unknown> | undefined;
      do {
        const out: QueryCommandOutput = await this.doc.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': PK.Pending },
            Select: 'COUNT',
            ExclusiveStartKey: start,
          }),
        );
        count += out.Count ?? 0;
        start = out.LastEvaluatedKey;
      } while (start);
      return ok(count);
    } catch (error: unknown) {
      return fail(new RepositoryError('countPending failed', { cause: error }));
    }
  }

  public putPending(items: PendingCommit[]): Promise<Result<void>> {
    return this.batchPut(
      items.map((p: PendingCommit): Item => ({
        pk: PK.Pending,
        sk: p.sha,
        data: JSON.stringify(p),
        expiresAt: Math.floor(Date.parse(p.queuedAt) / 1000) + 14 * 86_400,
      })),
    );
  }

  public async deletePending(shas: string[]): Promise<Result<void>> {
    return this.batch(shas.map((sha: string): Item => ({ DeleteRequest: { Key: { pk: PK.Pending, sk: sha } } })));
  }

  public listRuns(): Promise<Result<RepoRuns[]>> {
    return this.query(RepoRunsSchema, { KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': PK.Runs } });
  }

  public putRuns(runs: RepoRuns): Promise<Result<void>> {
    return this.put({ pk: PK.Runs, sk: runs.repo, data: JSON.stringify(runs) });
  }

  public async getMeta(): Promise<Result<InsightsMeta | null>> {
    try {
      const out: GetCommandOutput = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: PK.Meta, sk: 'insights' } }));
      const raw: unknown = out.Item?.['data'];
      if (typeof raw !== 'string') return ok(null);
      const parsed: unknown = JSON.parse(raw);
      return ok(Value.Check(InsightsMetaSchema, parsed) ? parsed : null);
    } catch (error: unknown) {
      return fail(new RepositoryError('getMeta failed', { cause: error }));
    }
  }

  public putMeta(meta: InsightsMeta): Promise<Result<void>> {
    return this.put({ pk: PK.Meta, sk: 'insights', data: JSON.stringify(meta) });
  }

  private async put(item: Item): Promise<Result<void>> {
    try {
      await this.doc.send(new PutCommand({ TableName: this.tableName, Item: item }));
      return ok(undefined);
    } catch (error: unknown) {
      return fail(new RepositoryError(`put ${String(item['pk'])} failed`, { cause: error }));
    }
  }

  private batchPut(items: Item[]): Promise<Result<void>> {
    return this.batch(items.map((Item: Item): Item => ({ PutRequest: { Item } })));
  }

  /** BatchWrite in chunks of 25, retrying unprocessed items with backoff. */
  private async batch(requests: Item[]): Promise<Result<void>> {
    try {
      for (let i: number = 0; i < requests.length; i += BATCH) {
        let chunk: Item[] = requests.slice(i, i + BATCH);
        for (let attempt: number = 0; chunk.length > 0 && attempt < 6; attempt += 1) {
          if (attempt > 0) await Bun.sleep(100 * 2 ** attempt);
          const out: BatchWriteCommandOutput = await this.doc.send(
            new BatchWriteCommand({ RequestItems: { [this.tableName]: chunk as never } }),
          );
          chunk = (out.UnprocessedItems?.[this.tableName] ?? []) as Item[];
        }
        if (chunk.length > 0) return fail(new RepositoryError(`${chunk.length} batch items left unprocessed`));
      }
      return ok(undefined);
    } catch (error: unknown) {
      return fail(new RepositoryError('batch write failed', { cause: error }));
    }
  }

  private async query<S extends TSchema>(schema: S, input: Omit<QueryCommandInput, 'TableName'>): Promise<Result<Static<S>[]>> {
    try {
      const out: Static<S>[] = [];
      let start: Record<string, unknown> | undefined;
      do {
        const page: QueryCommandOutput = await this.doc.send(
          new QueryCommand({ ...input, TableName: this.tableName, ExclusiveStartKey: start }),
        );
        for (const item of page.Items ?? []) {
          const raw: unknown = item['data'];
          const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : null;
          if (Value.Check(schema, parsed)) out.push(parsed);
        }
        start = input.Limit && out.length >= input.Limit ? undefined : page.LastEvaluatedKey;
      } while (start);
      return ok(out);
    } catch (error: unknown) {
      return fail(new RepositoryError('query failed', { cause: error }));
    }
  }
}
