import { describe, expect, it } from 'vitest';
import {
  ACTION_CATALOG,
  ACTION_BY_ID,
  isKnownAction,
  summarizeCommitments,
} from '@/lib/impact';

describe('action catalog integrity', () => {
  it('has unique ids with complete, explained content', () => {
    const ids = new Set(ACTION_CATALOG.map((a) => a.id));
    expect(ids.size).toBe(ACTION_CATALOG.length);
    for (const action of ACTION_CATALOG) {
      expect(action.title.length).toBeGreaterThan(10);
      expect(action.why.length).toBeGreaterThan(40);
      expect(action.impact.length).toBeGreaterThan(10);
      expect(action.points).toBeGreaterThanOrEqual(1);
      expect(action.points).toBeLessThanOrEqual(3);
      expect(action.weeklyCo2Kg).toBeGreaterThanOrEqual(0);
      expect(['easy', 'medium']).toContain(action.difficulty);
      expect(['free', 'low-cost']).toContain(action.cost);
    }
  });

  it('recognises ids and rejects unknown ones', () => {
    expect(isKnownAction('carpool-2x')).toBe(true);
    expect(isKnownAction('make-up-id')).toBe(false);
    expect(ACTION_BY_ID.get('metro-2x')?.weeklyCo2Kg).toBeGreaterThan(5);
  });
});

describe('summarizeCommitments', () => {
  it('returns a zeroed summary for an empty commitment set', () => {
    const summary = summarizeCommitments([]);
    expect(summary.count).toBe(0);
    expect(summary.totalWeeklyCo2Kg).toBe(0);
    expect(summary.equivalences.carKmAvoided).toBe(0);
  });

  it('ignores unknown ids instead of failing', () => {
    const summary = summarizeCommitments(['carpool-2x', 'not-a-real-id']);
    expect(summary.count).toBe(1);
    expect(summary.totalWeeklyCo2Kg).toBe(6.4);
  });

  it('adds CO2 and produces meaningful equivalences', () => {
    const summary = summarizeCommitments(['carpool-2x', 'metro-2x', 'geyser-10min']);
    // 6.4 + 9 + 2.5 = 17.9 kg
    expect(summary.totalWeeklyCo2Kg).toBeCloseTo(17.9, 5);
    expect(summary.equivalences.carKmAvoided).toBe(Math.round(17.9 / 0.16));
    expect(summary.equivalences.phoneCharges).toBe(Math.round(17.9 / 0.0087));
    expect(summary.equivalences.ledHours).toBe(Math.round(17.9 / 0.0071));
    expect(summary.totalPoints).toBe(2 + 3 + 2);
  });

  it('tracks exposure-cutting actions', () => {
    const summary = summarizeCommitments(['n95-commute', 'purifier-bedtime']);
    expect(summary.exposureActions).toBe(2);
    expect(summary.bestExposureCutPct).toBe(70);
  });
});
