import type { Result } from '../types/index.mjs';
import type { RestResponse } from './i-rest-response.mjs';

/** GitHub API access authenticated as the App installation. */
export interface GitHubClient {
  graphql<T>(query: string, variables: Record<string, unknown>): Promise<Result<T>>;
  rest<T>(path: string): Promise<Result<RestResponse<T>>>;
}
