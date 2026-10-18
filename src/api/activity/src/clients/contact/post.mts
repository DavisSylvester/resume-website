import { fail, ok, NotifyOutcome } from '../../types/index.mjs';
import type { FetchFn } from '../github-app-client.mjs';
import type { Result } from '../../types/index.mjs';

/** One outbound provider call. Non-2xx responses become a failed Result carrying a short body excerpt. */
export const send = async (fetchFn: FetchFn, url: string, init: RequestInit, label: string): Promise<Result<NotifyOutcome>> => {
  try {
    const res: Response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (res.ok) return ok(NotifyOutcome.Sent);
    const body: string = (await res.text()).slice(0, 300);
    return fail(new Error(`${label} responded ${res.status}: ${body}`));
  } catch (error: unknown) {
    return fail(new Error(`${label} request failed: ${error instanceof Error ? error.message : String(error)}`));
  }
};

export const jsonInit = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
