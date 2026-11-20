import { describe, expect, it } from 'vitest';
import { buildFallbackPlan, describeTrend } from '@/lib/planner';
import { DEFAULT_PROFILE, type HourlyPoint } from '@/lib/aqi';

function seriesFor(hourAqi: (hour: number) => number): HourlyPoint[] {
  return Array.from({ length: 24 }, (_, hour) => ({ hour, aqi: hourAqi(hour) }));
}

describe('buildFallbackPlan', () => {
  it('produces a complete, well-formed plan in severe smog', () => {
    // Even the daytime dip stays above the outdoor-exertion cutoff (150).
    const hourly = seriesFor((hour) => (hour >= 9 && hour <= 17 ? 160 : 300));
    const plan = buildFallbackPlan(320, hourly, DEFAULT_PROFILE);

    expect(plan.source).toBe('rules');
    expect(plan.ventilationWindow).toBeTruthy();
    expect(plan.outdoorWindow).toBeNull();
    expect(plan.blocks.length).toBeGreaterThanOrEqual(4);
    for (const block of plan.blocks) {
      expect(block.activity.length).toBeGreaterThan(10);
      expect(block.why.length).toBeGreaterThan(10);
      expect(block.impact.length).toBeGreaterThan(10);
    }
    expect(plan.tips.length).toBeGreaterThanOrEqual(3);
    expect(plan.summary.toLowerCase()).toContain('hazardous');
  });

  it('allows the cleanest window for outdoor time in moderate air', () => {
    const hourly = seriesFor((hour) => (hour === 14 ? 45 : 90));
    const plan = buildFallbackPlan(90, hourly, DEFAULT_PROFILE);
    // Ties keep the first window: hours 13-14 and 14-15 average the same.
    expect(plan.outdoorWindow).toBe('2 pm-3 pm');
    expect(plan.ventilationWindow).toBe('1 pm-3 pm');
  });

  it('personalises cooking advice for biomass households', () => {
    const hourly = seriesFor(() => 100);
    const plan = buildFallbackPlan(100, hourly, {
      ...DEFAULT_PROFILE,
      cookingFuel: 'biomass',
    });
    expect(plan.tips.join(' ').toLowerCase()).toContain('biomass');
  });

  it('personalises commute advice for two-wheeler riders', () => {
    const hourly = seriesFor(() => 220);
    const plan = buildFallbackPlan(220, hourly, {
      ...DEFAULT_PROFILE,
      commuteMode: 'two-wheeler',
    });
    expect(plan.tips.join(' ').toLowerCase()).toContain('n95');
  });
});

describe('describeTrend', () => {
  it('detects improving, worsening and steady trends', () => {
    expect(describeTrend([100, 90, 80, 75, 70, 65])).toBe(
      'improving over the next 6 hours',
    );
    expect(describeTrend([100, 120, 130, 140, 150, 160])).toBe(
      'worsening over the next 6 hours',
    );
    expect(describeTrend([100, 101, 100, 99, 101, 100])).toBe(
      'staying roughly steady over the next 6 hours',
    );
    expect(describeTrend([100])).toBeNull();
    expect(describeTrend([])).toBeNull();
  });
});
