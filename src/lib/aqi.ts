/**
 * Air-quality domain logic: US EPA AQI computation, categories, WHO guideline
 * comparisons and personalised advisories.
 *
 * All functions in this module are pure and unit-tested in `tests/aqi.test.ts`.
 *
 * References:
 * - US EPA AQI breakpoints (40 CFR Part 58, AQI reporting standard).
 * - WHO Global Air Quality Guidelines 2021 (24-hour / 8-hour levels).
 */

export type PollutantKey =
  | 'pm25'
  | 'pm10'
  | 'no2'
  | 'o3'
  | 'so2'
  | 'co';

/** Pollutant concentrations in micrograms per cubic metre (CO in mg/m3). */
export interface AirConcentrations {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  co: number | null;
}

export type AqiCategoryKey =
  | 'good'
  | 'moderate'
  | 'usg'
  | 'unhealthy'
  | 'very-unhealthy'
  | 'hazardous';

export interface AqiCategory {
  key: AqiCategoryKey;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
  /** Tailwind-friendly hex used for badges / chart fills. */
  color: string;
  /** Foreground colour with WCAG-safe contrast on `color`. */
  foreground: string;
  /** One-line meaning for the general population. */
  meaning: string;
}

export const AQI_CATEGORIES: Record<AqiCategoryKey, AqiCategory> = {
  good: {
    key: 'good',
    label: 'Good',
    shortLabel: 'Good',
    min: 0,
    max: 50,
    color: '#15803d',
    foreground: '#ffffff',
    meaning: 'Air quality is satisfactory for everyone.',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    shortLabel: 'Moderate',
    min: 51,
    max: 100,
    color: '#a16207',
    foreground: '#ffffff',
    meaning:
      'Acceptable air quality; unusually sensitive people should watch for symptoms.',
  },
  usg: {
    key: 'usg',
    label: 'Unhealthy for Sensitive Groups',
    shortLabel: 'Sensitive at risk',
    min: 101,
    max: 150,
    color: '#c2410c',
    foreground: '#ffffff',
    meaning:
      'Children, seniors and people with lung or heart conditions should limit outdoor exertion.',
  },
  unhealthy: {
    key: 'unhealthy',
    label: 'Unhealthy',
    shortLabel: 'Unhealthy',
    min: 151,
    max: 200,
    color: '#b91c1c',
    foreground: '#ffffff',
    meaning:
      'Everyone may feel effects; limit prolonged outdoor exertion and keep windows closed.',
  },
  'very-unhealthy': {
    key: 'very-unhealthy',
    label: 'Very Unhealthy',
    shortLabel: 'Very unhealthy',
    min: 201,
    max: 300,
    color: '#7e22ce',
    foreground: '#ffffff',
    meaning:
      'Health alert: avoid outdoor activity, filter indoor air and protect sensitive groups.',
  },
  hazardous: {
    key: 'hazardous',
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    min: 301,
    max: Number.POSITIVE_INFINITY,
    color: '#7f1d1d',
    foreground: '#ffffff',
    meaning:
      'Emergency conditions: stay indoors with filtered air; everyone should minimise exposure.',
  },
};

const CATEGORY_ORDER: AqiCategoryKey[] = [
  'good',
  'moderate',
  'usg',
  'unhealthy',
  'very-unhealthy',
  'hazardous',
];

/** Returns the AQI category for a given index (clamped to the valid range). */
export function getCategory(aqi: number): AqiCategory {
  const clamped = Number.isFinite(aqi) ? Math.max(0, Math.round(aqi)) : 0;
  const key =
    CATEGORY_ORDER.find((k) => clamped <= AQI_CATEGORIES[k].max) ??
    'hazardous';
  return AQI_CATEGORIES[key];
}

/* ------------------------------------------------------------------ *
 * EPA breakpoint tables (low, high, aqiLow, aqiHigh)
 * ------------------------------------------------------------------ */

type Breakpoint = readonly [number, number, number, number];

