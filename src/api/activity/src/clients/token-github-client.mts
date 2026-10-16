import { GitHubError } from '../errors/index.mjs';
import { fail, ok } from '../types/index.mjs';
import type { GitHubClient, RestResponse } from '../interfaces/index.mjs';
import type { Result } from '../types/index.mjs';

/**
 * Local-only client that uses a plain token (for example `gh auth token`).
 * Production always uses GitHubAppClient; this exists so the UI can be developed
 * against real data before the App is registered.
 */
export class TokenGitHubClient implements GitHubClient {

  private readonly token: string;

  public constructor(token: string) {
    this.token = token;
  }

  public async graphql<T>(query: string, variables: Record<string, unknown>): Promise<Result<T>> {
    const res: Response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
    });
    const body: { data?: T; errors?: { message: string }[] } = (await res.json()) as {
      data?: T;
      errors?: { message: string }[];
    };
    if (!res.ok || body.errors?.length || !body.data) {
      return fail(new GitHubError(res.status, body.errors?.[0]?.message ?? `GraphQL HTTP ${res.status}`));
    }
    return ok(body.data);
  }

  public async rest<T>(path: string): Promise<Result<RestResponse<T>>> {
    const res: Response = await fetch(`https://api.github.com${path}`, { headers: this.headers() });
    const rateRemaining: number | null = res.headers.has('x-ratelimit-remaining') ? Number(res.headers.get('x-ratelimit-remaining')) : null;
    if (res.status === 202 || res.status === 204) return ok({ status: res.status, data: null, rateRemaining });
    if (!res.ok) return fail(new GitHubError(res.status, `GET ${path} -> HTTP ${res.status}`));
    return ok({ status: res.status, data: (await res.json()) as T, rateRemaining });
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'dsylvester-activity-local',
    };
  }
}
