import type { NotifyChannel } from '../types/index.mjs';

/** What `POST /contact` returns on success. */
export interface ContactReceipt {
  id: string;
  delivered: NotifyChannel[];
}
