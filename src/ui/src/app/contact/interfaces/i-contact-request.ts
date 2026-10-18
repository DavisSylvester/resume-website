import type { ContactReason, ReplyChannel } from '../contact-options';

/** Body of `POST /contact` on the activity API. */
export interface ContactRequest {
  name: string;
  company?: string;
  reason: ContactReason;
  replyVia: ReplyChannel;
  replyTo: string;
  message: string;
  /** Honeypot; always empty for people. */
  website?: string;
}