const BREAKPOINTS: Record<PollutantKey, readonly Breakpoint[]> = {
  // PM2.5 24h (EPA 2012-2024 standard, ug/m3)
  pm25: [
    [0.0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ],
  // PM10 24h (ug/m3)
  pm10: [
    [0, 54, 0, 50],
    [55, 154, 51, 100],
    [155, 254, 101, 150],
    [255, 354, 151, 200],
    [355, 424, 201, 300],
    [425, 504, 301, 400],
    [505, 604, 401, 500],
  ],
  // NO2 1h (ppb)
  no2: [
    [0, 53, 0, 50],
    [54, 100, 51, 100],
    [101, 360, 101, 150],
    [361, 649, 151, 200],
    [650, 1249, 201, 300],
    [1250, 2049, 301, 400],
  ],
  // O3 8h (ppb)
  o3: [
    [0, 54, 0, 50],
    [55, 70, 51, 100],
    [71, 85, 101, 150],
    [86, 105, 151, 200],
    [106, 200, 201, 300],
  ],
  // SO2 24h (ppb)
  so2: [
    [0, 35, 0, 50],
    [36, 75, 51, 100],
    [76, 185, 101, 150],
    [186, 304, 151, 200],
    [305, 604, 201, 300],
  ],
  // CO 8h (ppm)
  co: [
    [0, 4.4, 0, 50],
    [4.5, 9.4, 51, 100],
    [9.5, 12.4, 101, 150],
    [12.5, 15.4, 151, 200],
    [15.5, 30.4, 201, 300],
    [30.5, 50.4, 301, 400],
  ],
};

/**
 * Conversion factors from ug/m3 (CO: mg/m3) to the reporting unit used by the
 * EPA breakpoint tables. Values follow standard mass/volume conventions at
 * 25 C and 1 atm.
 */
const TO_REPORTING_UNIT: Record<PollutantKey, number> = {
  pm25: 1, // already ug/m3
  pm10: 1,
  no2: 1.88, // ug/m3 -> ppb
  o3: 1.96,
  so2: 2.62,
  co: 1145, // ug/m3 -> ppm
};

/** Linear interpolation of an EPA breakpoint row into an AQI sub-index. */
export function concentrationToAqi(
  pollutant: PollutantKey,
  concentration: number | null,
): number | null {
  if (concentration === null || !Number.isFinite(concentration)) return null;
  const converted = concentration / TO_REPORTING_UNIT[pollutant];
  const rows = BREAKPOINTS[pollutant];
  if (converted < 0) return 0;
  const last = rows[rows.length - 1];
  if (converted > last[1]) return last[3];
  for (let i = 0; i < rows.length; i++) {
    const [cLow, cHigh, aLow, aHigh] = rows[i];
    if (converted <= cHigh) {
      if (cHigh === cLow) return aHigh;
      const aqi = aLow + ((aHigh - aLow) * (converted - cLow)) / (cHigh - cLow);
      return Math.round(aqi);
    }
    // Gap between this row's top and the next row's bottom (some EPA tables
    // skip a unit, e.g. NO2 53 -> 54 ppb): the next row's aLow applies.
    const next = rows[i + 1];
    if (next && converted < next[0]) {
      return next[2];
    }
  }
  return 0;
}

export interface AqiBreakdown {
  aqi: number;
  dominant: PollutantKey | null;
  subIndices: Record<PollutantKey, number | null>;
}

/** Overall AQI = max of available sub-indices (EPA rule). */
export function computeAqiBreakdown(c: AirConcentrations): AqiBreakdown {
  const subIndices = {
    pm25: concentrationToAqi('pm25', c.pm25),
    pm10: concentrationToAqi('pm10', c.pm10),
    no2: concentrationToAqi('no2', c.no2),
    o3: concentrationToAqi('o3', c.o3),
    so2: concentrationToAqi('so2', c.so2),
    co: concentrationToAqi('co', c.co),
  } as Record<PollutantKey, number | null>;

  let aqi = 0;
  let dominant: PollutantKey | null = null;
  (Object.keys(subIndices) as PollutantKey[]).forEach((key) => {
    const value = subIndices[key];
    if (value !== null && value > aqi) {
      aqi = value;
      dominant = key;
    }
  });

  return { aqi, dominant, subIndices };
}

/* ------------------------------------------------------------------ *
 * WHO 2021 guideline comparison (24h / 8h levels, ug/m3)
 * ------------------------------------------------------------------ */

export const WHO_GUIDELINES: Record<PollutantKey, number> = {
  pm25: 15,
  pm10: 45,
  no2: 25,
  o3: 100,
  so2: 40,
  co: 4000,
};

export const POLLUTANT_META: Record<
  PollutantKey,
  { label: string; full: string; unit: string }
> = {
  pm25: { label: 'PM2.5', full: 'Fine particles (under 2.5 um)', unit: 'ug/m3' },
  pm10: { label: 'PM10', full: 'Coarse particles (under 10 um)', unit: 'ug/m3' },
  no2: { label: 'NO2', full: 'Nitrogen dioxide', unit: 'ug/m3' },
  o3: { label: 'O3', full: 'Ground-level ozone', unit: 'ug/m3' },
  so2: { label: 'SO2', full: 'Sulphur dioxide', unit: 'ug/m3' },
  co: { label: 'CO', full: 'Carbon monoxide', unit: 'ug/m3' },
};

/** Stable display order for pollutant grids. */
export const POLLUTANT_KEYS = [
  'pm25',
  'pm10',
  'no2',
  'o3',
  'so2',
  'co',
] as const satisfies readonly PollutantKey[];

/** How many times the WHO guideline the concentration is (1 decimal). */
export function timesWhoGuideline(
  pollutant: PollutantKey,
  concentration: number | null,
): number | null {
  if (concentration === null || !Number.isFinite(concentration)) return null;
  return Math.round((concentration / WHO_GUIDELINES[pollutant]) * 10) / 10;
}

/* ------------------------------------------------------------------ *
 * Household profile + advisories
 * ------------------------------------------------------------------ */

export type CommuteMode =
  | 'walk'
  | 'cycle'
  | 'two-wheeler'
  | 'car'
  | 'bus'
  | 'metro';

export type CookingFuel = 'lpg' | 'induction' | 'biomass' | 'kerosene';

export interface FamilyProfile {
  adults: number;
  children: number;
  seniors: number;
  respiratoryConditions: boolean;
  outdoorWork: boolean;
  commuteMode: CommuteMode;
  cookingFuel: CookingFuel;
  hasPurifier: boolean;
}

export const DEFAULT_PROFILE: FamilyProfile = {
  adults: 2,
  children: 1,
  seniors: 1,
  respiratoryConditions: true,
  outdoorWork: false,
  commuteMode: 'metro',
  cookingFuel: 'lpg',
  hasPurifier: false,
};

/** Short human label for profile facts used by UI + AI prompts. */
export function describeProfile(p: FamilyProfile): string[] {
  const facts: string[] = [];
  const members: string[] = [];
  if (p.adults > 0) members.push(`${p.adults} adult${p.adults > 1 ? 's' : ''}`);
  if (p.children > 0) members.push(`${p.children} child${p.children > 1 ? 'ren' : ''} under 12`);
  if (p.seniors > 0) members.push(`${p.seniors} senior${p.seniors > 1 ? 's' : ''} over 60`);
  if (members.length > 0) facts.push(`Household: ${members.join(', ')}`);
  if (p.respiratoryConditions) facts.push('Someone has asthma or a respiratory condition');
  if (p.outdoorWork) facts.push('Someone works outdoors (delivery, vending, construction)');
  facts.push(`Main commute: ${p.commuteMode}`);
  facts.push(`Main cooking fuel: ${p.cookingFuel}`);
  facts.push(`Air purifier at home: ${p.hasPurifier ? 'yes' : 'no'}`);
  return facts;
}

function hasSensitivePeople(p: FamilyProfile): boolean {
  return (
    p.children > 0 ||
    p.seniors > 0 ||
    p.respiratoryConditions ||
    p.outdoorWork
  );
}

/**
 * Deterministic, personalised advisory bullets. Rules are ordered from most
 * protective to least so callers can render them as a checklist.
 */
export function buildAdvisories(aqi: number, p: FamilyProfile): string[] {
  const band = getCategory(aqi).key;
  const sensitive = hasSensitivePeople(p);
  const advisories: string[] = [];

  if (band === 'hazardous') {
    advisories.push('Keep everyone indoors with windows closed and run air filtration if available.');
    advisories.push('Move exercise indoors; skip outdoor walks, runs and cycling entirely today.');
    advisories.push('N95/FFP2 masks outdoors only for unavoidable trips (well-fitted, sealed).');
  } else if (band === 'very-unhealthy') {
    advisories.push('Avoid outdoor exertion; reschedule walks or sports to the cleanest hourly window.');
    advisories.push('Keep windows closed during peak hours; ventilate only in the suggested window.');
    advisories.push('Sensitive groups should wear an N95/FFP2 mask outdoors.');
  } else if (band === 'unhealthy') {
    advisories.push('Limit prolonged outdoor exertion; shorten walks and move playtime indoors.');
    if (sensitive) advisories.push('Children, seniors and members with asthma should stay indoors as much as possible.');
    advisories.push('Close windows during traffic peaks (7-10 am, 8-11 pm).');
  } else if (band === 'usg') {
    if (sensitive) advisories.push('Sensitive members (children, seniors, asthma) should reduce outdoor exertion.');
    advisories.push('Choose parks away from main roads for any outdoor time.');
    advisories.push('Light outdoor exercise is fine for healthy adults; watch for coughing or irritation.');
  } else if (band === 'moderate') {
    advisories.push('Enjoy outdoor time, but avoid busy corridors at rush hour.');
    if (p.respiratoryConditions) advisories.push('Keep reliever medication handy during outdoor activity.');
  } else {
    advisories.push('Great day for outdoor activity and airing out the home.');
    advisories.push('Use the fresh air: deep-ventilate rooms and dry laundry outside.');
  }

  // Profile-driven additions (deterministic).
  if (p.children > 0 && (band === 'usg' || band === 'unhealthy')) {
    advisories.push('Move kids\u2019 outdoor play to midday; pollen and dust resuspension is lower then.');
  }
  if (p.children > 0 && (band === 'very-unhealthy' || band === 'hazardous')) {
    advisories.push('Keep children\u2019s indoor play active: obstacle courses, dance videos, balloon games.');
  }
  if (p.respiratoryConditions && aqi >= 151) {
    advisories.push('Follow your asthma/COPD action plan; seek care if wheezing or breathlessness worsens.');
  }
  if (p.outdoorWork && aqi >= 101) {
    advisories.push('Outdoor worker: take smog breaks indoors, hydrate, and use an N95 for the whole shift.');
  }
  if (p.commuteMode === 'walk' || p.commuteMode === 'cycle') {
    if (aqi >= 101) advisories.push(`Consider switching today\u2019s ${p.commuteMode} commute to metro/bus; roadside exposure can be 2-3x city average.`);
    else advisories.push(`Use back streets instead of main roads on your ${p.commuteMode} commute to cut exposure.`);
  }
  if ((p.cookingFuel === 'biomass' || p.cookingFuel === 'kerosene') && aqi >= 51) {
    advisories.push('Cooking fuel switch matters most today: biomass/kerosene smoke adds a large indoor PM2.5 dose.');
  }
  if (!p.hasPurifier && aqi >= 101) {
    advisories.push('No purifier? Run the AC recirculate mode or a DIY box-fan filter near the bedroom tonight.');
  }

  return advisories;
}

/* ------------------------------------------------------------------ *
 * Hourly-window helpers (deterministic, testable)
 * ------------------------------------------------------------------ */

export interface HourlyPoint {
  /** Hour of local day, 0-23. */
  hour: number;
  aqi: number;
}

export interface HourWindow {
  startHour: number;
  endHour: number;
  avgAqi: number;
  label: string;
}

export function formatHour(hour: number): string {
  const safe = ((hour % 24) + 24) % 24;
  const suffix = safe < 12 ? 'am' : 'pm';
  const base = safe % 12 === 0 ? 12 : safe % 12;
  return `${base} ${suffix}`;
}

/**
 * Finds the contiguous `windowHours`-hour window with the lowest average AQI
 * inside [minHour, maxHour). Returns null when no complete window exists.
 */
export function bestWindow(
  hourly: HourlyPoint[],
  minHour: number,
  maxHour: number,
  windowHours = 2,
): HourWindow | null {
  const byHour = new Map(hourly.map((h) => [h.hour, h.aqi]));
  let best: HourWindow | null = null;
  let bestAvgRaw: number | null = null;

  for (let start = minHour; start + windowHours <= maxHour; start++) {
    const values: number[] = [];
    for (let h = start; h < start + windowHours; h++) {
      const value = byHour.get(h);
      if (value === undefined) {
        values.length = 0;
        break;
      }
      values.push(value);
    }
    if (values.length === 0) continue;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    // Compare against the RAW average (never the rounded display value).
    if (bestAvgRaw === null || avg < bestAvgRaw) {
      bestAvgRaw = avg;
      best = {
        startHour: start,
        endHour: start + windowHours,
        avgAqi: Math.round(avg),
        label: `${formatHour(start)}-${formatHour(start + windowHours)}`,
      };
    }
  }
  return best;
}

/** Mean AQI of the next N hours from a series (uses array order). */
export function nextHoursAvg(series: number[], hours: number): number | null {
  if (series.length === 0) return null;
  const slice = series.slice(0, Math.min(hours, series.length));
  return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length);
}
