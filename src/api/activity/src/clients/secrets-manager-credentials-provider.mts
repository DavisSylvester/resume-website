import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Value } from '@sinclair/typebox/value';
import { AppCredentialsSchema } from '../schemas/index.mjs';
import { fail, ok } from '../types/index.mjs';
import type { CredentialsProvider } from '../interfaces/index.mjs';
import type { AppCredentials, Result } from '../types/index.mjs';

const CACHE_MS: number = 15 * 60 * 1000;

/** Reads the App credentials secret once and caches it for the warm Lambda container. */
export class SecretsManagerCredentialsProvider implements CredentialsProvider {

  private readonly client: SecretsManagerClient;
  private readonly secretArn: string;
  private cached: { value: AppCredentials; at: number } | null = null;

  public constructor(client: SecretsManagerClient, secretArn: string) {
    this.client = client;
    this.secretArn = secretArn;
  }

  public async get(): Promise<Result<AppCredentials>> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) {
      return ok(this.cached.value);
    }
    try {
      const out: GetSecretValueCommandOutput = await this.client.send(
        new GetSecretValueCommand({ SecretId: this.secretArn }),
      );
      const parsed: unknown = JSON.parse(out.SecretString ?? '{}');
      if (!Value.Check(AppCredentialsSchema, parsed)) {
        return fail(new Error('GitHub App secret is missing appId, installationId, privateKey or webhookSecret'));
      }
      this.cached = { value: parsed, at: Date.now() };
      return ok(parsed);
    } catch (error: unknown) {
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
