import { describe, expect, test } from 'bun:test';
import { toAppConfig } from '../src/config/load-config.mjs';
import { InMemoryActivityRepository } from '../src/repositories/in-memory-activity-repository.mjs';
import { DefaultActivityService } from '../src/services/activity-service.mjs';
import { ok, RefreshDepth } from '../src/types/index.mjs';
import type { ContributionCollector } from '../src/interfaces/index.mjs';
import type { ActivitySnapshot, RefreshDepth as Depth } from '../src/types/index.mjs';
import { fixedClock, sampleSnapshot, silentLogger, testEnv } from './helpers.mjs';

interface Harness {
  service: DefaultActivityService;
  repository: InMemoryActivityRepository;
  calls: Depth[];
}

const make = (seed: ActivitySnapshot | null, now: string): Harness => {
  const calls: Depth[] = [];
  const collector: ContributionCollector = {
    collect: async (depth: Depth) => {
      calls.push(depth);
      return ok(sampleSnapshot(now));
    },
  };
  const repository = new InMemoryActivityRepository(seed);
  const service = new DefaultActivityService(
    repository,
    collector,
    toAppConfig(testEnv({ REFRESH_DEBOUNCE_SECONDS: 60 })),
    silentLogger(),
    fixedClock(now),
  );
  return { service, repository, calls };
};

describe('DefaultActivityService.refresh', () => {
  test('debounce skips collection when the snapshot is fresh', async () => {
    const { service, calls } = make(sampleSnapshot('2026-10-14T12:00:00.000Z'), '2026-10-14T12:00:30.000Z');
    await service.refresh(RefreshDepth.Shallow, true);
    expect(calls).toEqual([]);
  });

  test('debounce collects when the snapshot is stale, and persists it', async () => {
    const { service, calls, repository } = make(sampleSnapshot('2026-10-14T12:00:00.000Z'), '2026-10-14T12:05:00.000Z');
    await service.refresh(RefreshDepth.Shallow, true);
    expect(calls).toEqual([RefreshDepth.Shallow]);
    const stored = await repository.getSnapshot();
    expect(stored.ok && stored.value?.generatedAt).toBe('2026-10-14T12:05:00.000Z');
  });

  test('the scheduled deep refresh ignores debounce', async () => {
    const { service, calls } = make(sampleSnapshot('2026-10-14T12:00:00.000Z'), '2026-10-14T12:00:01.000Z');
    await service.refresh(RefreshDepth.Deep, false);
    expect(calls).toEqual([RefreshDepth.Deep]);
  });
});

describe('DefaultActivityService.getLiveEvents', () => {
  test('returns newest first with a cursor that excludes what was already seen', async () => {
    const { service, repository } = make(null, '2026-10-14T12:00:00.000Z');
    const base = { url: null, isPrivate: true, language: null, branch: '', commitCount: 1, messages: [], repo: 'Private repository' };
    await repository.putLiveEvent({ ...base, id: 'a', receivedAt: '2026-10-14T10:00:00.000Z' });
    await repository.putLiveEvent({ ...base, id: 'b', receivedAt: '2026-10-14T11:00:00.000Z' });

    const first = await service.getLiveEvents(null);
    expect(first.ok && first.value.events.map((e) => e.id)).toEqual(['b', 'a']);
    const cursor: string = first.ok ? first.value.cursor : '';

    await repository.putLiveEvent({ ...base, id: 'c', receivedAt: '2026-10-14T12:00:00.000Z' });
    const next = await service.getLiveEvents(cursor);
    expect(next.ok && next.value.events.map((e) => e.id)).toEqual(['c']);

    const idle = await service.getLiveEvents(next.ok ? next.value.cursor : '');
    expect(idle.ok && idle.value.events).toEqual([]);
  });
});
