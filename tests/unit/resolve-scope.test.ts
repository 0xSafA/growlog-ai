import { describe, expect, it } from 'vitest';
import {
  applyCycleStartToWindow,
  recentRawFactsWindow,
  resolveQueryScope,
  timeWindowForIntent,
} from '@/lib/growlog/retrieval/resolve-scope';
import { compressDailyTimelines } from '@/lib/growlog/retrieval/fetch-context';

describe('resolveQueryScope cycle-aware windows', () => {
  const now = new Date('2026-03-22T12:00:00.000Z');

  it('extends window to cycle start_date for status intent', () => {
    const resolved = resolveQueryScope({
      farmId: 'farm-1',
      cycleId: 'cycle-1',
      scopeId: 'scope-1',
      now,
      intentType: 'status',
      cycleStartDate: '2026-01-15',
    });
    expect(resolved.timeWindow.from).toBe('2026-01-15T00:00:00.000Z');
    expect(resolved.timeWindow.to).toBe(now.toISOString());
  });

  it('keeps intent window when cycle start is absent', () => {
    const resolved = resolveQueryScope({
      farmId: 'farm-1',
      cycleId: null,
      scopeId: null,
      now,
      intentType: 'status',
      cycleStartDate: null,
    });
    const expected = timeWindowForIntent('status', now);
    expect(resolved.timeWindow.from).toBe(expected.from);
  });

  it('applyCycleStartToWindow picks earlier bound', () => {
    const window = timeWindowForIntent('report', now);
    const extended = applyCycleStartToWindow(window, '2025-06-01');
    expect(new Date(extended.from).getTime()).toBeLessThan(new Date(window.from).getTime());
  });
});

describe('recentRawFactsWindow', () => {
  it('covers 7 days before `to`', () => {
    const to = new Date('2026-03-22T12:00:00.000Z');
    const w = recentRawFactsWindow(to);
    const diffDays = (to.getTime() - new Date(w.from).getTime()) / 86400000;
    expect(diffDays).toBeCloseTo(7, 0);
  });
});

describe('compressDailyTimelines', () => {
  it('prioritizes days with anomalies when over cap', () => {
    const timelines = Array.from({ length: 80 }, (_, i) => ({
      id: `t-${i}`,
      timelineDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
      summaryText: `day ${i}`,
      eventCount: 1,
      anomalyCount: i % 10 === 0 ? 2 : 0,
    }));
    const out = compressDailyTimelines(timelines, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.some((t) => t.anomalyCount > 0)).toBe(true);
  });
});
