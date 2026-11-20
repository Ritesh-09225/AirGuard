/**
 * Daily low-emission routine planner.
 *
 * `buildFallbackPlan` is deterministic (rule-based) so the app always shows a
 * useful plan even when the AI service is unavailable. The AI endpoint
 * enriches this skeleton with personalised text; windows (ventilation /
 * outdoor) are always computed here from measured hourly AQI, never guessed.
 */

import {
  buildAdvisories,
  bestWindow,
  FamilyProfile,
  formatHour,
  getCategory,
  HourlyPoint,
  nextHoursAvg,
} from '@/lib/aqi';

export interface PlanBlock {
  time: string;
  title: string;
  activity: string;
  why: string;
  impact: string;
}

export interface DayPlan {
  summary: string;
  ventilationWindow: string | null;
  outdoorWindow: string | null;
  blocks: PlanBlock[];
  tips: string[];
  source: 'ai' | 'rules';
}

function commuteTip(profile: FamilyProfile): string | null {
  switch (profile.commuteMode) {
    case 'walk':
      return 'Walking commute: pick greener side streets and keep it to the cleanest window.';
    case 'cycle':
      return 'Cycling commute: shift it into the cleanest window or hop on the metro on the worst mornings.';
    case 'two-wheeler':
      return 'Two-wheeler rides sit right in the exhaust plume: an N95 under the helmet is the single best upgrade.';
    case 'car':
      return 'Car commute: use recirculate mode, keep windows up in queues, and switch the engine off at long waits.';
    case 'bus':
      return 'Bus commute: sit mid-vehicle away from the tailpipe and keep vents closed in traffic.';
    case 'metro':
      return 'Metro commute: you already travel cleaner; avoid the walk to the station at rush hour by leaving slightly earlier.';
    default:
      return null;
  }
}

function cookingTip(profile: FamilyProfile): string | null {
  switch (profile.cookingFuel) {
    case 'biomass':
      return 'Biomass smoke indoors can be worse than the street outside: move at least one meal to LPG or induction.';
    case 'kerosene':
      return 'Kerosene stoves emit a heavy PM2.5 dose per meal; switch even one meal to LPG/induction.';
    case 'lpg':
      return 'LPG is already clean-burning; keep the exhaust fan on for frying and tadka anyway.';
    case 'induction':
      return 'Induction is the cleanest way to cook; keep the chimney on for frying anyway.';
    default:
      return null;
  }
}

function block(
  time: string,
  title: string,
  activity: string,
  why: string,
  impact: string,
): PlanBlock {
  return { time, title, activity, why, impact };
}

/** Absolute health-based cutoff: above 150 (USG top), outdoor exertion is discouraged. */
const OUTDOOR_OK_MAX_AQI = 150;

/**
 * Deterministic plan built from the AQI band, the measured cleanest windows
 * and the household profile.
 */
