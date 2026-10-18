import type { ContactSecrets, Result } from '../types/index.mjs';

/** Resolves the per-channel credentials (AWS SMS/WhatsApp settings, Telegram, Slack, Teams). */
export interface ContactSecretsProvider {
  get(): Promise<Result<ContactSecrets>>;
}
