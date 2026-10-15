/**
 * Registers the GitHub App with GitHub's manifest flow, then waits for you to install it.
 *
 *   bun scripts/register-github-app.mts --webhook-url https://<api>/webhooks/github
 *
 * 1. Opens a local page that POSTs the manifest below to github.com. You click "Create".
 * 2. GitHub redirects back with a one-time code, exchanged for the App id, private key
 *    and webhook secret.
 * 3. You install the App on your account ("All repositories"). The script polls until
 *    the installation exists and records its id.
 * 4. Credentials are written to .github-app.local.json (gitignored), and the exact
 *    `aws secretsmanager put-secret-value` command is printed.
 */
import { createPrivateKey } from 'node:crypto';
import { SignJWT } from 'jose';

const args: string[] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i: number = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const webhookUrl: string | undefined = flag('--webhook-url');
const appName: string = flag('--name') ?? 'dsylvester-activity';
const port: number = Number(flag('--port') ?? 3199);
if (!webhookUrl?.startsWith('https://')) {
  console.error('Pass --webhook-url https://<api>/webhooks/github (the GitHubWebhookUrl stack output).');
  process.exit(1);
}

/** Least privilege: read repository contents and metadata, receive push events. Private to this account. */
const manifest: Record<string, unknown> = {
  name: appName,
  url: 'https://www.dsylvester.io/activity',
  description: 'Feeds live commit activity to the /activity page on dsylvester.io.',
  public: false,
  hook_attributes: { url: webhookUrl, active: true },
  redirect_url: `http://localhost:${port}/callback`,
  default_permissions: { contents: 'read', metadata: 'read' },
  default_events: ['push'],
};

interface Conversion {
  id: number;
  slug: string;
  html_url: string;
  pem: string;
  webhook_secret: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const conversion: Conversion = await new Promise<Conversion>((resolve: (c: Conversion) => void): void => {
  const server = Bun.serve({
    port,
    async fetch(req: Request): Promise<Response> {
      const url: URL = new URL(req.url);
      if (url.pathname === '/') {
        const html: string = `<!doctype html><meta charset="utf-8"><title>Register GitHub App</title>
<body style="font-family:system-ui;max-width:40rem;margin:4rem auto">
<h1>Register ${escapeHtml(appName)}</h1><p>Webhook: ${escapeHtml(webhookUrl)}</p>
<form action="https://github.com/settings/apps/new" method="post">
<input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(manifest))}">
<button style="font-size:1.1rem;padding:.6rem 1.2rem">Create the App on GitHub</button></form></body>`;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
      }
      if (url.pathname === '/callback') {
        const code: string | null = url.searchParams.get('code');
        if (!code) return new Response('Missing code', { status: 400 });
        const res: Response = await fetch(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, {
          method: 'POST',
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsylvester-activity-setup' },
        });
        if (!res.ok) return new Response(`Conversion failed: HTTP ${res.status}`, { status: 502 });
        const body: Conversion = (await res.json()) as Conversion;
        setTimeout((): void => {
          server.stop();
          resolve(body);
        }, 100);
        return new Response(
          `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;max-width:40rem;margin:4rem auto">
<h1>App created</h1><p>Now install it on your account with <b>All repositories</b>:</p>
<p><a style="font-size:1.1rem" href="https://github.com/apps/${escapeHtml(body.slug)}/installations/new">Install ${escapeHtml(body.slug)}</a></p>
<p>Return to the terminal when done.</p></body>`,
          { headers: { 'content-type': 'text/html' } },
        );
      }
      return new Response('Not found', { status: 404 });
    },
  });
  console.log(`Open http://localhost:${port}/ in your browser and click "Create the App on GitHub".`);
});

console.log(`Created App ${conversion.slug} (id ${conversion.id}).`);
console.log(`Install it: https://github.com/apps/${conversion.slug}/installations/new`);

const appJwt = async (): Promise<string> => {
  const now: number = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(String(conversion.id))
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 540)
    .sign(createPrivateKey(conversion.pem));
};

let installationId: number | null = null;
for (let attempt: number = 0; attempt < 120 && installationId === null; attempt += 1) {
  const res: Response = await fetch('https://api.github.com/app/installations', {
    headers: {
      authorization: `Bearer ${await appJwt()}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'dsylvester-activity-setup',
    },
  });
  const list: { id: number; account: { login: string } }[] = res.ok
    ? ((await res.json()) as { id: number; account: { login: string } }[])
    : [];
  if (list[0]) {
    installationId = list[0].id;
    console.log(`Installed on ${list[0].account.login} (installation ${installationId}).`);
  } else {
    if (attempt === 0) console.log('Waiting for the installation (checking every 5 s, up to 10 min)…');
    await Bun.sleep(5000);
  }
}

const secret: Record<string, string> = {
  appId: String(conversion.id),
  installationId: installationId === null ? '' : String(installationId),
  privateKey: conversion.pem,
  webhookSecret: conversion.webhook_secret,
};
await Bun.write('.github-app.local.json', JSON.stringify(secret, null, 2));
console.log('\nWrote .github-app.local.json (gitignored; contains the private key).');
if (installationId === null) console.log('No installation found yet: install the App, then fill installationId in that file.');
console.log('Store it in the stack secret (GitHubAppSecretArn output):\n');
console.log('  aws secretsmanager put-secret-value --secret-id <GitHubAppSecretArn> --secret-string file://.github-app.local.json --profile <profile>\n');