export function buildFallbackPlan(
  aqi: number,
  hourly: HourlyPoint[],
  profile: FamilyProfile,
): DayPlan {
  const band = getCategory(aqi);
  const vent = bestWindow(hourly, 9, 18, 2);
  const outdoor = bestWindow(hourly, 8, 20, 1);
  const outdoorOk = outdoor !== null && outdoor.avgAqi <= OUTDOOR_OK_MAX_AQI;
  const severe = aqi >= 201;
  const unhealthy = aqi >= 151;

  const morningActivity = severe
    ? 'Skip the outdoor workout entirely; do a 20-minute indoor yoga or bodyweight circuit instead.'
    : unhealthy
      ? `Keep movement indoors this morning; if you must go out, go at ${outdoor?.label ?? 'midday'} and keep it short.`
      : `Light outdoor activity is acceptable around ${outdoor?.label ?? 'midday'}; choose a park away from main roads.`;
  const morningWhy = severe
    ? 'Early morning PM2.5 sits in a shallow inversion layer that has not mixed yet; dawn air is often the worst of the day.'
    : 'Traffic peaks and calm winds in the morning trap fresh exhaust near the ground.';
  const morningImpact = severe
    ? 'Skipping a 6 am run avoids up to 2-3x the PM2.5 dose of the same run at midday.'
    : 'Timing the same activity right cuts inhaled PM2.5 meaningfully without losing the workout.';

  const blocks: PlanBlock[] = [
    block('5:00-8:00', 'Morning reset', morningActivity, morningWhy, morningImpact),
    block(
      '8:00-10:00',
      'School & commute hour',
      profile.commuteMode === 'walk' || profile.commuteMode === 'cycle'
        ? 'Leave 15 minutes earlier and use side streets; carry masks for the family.'
        : 'Pre-plan the route to avoid gridlock; windows up, recirculate on, no idling at gates.',
      'School gates and office drops are pollution hotspots between 8 and 10 am.',
      'Route and timing choices here protect the whole household\u2019s biggest daily exposure.',
    ),
    block(
      vent ? `${formatHour(vent.startHour)}-${formatHour(vent.endHour)}` : '12:00-14:00',
      'Fresh-air window',
      vent
        ? `Open windows on opposite sides for cross-ventilation; air out the bedroom and run laundry outside.`
        : 'Air quality never drops to a safe window today; keep windows closed and rely on filtration.',
      vent
        ? `This is today\u2019s measured cleanest stretch (average AQI ${vent.avgAqi}).`
        : 'There is no low-AQI stretch in daytime hours today.',
      vent
        ? 'A short cross-breeze flush clears accumulated indoor CO2 and VOCs without loading PM2.5.'
        : 'Skipping unfiltered ventilation avoids a large indoor PM2.5 spike.',
    ),
    block(
      '16:00-19:00',
      'Evening routine',
      severe
        ? 'Cancel evening walks and outdoor sports; switch kids to indoor games and screen-free play.'
        : 'Fine for a short outdoor walk; keep it before 8 pm when the evening inversion begins.',
      'After dusk, cooler air traps particles again and evening traffic peaks overlap.',
      'Moving one evening walk indoors spares the family the second daily exposure peak.',
    ),
    block(
      '20:00-23:00',
      'Kitchen & bedtime',
      [
        profile.hasPurifier
          ? 'Run the purifier on high from dinner time, dropping to sleep mode later.'
          : 'Run the AC on recirculate or a box-fan filter near the bed; keep the bedroom door closed.',
        'No candles, incense or dhoop tonight.',
      ].join(' '),
      'Bedroom filtration during the 8 hours of sleep is the highest-value air investment of the day.',
      'Filtration during sleep typically cuts bedroom PM2.5 by half or more.',
    ),
  ];

  const tips = [
    `Overall band today: ${band.label}. ${band.meaning}`,
    ...(commuteTip(profile) ? [commuteTip(profile) as string] : []),
    ...(cookingTip(profile) ? [cookingTip(profile) as string] : []),
    ...buildAdvisories(aqi, profile).slice(0, 3),
  ];

  const summary = `A ${band.label.toLowerCase()} air day (AQI ${Math.round(aqi)}). ${
    vent
      ? `Best ventilation window: ${vent.label}.`
      : 'No safe ventilation window today; filter instead.'
  } ${
    outdoorOk && outdoor
      ? `Best outdoor window: around ${outdoor.label}.`
      : 'Keep outdoor exertion minimal today.'
  }`;

  return {
    summary,
    ventilationWindow: vent ? vent.label : null,
    outdoorWindow: outdoorOk && outdoor ? outdoor.label : null,
    blocks,
    tips,
    source: 'rules',
  };
}

/** Trend description for the next hours, used in UI + AI prompt. */
export function describeTrend(series: number[]): string | null {
  if (series.length < 3) return null;
  const avg6 = nextHoursAvg(series, 6);
  const avgNow = series[0];
  if (avg6 === null) return null;
  if (avg6 > avgNow * 1.15) return 'worsening over the next 6 hours';
  if (avg6 < avgNow * 0.85) return 'improving over the next 6 hours';
  return 'staying roughly steady over the next 6 hours';
}
