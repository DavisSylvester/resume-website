import type { ContactMessage } from './i-contact-message.mjs';
import type { Result } from '../types/index.mjs';

/** Rate-limit counters and an audit copy of every request, so nothing is lost if delivery fails. */
export interface ContactRepository {
  /** Counts one request from `key` in the current window and returns the window's total. */
  recordHit(key: string, windowSeconds: number, now: Date): Promise<Result<number>>;
  save(message: ContactMessage): Promise<Result<void>>;
}
