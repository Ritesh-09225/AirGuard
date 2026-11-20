import { describe, expect, it } from 'vitest';
import {
  AQI_CATEGORIES,
  buildAdvisories,
  bestWindow,
  computeAqiBreakdown,
  concentrationToAqi,
  DEFAULT_PROFILE,
  formatHour,
  getCategory,
  timesWhoGuideline,
  WHO_GUIDELINES,
  type HourlyPoint,
} from '@/lib/aqi';

describe('concentrationToAqi (EPA breakpoints)', () => {
  it('maps PM2.5 breakpoints correctly', () => {
    expect(concentrationToAqi('pm25', 0)).toBe(0);
    expect(concentrationToAqi('pm25', 12)).toBe(50);
    // 35.4 ug/m3 -> top of "Moderate"
    expect(concentrationToAqi('pm25', 35.4)).toBe(100);
    // midpoint between 35.5 (101) and 55.4 (150): ~125
    expect(concentrationToAqi('pm25', 45.4)).toBeGreaterThanOrEqual(101);
    expect(concentrationToAqi('pm25', 45.4)).toBeLessThanOrEqual(150);
    expect(concentrationToAqi('pm25', 500.4)).toBe(500);
    // beyond the table saturates
    expect(concentrationToAqi('pm25', 999)).toBe(500);
  });

  it('handles unit conversion for gases', () => {
    // 100 ug/m3 NO2 / 1.88 = 53.2 ppb -> first ppb of the 51..100 band
    expect(concentrationToAqi('no2', 100)).toBe(51);
    // CO: 4000 ug/m3 / 1145 = ~3.49 ppm -> Good band
    expect(concentrationToAqi('co', 4000)).toBeLessThanOrEqual(50);
  });

  it('returns null for missing data and 0 for negative input', () => {
    expect(concentrationToAqi('pm25', null)).toBeNull();
    expect(concentrationToAqi('pm10', -5)).toBe(0);
  });
});

describe('computeAqiBreakdown', () => {
  it('takes the maximum sub-index and names the dominant pollutant', () => {
    const breakdown = computeAqiBreakdown({
      pm25: 150, // ~200 AQI
      pm10: 100, // ~84 AQI
      no2: 20,
      o3: 60,
      so2: 10,
      co: 1000,
    });
    expect(breakdown.dominant).toBe('pm25');
    expect(breakdown.aqi).toBe(breakdown.subIndices.pm25);
  });

  it('returns 0 and null dominant when everything is null', () => {
    const empty = computeAqiBreakdown({
      pm25: null,
      pm10: null,
      no2: null,
      o3: null,
      so2: null,
      co: null,
    });
    expect(empty.aqi).toBe(0);
    expect(empty.dominant).toBeNull();
  });
});

describe('getCategory', () => {
  it('matches EPA bands', () => {
    expect(getCategory(0).key).toBe('good');
    expect(getCategory(50).key).toBe('good');
    expect(getCategory(51).key).toBe('moderate');
    expect(getCategory(150).key).toBe('usg');
    expect(getCategory(200).key).toBe('unhealthy');
    expect(getCategory(300).key).toBe('very-unhealthy');
    expect(getCategory(301).key).toBe('hazardous');
    expect(getCategory(9999).key).toBe('hazardous');
  });

  it('clamps non-finite input', () => {
    expect(getCategory(Number.NaN).key).toBe('good');
    expect(getCategory(-20).key).toBe('good');
  });

  it('exposes readable labels for every category', () => {
    for (const category of Object.values(AQI_CATEGORIES)) {
      expect(category.label.length).toBeGreaterThan(2);
      expect(category.meaning.length).toBeGreaterThan(10);
    }
  });
});

describe('timesWhoGuideline', () => {
  it('computes multiples of WHO limits', () => {
    expect(timesWhoGuideline('pm25', 45)).toBe(3);
    expect(timesWhoGuideline('pm25', null)).toBeNull();
    expect(timesWhoGuideline('pm25', WHO_GUIDELINES.pm25)).toBe(1);
  });
});

describe('buildAdvisories', () => {
  it('escalates advice as AQI rises', () => {
    const mild = buildAdvisories(40, DEFAULT_PROFILE);
    const severe = buildAdvisories(320, DEFAULT_PROFILE);
    const severeText = severe.join(' ').toLowerCase();
    expect(severe.length).toBeGreaterThan(mild.length);
    expect(severeText).toContain('indoors');
  });

  it('adds asthma-specific advice for respiratory households', () => {
    const withAsthma = buildAdvisories(180, {
      ...DEFAULT_PROFILE,
      respiratoryConditions: true,
    });
    expect(withAsthma.join(' ').toLowerCase()).toContain('asthma');
  });

  it('advises commute switch for active commuters in unhealthy air', () => {
    const cyclist = buildAdvisories(160, {
      ...DEFAULT_PROFILE,
      commuteMode: 'cycle',
    });
    expect(cyclist.join(' ')).toContain('cycle');
  });

  it('suggests filtration when no purifier is available', () => {
    const noPurifier = buildAdvisories(210, {
      ...DEFAULT_PROFILE,
      hasPurifier: false,
    });
    expect(noPurifier.join(' ').toLowerCase()).toContain('filter');
  });
});

describe('bestWindow + formatHour', () => {
  const hourly: HourlyPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    aqi: hour === 13 || hour === 14 ? 60 : 200,
  }));

  it('finds the cleanest 2-hour daytime window', () => {
    const window = bestWindow(hourly, 9, 18, 2);
    expect(window).not.toBeNull();
    expect(window?.startHour).toBe(13);
    expect(window?.avgAqi).toBe(60);
    expect(window?.label).toBe('1 pm-3 pm');
  });

  it('returns null when no complete window exists', () => {
    expect(bestWindow(hourly, 22, 24, 4)).toBeNull();
    expect(bestWindow([], 9, 18, 2)).toBeNull();
  });

  it('formats hours readably', () => {
    expect(formatHour(0)).toBe('12 am');
    expect(formatHour(9)).toBe('9 am');
    expect(formatHour(12)).toBe('12 pm');
    expect(formatHour(18)).toBe('6 pm');
  });
});
