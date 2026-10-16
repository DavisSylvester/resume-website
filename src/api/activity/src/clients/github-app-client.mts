import { createPrivateKey } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { SignJWT } from 'jose';
import type { Logger } from 'winston';
import { GitHubError } from '../errors/index.mjs';
import { fail, ok } from '../types/index.mjs';
import type { CredentialsProvider, GitHubClient, RestResponse } from '../interfaces/index.mjs';
import type { AppCredentials, Result } from '../types/index.mjs';

const API: string = 'https://api.github.com';
const API_VERSION: string = '2022-11-28';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

interface InstallationToken {
  token: string;
  expiresAt: number;
}

interface GraphQLEnvelope<T> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Authenticates as the GitHub App: signs a short-lived RS256 JWT with the App private key,
 * exchanges it for an installation access token, and caches that token until five minutes
 * before it expires (installation tokens live one hour).
 */
export class GitHubAppClient implements GitHubClient {

  private readonly credentials: CredentialsProvider;
  private readonly logger: Logger;
  private readonly fetchFn: FetchFn;
  private token: InstallationToken | null = null;

  public constructor(credentials: CredentialsProvider, logger: Logger, fetchFn: FetchFn) {
    this.credentials = credentials;
    this.logger = logger;
    this.fetchFn = fetchFn;
  }

  public async graphql<T>(query: string, variables: Record<string, unknown>): Promise<Result<T>> {
    const auth: Result<string> = await this.installationToken();
    if (!auth.ok) return auth;
    const res: Response = await this.fetchFn(`${API}/graphql`, {
      method: 'POST',
      headers: this.headers(auth.value),
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return fail(new GitHubError(res.status, `GraphQL HTTP ${res.status}`));
    const body: GraphQLEnvelope<T> = (await res.json()) as GraphQLEnvelope<T>;
    if (body.errors?.length) {
      const message: string = body.errors.map((e: { message: string }): string => e.message).join('; ');
      return fail(new GitHubError(200, message));
    }
    if (!body.data) return fail(new GitHubError(200, 'GraphQL returned no data'));
    return ok(body.data);
  }

  public async rest<T>(path: string): Promise<Result<RestResponse<T>>> {
    const auth: Result<string> = await this.installationToken();
    if (!auth.ok) return auth;
    const res: Response = await this.fetchFn(`${API}${path}`, { headers: this.headers(auth.value) });
    // 202: GitHub is still computing statistics. 204: empty repository.
    const rateRemaining: number | null = res.headers.has('x-ratelimit-remaining') ? Number(res.headers.get('x-ratelimit-remaining')) : null;
    if (res.status === 202 || res.status === 204) return ok({ status: res.status, data: null, rateRemaining });
    if (!res.ok) return fail(new GitHubError(res.status, `GET ${path} -> HTTP ${res.status}`));
    return ok({ status: res.status, data: (await res.json()) as T, rateRemaining });
  }

  private headers(token: string): Record<string, string> {
    return {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': API_VERSION,
      'user-agent': 'dsylvester-activity-app',
    };
  }

  private async installationToken(): Promise<Result<string>> {
    if (this.token && this.token.expiresAt - Date.now() > 5 * 60 * 1000) {
      return ok(this.token.token);
    }
    const creds: Result<AppCredentials> = await this.credentials.get();
    if (!creds.ok) return creds;

    const jwt: string = await this.appJwt(creds.value);
    const res: Response = await this.fetchFn(
      `${API}/app/installations/${creds.value.installationId}/access_tokens`,
      { method: 'POST', headers: this.headers(jwt) },
    );
    if (!res.ok) {
      this.logger.error('installation token exchange failed', { status: res.status });
      return fail(new GitHubError(res.status, `installation token HTTP ${res.status}`));
    }
    const body: { token: string; expires_at: string } = (await res.json()) as {
      token: string;
      expires_at: string;
    };
    this.token = { token: body.token, expiresAt: Date.parse(body.expires_at) };
    return ok(body.token);
  }

  private async appJwt(creds: AppCredentials): Promise<string> {
    // createPrivateKey accepts both the PKCS#1 PEM GitHub issues and PKCS#8.
    const key: KeyObject = createPrivateKey(creds.privateKey);
    const now: number = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(creds.appId)
      .setIssuedAt(now - 60) // Backdated for clock drift, as GitHub recommends.
      .setExpirationTime(now + 9 * 60) // GitHub caps App JWTs at 10 minutes.
      .sign(key);
  }
}
