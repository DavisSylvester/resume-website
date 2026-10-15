import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { GitHubAppClient } from '../src/clients/github-app-client.mjs';
import { ok } from '../src/types/index.mjs';
import type { CredentialsProvider } from '../src/interfaces/index.mjs';
import { silentLogger } from './helpers.mjs';

// GitHub issues PKCS#1 ("BEGIN RSA PRIVATE KEY") PEMs, so test with that format.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const credentials: CredentialsProvider = {
  get: async () => ok({ appId: '12345', installationId: '678', privateKey, webhookSecret: 'x'.repeat(20) }),
};

interface Call {
  url: string;
  auth: string;
}

interface FakeGitHub {
  calls: Call[];
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>;
}

const fakeGitHub = (): FakeGitHub => {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    const auth: string = new Headers(init?.headers).get('authorization') ?? '';
    calls.push({ url, auth });
    if (url.endsWith('/access_tokens')) {
      return Response.json({ token: 'ghs_install', expires_at: new Date(Date.now() + 3600_000).toISOString() });
    }
    if (url.endsWith('/graphql')) return Response.json({ data: { viewer: { login: 'app' } } });
    if (url.includes('/stats/')) return new Response(null, { status: 202 });
    return Response.json([{ ok: true }]);
  };
  return { calls, fetchFn };
};

describe('GitHubAppClient', () => {
  test('signs an RS256 App JWT and exchanges it for an installation token', async () => {
    const { calls, fetchFn } = fakeGitHub();
    const client = new GitHubAppClient(credentials, silentLogger(), fetchFn);
    const res = await client.graphql<{ viewer: { login: string } }>('query{viewer{login}}', {});
    expect(res).toEqual({ ok: true, value: { viewer: { login: 'app' } } });

    const exchange: Call | undefined = calls[0];
    expect(exchange?.url).toBe('https://api.github.com/app/installations/678/access_tokens');
    const jwt: string = exchange?.auth.replace('Bearer ', '') ?? '';
    expect(decodeProtectedHeader(jwt).alg).toBe('RS256');
    const claims = decodeJwt(jwt);
    expect(claims.iss).toBe('12345');
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBeLessThanOrEqual(600);
    expect(calls[1]?.auth).toBe('Bearer ghs_install');
  });

  test('caches the installation token across calls', async () => {
    const { calls, fetchFn } = fakeGitHub();
    const client = new GitHubAppClient(credentials, silentLogger(), fetchFn);
    await client.rest('/repos/a/b/commits');
    await client.rest('/repos/a/b/commits');
    expect(calls.filter((c: Call): boolean => c.url.endsWith('/access_tokens'))).toHaveLength(1);
  });

  test('a 202 from a stats endpoint is a success with no data', async () => {
    const { fetchFn } = fakeGitHub();
    const client = new GitHubAppClient(credentials, silentLogger(), fetchFn);
    expect(await client.rest('/repos/a/b/stats/contributors')).toEqual({ ok: true, value: { status: 202, data: null } });
  });

  test('GraphQL errors become a failed Result', async () => {
    const client = new GitHubAppClient(credentials, silentLogger(), async (url: string): Promise<Response> =>
      url.endsWith('/access_tokens')
        ? Response.json({ token: 't', expires_at: new Date(Date.now() + 3600_000).toISOString() })
        : Response.json({ errors: [{ message: 'Could not resolve to a User' }] }),
    );
    const res = await client.graphql('q', {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('Could not resolve');
  });
});
