import { describe, expect, test } from 'bun:test';
import { InMemoryInsightsRepository } from '../src/repositories/in-memory-insights-repository.mjs';
import { DefaultInsightsService } from '../src/services/insights/insights-service.mjs';
import type { CommitDetail, RepoTarget } from '../src/interfaces/index.mjs';
import { fakeInsightsSource, fixedClock, silentLogger } from './helpers.mjs';

const NOW: string = '2026-10-15T00:00:00Z';
const target = (fullName: string, extra: Partial<RepoTarget> = {}): RepoTarget => ({
  fullName,
  databaseId: 7,
  isPrivate: false,
  pushedAt: '2026-10-10T00:00:00Z',
  defaultBranch: 'main',
  ...extra,
});
const detail = (sha: string, files: CommitDetail['files'], message: string = 'feat: x'): CommitDetail => ({
  sha,
  date: '2026-10-01T00:00:00Z',
  message,
  isMerge: false,
  files,
});

describe('DefaultInsightsService.refreshScheduled', () => {
  test('scans, queues and classifies; CDK roots from the scan drive classification', async () => {
    const store = new InMemoryInsightsRepository();
    const source = fakeInsightsSource({
      targets: [target('me/infra')],
      scans: { 'me/infra': { tools: ['cdk'], roots: { cdk: ['infra'], pulumi: [], cloudformation: [], serverless: [] }, clouds: ['AWS'] } },
      commits: { 'me/infra': [{ sha: 'a', date: '2026-10-01T00:00:00Z' }, { sha: 'b', date: '2026-10-02T00:00:00Z' }] },
      details: {
        a: detail('a', [{ filename: 'infra/lib/stack.ts', additions: 30, deletions: 0 }]),
        b: detail('b', [{ filename: 'src/app.ts', additions: 5, deletions: 1 }], 'fix: y'),
      },
    });
    const svc = new DefaultInsightsService(store, source, silentLogger(), fixedClock(NOW));
    const res = await svc.refreshScheduled(4);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.iac.tools).toEqual([{ tool: 'cdk', commits: 1, linesAdded: 30, linesDeleted: 0, reposTouched: 1, reposPresent: 1 }]);
    expect(res.value.coverage).toMatchObject({ commitsAnalyzed: 2, commitsPending: 0, reposScanned: 1 });
    expect(res.value.pullRequests.reviews).toBe(4);
    expect(store.meta?.careerFetchedAt).toBe('2026-10-15T00:00:00.000Z');
  });

  test('a second run does not rescan or refetch an unchanged repo', async () => {
    const store = new InMemoryInsightsRepository();
    const source = fakeInsightsSource({
      targets: [target('me/app')],
      commits: { 'me/app': [{ sha: 'a', date: '2026-10-01T00:00:00Z' }] },
      details: { a: detail('a', [{ filename: 'src/x.ts', additions: 1, deletions: 0 }]) },
    });
    const svc = new DefaultInsightsService(store, source, silentLogger(), fixedClock(NOW));
    await svc.refreshScheduled(0);
    await svc.refreshScheduled(0);
    expect(source.scanned).toEqual(['me/app']);
    expect(source.fetched).toEqual(['a']);
  });

  test('the per-run budget bounds commit-detail fetches; the rest stays queued', async () => {
    const store = new InMemoryInsightsRepository();
    const shas: string[] = ['a', 'b', 'c', 'd', 'e'];
    const source = fakeInsightsSource({
      targets: [target('me/app')],
      commits: { 'me/app': shas.map((sha: string) => ({ sha, date: '2026-10-01T00:00:00Z' })) },
      details: Object.fromEntries(shas.map((s: string) => [s, detail(s, [{ filename: 'src/x.ts', additions: 1, deletions: 0 }])])),
    });
    const svc = new DefaultInsightsService(store, source, silentLogger(), fixedClock(NOW), { scheduled: 2, push: 1, concurrency: 2, minRate: 500 });
    const res = await svc.refreshScheduled(0);
    expect(source.fetched).toHaveLength(2);
    expect(res.ok && res.value.coverage).toMatchObject({ commitsAnalyzed: 2, commitsPending: 3 });
  });

  test('stops calling GitHub when the rate limit is low', async () => {
    const store = new InMemoryInsightsRepository();
    const source = fakeInsightsSource({ targets: [target('me/app')], rate: 10 });
    const svc = new DefaultInsightsService(store, source, silentLogger(), fixedClock(NOW));
    await svc.refreshScheduled(0);
    expect(source.scanned).toEqual([]);
  });

  test('commits older than the 12-month window are not queued', async () => {
    const store = new InMemoryInsightsRepository();
    const source = fakeInsightsSource({
      targets: [target('me/app')],
      commits: { 'me/app': [{ sha: 'old', date: '2024-01-01T00:00:00Z' }] },
    });
    const svc = new DefaultInsightsService(store, source, silentLogger(), fixedClock(NOW));
    await svc.refreshScheduled(0);
    expect(source.fetched).toEqual([]);
  });

  test('private repositories land in the ledger under an opaque key', async () => {
    const store = new InMemoryInsightsRepository();
    const source = fakeInsightsSource({
      targets: [target('me/secret-thing', { isPrivate: true, databaseId: 99 })],
      commits: { 'me/secret-thing': [{ sha: 'a', date: '2026-10-01T00:00:00Z' }] },
      details: { a: detail('a', [{ filename: 'main.tf', additions: 3, deletions: 0 }]) },
    });
    const svc = new DefaultInsightsService(store, source, silentLogger(), fixedClock(NOW));
    const res = await svc.refreshScheduled(0);
    expect([...store.ledger.values()][0]?.repo).toBe('private:99');
    expect(JSON.stringify(res)).not.toContain('secret-thing');
  });
});
