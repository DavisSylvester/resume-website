/**
 * Local dev server: the real router and services over an in-memory store seeded from
 * the UI sample snapshot. Send signed test webhooks with scripts/send-test-push.mts.
 *
 *   GITHUB_WEBHOOK_SECRET=devsecret-devsecret bun dev.mts
 */
import { Value } from '@sinclair/typebox/value';
import { createContainer } from './src/container.mjs';
import { loadEnv } from './src/config/load-config.mjs';
import { InMemoryActivityRepository } from './src/repositories/in-memory-activity-repository.mjs';
import { InMemoryContactRepository } from './src/repositories/in-memory-contact-repository.mjs';
import { createActivityRouter } from './src/routes/activity-router.mjs';
import { ActivitySnapshotSchema } from './src/schemas/index.mjs';
import { ok } from './src/types/index.mjs';
import type { Container, ContributionCollector } from './src/interfaces/index.mjs';
import type { ActivitySnapshot, Result } from './src/types/index.mjs';

const seedPath: string = new URL('../../ui/public/data/activity-sample.json', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const seedFile: Bun.BunFile = Bun.file(seedPath);
const seedRaw: unknown = (await seedFile.exists()) ? await seedFile.json() : null;
const seed: ActivitySnapshot | null = Value.Check(ActivitySnapshotSchema, seedRaw) ? seedRaw : null;

// Locally there is no App installation, so "refresh" just re-stamps the seed.
const devCollector: ContributionCollector = {
  collect: async (_depth: unknown, previous: ActivitySnapshot | null): Promise<Result<ActivitySnapshot>> =>
    ok({ ...(previous ?? (seed as ActivitySnapshot)), generatedAt: new Date().toISOString() }),
};

const secret: string = process.env['GITHUB_WEBHOOK_SECRET'] ?? 'devsecret-devsecret';
const container: Container = createContainer(
  loadEnv({ ...process.env, GITHUB_LOGIN: process.env['GITHUB_LOGIN'] ?? 'DavisSylvester', TABLE_NAME: 'local' }),
  {
    repository: new InMemoryActivityRepository(seed),
    // Contact channels read CONTACT_EMAIL_FROM, CONTACT_SMS_*/CONTACT_WHATSAPP_* (all three use your AWS creds), TELEGRAM_*, SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL.
    contactRepository: new InMemoryContactRepository(),
    collector: devCollector,
    credentials: {
      get: async () => ok({ appId: 'local', installationId: 'local', privateKey: 'unused', webhookSecret: secret }),
    },
  },
);

const port: number = Number(process.env['PORT'] ?? 3100);
createActivityRouter(container).listen(port);
container.logger.info(`activity dev API on http://localhost:${port}`, { seeded: seed !== null });
