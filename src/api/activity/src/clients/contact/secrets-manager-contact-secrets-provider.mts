import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { cleanSecrets } from './clean-secrets.mjs';
import { fail, ok } from '../../types/index.mjs';
import type { ContactSecretsProvider } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

const CACHE_MS: number = 15 * 60 * 1000;

/** Reads the contact secret once and caches it for the warm Lambda container. */
export class SecretsManagerContactSecretsProvider implements ContactSecretsProvider {

  private readonly client: SecretsManagerClient;
  private readonly secretArn: string;
  private cached: { value: ContactSecrets; at: number } | null = null;

  public constructor(client: SecretsManagerClient, secretArn: string) {
    this.client = client;
    this.secretArn = secretArn;
  }

  public async get(): Promise<Result<ContactSecrets>> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return ok(this.cached.value);
    try {
      const out: GetSecretValueCommandOutput = await this.client.send(
        new GetSecretValueCommand({ SecretId: this.secretArn }),
      );
      const parsed: unknown = JSON.parse(out.SecretString ?? '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return fail(new Error('Contact secret is not a JSON object'));
      }
      const value: ContactSecrets = cleanSecrets(parsed as Record<string, unknown>);
      this.cached = { value, at: Date.now() };
      return ok(value);
    } catch (error: unknown) {
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
