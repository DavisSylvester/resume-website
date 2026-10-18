import { windowStart } from './dynamo-contact-repository.mjs';
import { ok } from '../types/index.mjs';
import type { ContactMessage, ContactRepository } from '../interfaces/index.mjs';
import type { Result } from '../types/index.mjs';

/** Used by unit tests and the local dev server. Same contract as the DynamoDB repository. */
export class InMemoryContactRepository implements ContactRepository {

  public readonly saved: ContactMessage[] = [];
  private readonly hits: Map<string, number> = new Map();

  public async recordHit(key: string, windowSeconds: number, now: Date): Promise<Result<number>> {
    const bucket: string = `${key}#${windowStart(now, windowSeconds)}`;
    const count: number = (this.hits.get(bucket) ?? 0) + 1;
    this.hits.set(bucket, count);
    return ok(count);
  }

  public async save(message: ContactMessage): Promise<Result<void>> {
    this.saved.push(message);
    return ok(undefined);
  }
}
