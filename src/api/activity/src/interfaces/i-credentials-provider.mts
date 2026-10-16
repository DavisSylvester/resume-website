import type { AppCredentials, Result } from '../types/index.mjs';

/** Resolves the GitHub App id, installation id, private key and webhook secret. */
export interface CredentialsProvider {
  get(): Promise<Result<AppCredentials>>;
}
