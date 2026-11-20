import { describe, expect, it } from 'vitest';
import {
  mapGeocodeResults,
  parseAirResponse,
  sampleAirData,
  type RawAirResponse,
} from '@/lib/open-meteo';

const LIVE_PAYLOAD: RawAirResponse = {
  current: {
    time: '2026-11-20T16:30',
    pm2_5: 82.9,
    pm10: 83.8,
    carbon_monoxide: 2751.0,
    nitrogen_dioxide: 68.5,
    ozone: 125.0,
    sulphur_dioxide: 46.6,
    us_aqi: 210,
  },
  hourly: {
    time: ['2026-11-20T15:00', '2026-11-20T16:00', '2026-11-20T17:00'],
    us_aqi: [209, 210, 211],
  },
  timezone: 'Asia/Kolkata',
};

describe('parseAirResponse', () => {
  it('normalizes a live upstream payload', () => {
    const payload = parseAirResponse(LIVE_PAYLOAD, 28.61, 77.21);
    expect(payload).not.toBeNull();
    expect(payload?.source).toBe('live');
    expect(payload?.current.usAqi).toBe(210);
    expect(payload?.current.concentrations.pm25).toBeCloseTo(82.9, 1);
    expect(payload?.timezone).toBe('Asia/Kolkata');
    // Rotation: series starts at the current hour (16).
    expect(payload?.hourly[0]?.hour).toBe(16);
    expect(payload?.hourly.map((h) => h.hour)).toEqual([16, 17, 15]);
  });

  it('dedupes overlapping forecast days (same hour twice)', () => {
    const payload = parseAirResponse(
      {
        current: { time: '2026-11-20T06:30', us_aqi: 100 },
        hourly: {
          time: [
            '2026-11-20T06:00',
            '2026-11-20T07:00',
            '2026-11-21T06:00',
            '2026-11-21T07:00',
            '2026-11-21T08:00',
          ],
          us_aqi: [100, 110, 120, 130, 140],
        },
      },
      28.61,
      77.21,
    );
    expect(payload?.hourly.map((h) => h.hour)).toEqual([6, 7, 8]);
    expect(payload?.hourly.map((h) => h.aqi)).toEqual([100, 110, 140]);
  });

  it('returns null when the payload has no current block', () => {
    expect(parseAirResponse({}, 0, 0)).toBeNull();
  });

  it('drops rows with non-numeric values', () => {
    const payload = parseAirResponse(
      {
        current: { time: '2026-11-20T06:30', us_aqi: 100 },
        hourly: { time: ['2026-11-20T06:00', 'bad', '2026-11-20T08:00'], us_aqi: [50, 'x', 70] },
      },
      0,
      0,
    );
    expect(payload?.hourly.map((h) => h.aqi)).toEqual([50, 70]);
  });
});

describe('sampleAirData (fallback)', () => {
  it('is deterministic per location', () => {
    const a = sampleAirData(28.61, 77.21);
    const b = sampleAirData(28.61, 77.21);
    expect(b.current.usAqi).toBe(a.current.usAqi);
  });

  it('follows a winter diurnal pattern: evenings worse than midday', () => {
    const payload = sampleAirData(28.61, 77.21);
    const values = payload.hourly.map((h) => h.aqi);
    const middayAvg = (values[12] + values[13] + values[14]) / 3;
    const eveningAvg = (values[20] + values[21] + values[22]) / 3;
    expect(eveningAvg).toBeGreaterThanOrEqual(middayAvg);
  });

  it('is clearly flagged as sample data with 24 hourly points', () => {
    const payload = sampleAirData(19.07, 72.87);
    expect(payload.source).toBe('sample');
    expect(payload.hourly).toHaveLength(24);
    expect(payload.current.usAqi).toBeGreaterThan(0);
  });
});

describe('mapGeocodeResults', () => {
  it('maps upstream results to a minimal, typed shape', () => {
    const mapped = mapGeocodeResults({
      results: [
        {
          name: 'Delhi',
          latitude: 28.65,
          longitude: 77.23,
          country: 'India',
          admin1: 'National Capital Territory of Delhi',
        },
        { name: 'Broken', latitude: 'n/a', longitude: 0 },
        { name: 'Also Broken', latitude: 1, longitude: null },
        { name: '', latitude: 2, longitude: 3 },
      ],
    });
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toEqual({
      name: 'Delhi',
      region: 'National Capital Territory of Delhi',
      country: 'India',
      lat: 28.65,
      lon: 77.23,
    });
  });

  it('caps results at 8 and tolerates missing arrays', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `City ${i}`,
      latitude: i,
      longitude: i,
    }));
    expect(mapGeocodeResults({ results: many })).toHaveLength(8);
    expect(mapGeocodeResults({})).toEqual([]);
  });
});
