import type { ContactMessage } from './i-contact-message.mjs';
import type { NotifyChannel, NotifyOutcome, Result } from '../types/index.mjs';

/** Delivers a contact request to Davis on one channel. Resolves `skipped` when unconfigured. */
export interface Notifier {
  channel: NotifyChannel;
  send(message: ContactMessage): Promise<Result<NotifyOutcome>>;
}
