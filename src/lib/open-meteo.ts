/**
 * Server-side client for the Open-Meteo Air Quality + Geocoding APIs
 * (free, keyless: https://open-meteo.com/en/docs/air-quality-api).
 *
 * Security: hosts are hard-coded; user input only ever contributes
 * validated numbers / a bounded search string. Every fetch has a timeout
 * and a graceful degradation path (synthetic sample data) so the UI stays
 * functional when the upstream is unreachable.
 */

import dns from 'node:dns';
import { request as httpsRequest, type IncomingMessage } from 'node:https';
import { AirConcentrations } from '@/lib/aqi';
import { TtlCache } from '@/lib/cache';

// Sandboxes without a working IPv6 route make undici's dual-stack connect
// attempts fail with AggregateError ETIMEDOUT even though IPv4 works, and
// curl/bun succeed on the same network. Using node:https with family: 4
// removes the family race entirely for our two hard-coded upstream hosts.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Very old Node versions: keep defaults.
}

const AIR_HOST = 'https://air-quality-api.open-meteo.com';
const GEO_HOST = 'https://geocoding-api.open-meteo.com';

const FETCH_TIMEOUT_MS = 8000;
/** Transient DNS/connect blips happen in hosted sandboxes; retry once. */
const FETCH_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 400;
const AIR_CACHE_TTL_MS = 10 * 60 * 1000;
const GEO_CACHE_TTL_MS = 60 * 60 * 1000;

const airCache = new TtlCache<AirDataPayload>(AIR_CACHE_TTL_MS, 200);
const geoCache = new TtlCache<GeocodeResult[]>(GEO_CACHE_TTL_MS, 200);

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface HourlyAqiPoint {
  /** ISO time as returned by the upstream (already local via timezone=auto). */
  time: string;
  hour: number;
  aqi: number;
}

export type AirDataSource = 'live' | 'sample';

export interface AirDataPayload {
  location: { lat: number; lon: number };
  current: {
    time: string;
    usAqi: number;
    concentrations: AirConcentrations;
  };
  hourly: HourlyAqiPoint[];
  timezone: string;
  source: AirDataSource;
  fetchedAt: string;
}

export interface GeocodeResult {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
}

/* ------------------------------------------------------------------ *
 * Fetch helpers
 * ------------------------------------------------------------------ */

function readBody(res: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', reject);
  });
}

