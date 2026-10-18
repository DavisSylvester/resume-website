import type { ContactSecrets, Result } from '../types/index.mjs';

/** Resolves the per-channel credentials (Resend, AWS SMS/WhatsApp, Telegram, Slack, Teams). */
export interface ContactSecretsProvider {
  get(): Promise<Result<ContactSecrets>>;
}
