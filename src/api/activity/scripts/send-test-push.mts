/**
 * Sends a correctly signed fake `push` webhook to a running API, to exercise the live feed.
 *
 *   bun scripts/send-test-push.mts [http://localhost:3100] [private]
 */
import { createHmac } from 'node:crypto';

const target: string = process.argv[2] ?? 'http://localhost:3100';
const isPrivate: boolean = process.argv[3] === 'private';
const secret: string = process.env['GITHUB_WEBHOOK_SECRET'] ?? 'devsecret-devsecret';

const body: string = JSON.stringify({
  ref: 'refs/heads/main',
  repository: {
    full_name: isPrivate ? 'DavisSylvester/secret-project' : 'DavisSylvester/resume-website',
    private: isPrivate,
    html_url: 'https://github.com/DavisSylvester/resume-website',
    language: 'TypeScript',
  },
  commits: [
    { id: crypto.randomUUID(), message: 'feat: add live commit activity page\n\nbody', distinct: true },
    { id: crypto.randomUUID(), message: 'test: cover webhook signature checks', distinct: true },
  ],
  sender: { login: process.env['GITHUB_LOGIN'] ?? 'DavisSylvester' },
});
const signature: string = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const res: Response = await fetch(`${target}/webhooks/github`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-github-event': 'push',
    'x-github-delivery': crypto.randomUUID(),
    'x-hub-signature-256': signature,
  },
  body,
});
console.log(res.status, await res.text());