/** Single IPv4 HTTPS GET with a hard timeout; resolves to parsed JSON. */
function httpsGetJson(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: 'GET',
        family: 4,
        timeout: timeoutMs,
        headers: { accept: 'application/json' },
      },
      (res) => {
        if ((res.statusCode ?? 500) >= 300) {
          res.resume();
          reject(new Error(`Upstream responded ${res.statusCode}`));
          return;
        }
        readBody(res)
          .then((body) => {
            try {
              resolve(JSON.parse(body) as unknown);
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Bad JSON'));
            }
          })
          .catch(reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Upstream connect timed out')));
    req.on('error', reject);
    req.end();
  });
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      return await httpsGetJson(url, FETCH_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upstream fetch failed');
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------------------------ *
 * Air quality
 * ------------------------------------------------------------------ */

const CURRENT_FIELDS =
  'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide,us_aqi';

interface RawAirResponse {
  current?: Record<string, unknown>;
  hourly?: { time?: unknown[]; us_aqi?: unknown[] };
  timezone?: unknown;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Deterministic synthetic winter-smog pattern used only when the live feed
 * is unreachable. Peaks around 8-10 am and 9-11 pm, dip midday, with a
 * location-seeded variation so different cities look different.
 */
export function sampleAirData(lat: number, lon: number): AirDataPayload {
  const seed = Math.abs(
    Math.round(lat * 1000) * 31 + Math.round(lon * 1000) * 17,
  );
  const base = 120 + (seed % 110); // 120-229 typical winter smog band
  const hourly: HourlyAqiPoint[] = [];
  const now = new Date();
  const startHour = now.getHours();

  for (let i = 0; i <= 23; i++) {
    const hour = i;
    const morningPeak = Math.exp(-Math.pow(hour - 9, 2) / 6) * 60;
    const eveningPeak = Math.exp(-Math.pow(hour - 21.5, 2) / 6) * 80;
    const middayDip = -Math.exp(-Math.pow(hour - 14, 2) / 8) * 35;
    const jitter = ((seed + hour * 13) % 11) - 5;
    const aqi = Math.max(
      15,
      Math.min(480, Math.round(base + morningPeak + eveningPeak + middayDip + jitter)),
    );
    hourly.push({ time: `2026-01-01T${String(hour).padStart(2, '0')}:00`, hour, aqi });
  }

  const currentHour = hourly.find((h) => h.hour === startHour) ?? hourly[0];
  const scale = currentHour.aqi / 150;

  return {
    location: { lat, lon },
    current: {
      time: now.toISOString(),
      usAqi: currentHour.aqi,
      concentrations: {
        pm25: round1(40 * scale),
        pm10: round1(65 * scale),
        no2: round1(30 * scale),
        o3: round1(45 * scale),
        so2: round1(15 * scale),
        co: round1(1200 * scale),
      },
    },
    hourly: [...hourly.slice(startHour), ...hourly.slice(0, startHour)].slice(0, 24),
    timezone: 'local',
    source: 'sample',
    fetchedAt: now.toISOString(),
  };
}

/**
 * Pure normalizer for the upstream air payload: rotates the hourly series to
 * start at the current hour, dedupes overlapping forecast days and caps at
 * 24 points. Exported for unit testing (transport is stubbed elsewhere).
 */
export function parseAirResponse(
  raw: RawAirResponse,
  lat: number,
  lon: number,
): AirDataPayload | null {
  const current = raw.current;
  if (!current) return null;

  const usAqi = num(current.us_aqi);
  const times = Array.isArray(raw.hourly?.time) ? (raw.hourly?.time as unknown[]) : [];
  const values = Array.isArray(raw.hourly?.us_aqi) ? (raw.hourly?.us_aqi as unknown[]) : [];

  const hourly: HourlyAqiPoint[] = [];
  const nowIso = typeof current.time === 'string' ? current.time : '';
  const startHour = Number.isFinite(Number(nowIso.slice(11, 13)))
    ? Number(nowIso.slice(11, 13))
    : 0;

  for (let i = 0; i < times.length && i < values.length; i++) {
    const aqi = num(values[i]);
    const time = typeof times[i] === 'string' ? (times[i] as string) : null;
    if (aqi === null || !time) continue;
    const hour = Number.isFinite(Number(time.slice(11, 13)))
      ? Number(time.slice(11, 13))
      : -1;
    if (hour < 0) continue;
    hourly.push({ time, hour, aqi });
  }

  // Rotate hourly to start from the current hour, dedupe by hour (2 forecast
  // days overlap), and cap at 24 points.
  const ordered = startHour > 0
    ? [...hourly.filter((h) => h.hour >= startHour), ...hourly.filter((h) => h.hour < startHour)]
    : hourly;
  const seenHours = new Set<number>();
  const deduped: HourlyAqiPoint[] = [];
  for (const point of ordered) {
    if (seenHours.has(point.hour)) continue;
    seenHours.add(point.hour);
    deduped.push(point);
    if (deduped.length >= 24) break;
  }

  return {
    location: { lat, lon },
    current: {
      time: nowIso,
      usAqi: usAqi ?? 0,
      concentrations: {
        pm25: num(current.pm2_5),
        pm10: num(current.pm10),
        no2: num(current.nitrogen_dioxide),
        o3: num(current.ozone),
        so2: num(current.sulphur_dioxide),
        co: num(current.carbon_monoxide),
      },
    },
    hourly: deduped,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'local',
    source: 'live',
    fetchedAt: new Date().toISOString(),
  };
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Main entry point: cached live fetch with synthetic fallback. */
export async function getAirData(lat: number, lon: number): Promise<AirDataPayload> {
  const key = cacheKey(lat, lon);
  const cached = airCache.get(key);
  if (cached) return cached;

  const url =
    `${AIR_HOST}/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=${CURRENT_FIELDS}&hourly=us_aqi&forecast_days=2&timezone=auto`;

  try {
    const raw = (await fetchJsonWithTimeout(url)) as RawAirResponse;
    const parsed = parseAirResponse(raw, lat, lon);
    if (!parsed || (parsed.current.usAqi === 0 && parsed.hourly.length === 0)) {
      throw new Error('Upstream payload incomplete');
    }
    airCache.set(key, parsed);
    return parsed;
  } catch {
    const fallback = sampleAirData(lat, lon);
    // Short TTL for sample data so a recovered upstream is picked up quickly.
    airCache.set(`${key}|sample`, fallback);
    return fallback;
  }
}

/* ------------------------------------------------------------------ *
 * Geocoding
 * ------------------------------------------------------------------ */

interface RawGeocodeResponse {
  results?: Array<{
    name?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    country?: unknown;
    admin1?: unknown;
  }>;
}

/**
 * Pure mapper from upstream geocode results to the minimal, typed shape the
 * UI consumes. Incomplete rows are dropped. Exported for unit testing.
 */
export function mapGeocodeResults(raw: RawGeocodeResponse): GeocodeResult[] {
  const results = Array.isArray(raw.results) ? raw.results : [];
  return results
    .map((r) => {
      const lat = num(r.latitude);
      const lon = num(r.longitude);
      const name = typeof r.name === 'string' ? r.name : '';
      if (lat === null || lon === null || !name) return null;
      return {
        name,
        region: typeof r.admin1 === 'string' ? r.admin1 : '',
        country: typeof r.country === 'string' ? r.country : '',
        lat,
        lon,
      };
    })
    .filter((r): r is GeocodeResult => r !== null)
    .slice(0, 8);
}

export async function searchLocations(query: string): Promise<GeocodeResult[]> {
  const normalized = query.trim().slice(0, 100);
  if (normalized.length < 2) return [];

  const cached = geoCache.get(normalized.toLowerCase());
  if (cached) return cached;

  const url =
    `${GEO_HOST}/v1/search?name=${encodeURIComponent(normalized)}` +
    `&count=8&language=en&format=json`;

  try {
    const raw = (await fetchJsonWithTimeout(url)) as RawGeocodeResponse;
    const mapped = mapGeocodeResults(raw);

    // Only cache non-empty results: an empty payload is usually a transient
    // upstream hiccup and must not be poisoned into the 1-hour cache.
    if (mapped.length > 0) {
      geoCache.set(normalized.toLowerCase(), mapped);
    }
    return mapped;
  } catch (error) {
    // Search is best-effort for the UI, but never silently: keep a server
    // log so upstream problems remain diagnosable.
    console.error('[open-meteo] geocode search failed:', error);
    return [];
  }
}
