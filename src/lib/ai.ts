/**
 * AI layer: singleton SDK instance and prompt builders.
 *
 * The SDK runs server-side only. System prompts embed only the validated,
 * non-identifying context (location name, AQI numbers, household profile
 * flags) — never session ids or free-form user text from other users.
 */

import ZAI from 'z-ai-web-dev-sdk';
import {
  AirConcentrations,
  bestWindow,
  describeProfile,
  FamilyProfile,
  getCategory,
  HourlyPoint,
  timesWhoGuideline,
  WHO_GUIDELINES,
} from '@/lib/aqi';
import { describeTrend } from '@/lib/planner';
import { profileFactsForPrompt } from '@/lib/profile-schema';
import type { AirDataPayload } from '@/lib/open-meteo';

let zaiPromise: Promise<ZAI> | null = null;

/** Lazily creates and memoises the SDK client (backend only). */
export function getZai(): Promise<ZAI> {
  zaiPromise ??= ZAI.create();
  return zaiPromise;
}

export interface AirContext {
  place: string;
  aqi: number;
  pm25: number | null;
  dominantLabel: string | null;
  trend: string | null;
  ventilationWindow: string | null;
  outdoorWindow: string | null;
}

export interface AirContextInput {
  place: string;
  aqi: number;
  concentrations: AirConcentrations;
  hourlyAqiSeries: number[];
  ventilationWindow: string | null;
  outdoorWindow: string | null;
}

const POLLUTANT_NAMES: Record<keyof AirConcentrations, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO2',
  o3: 'O3',
  so2: 'SO2',
  co: 'CO',
};

/**
 * Derives the AI air-context (including the measured ventilation and
 * outdoor windows) from a normalized air payload. Windows are always
 * computed from measured hourly data — never left to the model's opinion.
 */
export function airContextFromPayload(
  payload: AirDataPayload,
  place: string,
): AirContext {
  const hourly: HourlyPoint[] = payload.hourly.map((h) => ({
    hour: h.hour,
    aqi: h.aqi,
  }));
  const vent = bestWindow(hourly, 9, 18, 2);
  const outdoor = bestWindow(hourly, 8, 20, 1);
  // Absolute health cutoff (top of "Unhealthy for Sensitive Groups").
  const outdoorOk = outdoor !== null && outdoor.avgAqi <= 150;

  return buildAirContext({
    place,
    aqi: payload.current.usAqi,
    concentrations: payload.current.concentrations,
    hourlyAqiSeries: payload.hourly.map((h) => h.aqi),
    ventilationWindow: vent ? vent.label : null,
    outdoorWindow: outdoorOk && outdoor ? outdoor.label : null,
  });
}

/** Builds the shared, deterministic air-context paragraph for prompts. */
export function buildAirContext(input: AirContextInput): AirContext {
  const category = getCategory(input.aqi);
  const dominant = (Object.keys(input.concentrations) as Array<keyof AirConcentrations>)
    .map((key) => ({
      key,
      ratio: timesWhoGuideline(key, input.concentrations[key]) ?? 0,
    }))
    .sort((a, b) => b.ratio - a.ratio)[0];

  return {
    place: input.place,
    aqi: Math.round(input.aqi),
    pm25: input.concentrations.pm25,
    dominantLabel: dominant && dominant.ratio > 0.2 ? POLLUTANT_NAMES[dominant.key] : null,
    trend: describeTrend(input.hourlyAqiSeries),
    ventilationWindow: input.ventilationWindow,
    outdoorWindow: input.outdoorWindow,
  };
}

function airContextLines(ctx: AirContext): string[] {
  const lines = [
    `Location: ${ctx.place}`,
    `Current US AQI: ${ctx.aqi} (${getCategory(ctx.aqi).label})`,
    ctx.pm25 !== null
      ? `PM2.5 now: ${ctx.pm25} ug/m3 = ${(Math.round((ctx.pm25 / WHO_GUIDELINES.pm25) * 10) / 10).toFixed(1)}x the WHO 24-hour guideline`
      : 'PM2.5 now: unavailable',
    ctx.dominantLabel ? `Dominant pollutant: ${ctx.dominantLabel}` : null,
    ctx.trend ? `Hourly trend: ${ctx.trend}` : null,
    ctx.ventilationWindow
      ? `Best ventilation window (measured): ${ctx.ventilationWindow}`
      : 'No safe ventilation window today (measured)',
    ctx.outdoorWindow
      ? `Best outdoor window (measured): ${ctx.outdoorWindow}`
      : 'No good outdoor window today (measured)',
  ].filter((line): line is string => line !== null);
  return lines;
}

const COACH_BASE_RULES = [
  'You are AirGuard Coach, a practical winter-smog and clean-air advisor for families and communities.',
  'Ground every answer in the measured data provided below; do not invent air-quality numbers.',
  'Style: concise (max 180 words), warm, plain language, short bullets with "-" and line breaks; no markdown headings, no tables, no emojis.',
  'For every recommendation, state the direct impact in one short clause (what it saves or reduces and roughly how much, when known).',
  'Recommend low-emission routines (walking/cycling/metro swaps, batched errands, no burning), indoor-air measures (ventilation windows, filtration, kitchen extraction, no indoor smoke) and sustainable alternatives (clean cooking fuels, energy cuts).',
  'Personalise using the household profile; if a member has asthma or seniors/children are present, prioritise their protection.',
  'Never diagnose or prescribe; for worsening symptoms say to follow their action plan or seek medical advice.',
  'If asked about topics unrelated to air quality, health-protective routines or sustainability, briefly steer back to what you can help with.',
  'Answer in the same language as the user question.',
].join('\n');

/** System prompt for the coach chat endpoint. */
export function buildCoachSystemPrompt(
  ctx: AirContext,
  profile: FamilyProfile,
): string {
  return [
    COACH_BASE_RULES,
    '',
    'MEASURED CONDITIONS (do not contradict):',
    ...airContextLines(ctx),
    '',
    'HOUSEHOLD PROFILE:',
    ...profileFactsForPrompt(profile),
    '',
    `Full profile summary: ${describeProfile(profile).join('; ')}`,
  ].join('\n');
}

export interface PlannerAiBlock {
  time: string;
  title: string;
  activity: string;
  why: string;
  impact: string;
}

/** System prompt for the planner endpoint (strict JSON output). */
export function buildPlannerSystemPrompt(
  ctx: AirContext,
  profile: FamilyProfile,
): string {
  return [
    'You are AirGuard Planner. You produce a personalised, low-emission daily routine for a family navigating an air-pollution episode.',
    'Return ONLY valid JSON matching this exact shape (no markdown fences, no commentary):',
    '{"summary": string, "blocks": [{"time": string, "title": string, "activity": string, "why": string, "impact": string}], "tips": string[]}',
    'Constraints:',
    '- 4 to 5 blocks covering morning, commute/school hours, the ventilation window, evening and bedtime.',
    '- Each "activity" is 1-2 sentences, concrete and schedule-style.',
    '- "why" explains the air-quality reasoning; "impact" states the direct impact of the choice (with rough magnitude).',
    '- "summary" is 2 sentences max. "tips" has 3-5 short items.',
    '- Respect the MEASURED windows; never suggest ventilating outside them.',
    '- Total under 400 words. No emojis.',
    '',
    'MEASURED CONDITIONS:',
    ...airContextLines(ctx),
    '',
    'HOUSEHOLD PROFILE:',
    ...profileFactsForPrompt(profile),
  ].join('\n');
}

/**
 * Extracts the first JSON object from an AI response (handles stray
 * markdown fences defensively, though fences are forbidden in the prompt).
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
