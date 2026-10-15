import { Value } from '@sinclair/typebox/value';
import { AppCredentialsSchema } from '../schemas/index.mjs';
import { fail, ok } from '../types/index.mjs';
import type { CredentialsProvider } from '../interfaces/index.mjs';
import type { AppCredentials, Env, Result } from '../types/index.mjs';

/** Local development: credentials from the GITHUB_APP_* environment variables. */
export class EnvCredentialsProvider implements CredentialsProvider {

  private readonly env: Env;

  public constructor(env: Env) {
    this.env = env;
  }

  public async get(): Promise<Result<AppCredentials>> {
    const candidate: Record<string, string | undefined> = {
      appId: this.env.GITHUB_APP_ID,
      installationId: this.env.GITHUB_APP_INSTALLATION_ID,
      // .env files usually store the PEM on one line with literal "\n" sequences.
      privateKey: this.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      webhookSecret: this.env.GITHUB_WEBHOOK_SECRET,
    };
    if (!Value.Check(AppCredentialsSchema, candidate)) {
      return fail(
        new Error(
          'Set GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET',
        ),
      );
    }
    return ok(candidate);
  }
}
