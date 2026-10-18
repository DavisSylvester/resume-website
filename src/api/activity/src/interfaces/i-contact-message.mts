import type { ContactReason, ReplyChannel } from '../types/index.mjs';

/** A validated contact request, as delivered to every notifier and stored for the record. */
export interface ContactMessage {
  id: string;
  receivedAt: string;
  name: string;
  reason: ContactReason;
  replyVia: ReplyChannel;
  replyTo: string;
  company: string | null;
  message: string;
  sourceIp: string;
}
