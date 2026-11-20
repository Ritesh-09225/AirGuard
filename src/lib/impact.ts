/**
 * Action catalog + impact math for committed low-emission choices.
 *
 * Impact figures are transparent engineering estimates based on public
 * averages (see `estimateNotes`); they are approximations for behaviour
 * change communication, not audit-grade carbon accounting. Each action
 * explains WHY the number is what it is via `why` and `impact`.
 *
 * Baselines used:
 * - Average petrol car ~0.16 kg CO2/km, average 30 km round-trip commute day.
 * - India grid electricity ~0.71 kg CO2/kWh (CEA 2023 average).
 * - Metro ~0.03 kg CO2/passenger-km; diesel bus ~0.05 kg/passenger-km.
 * - Smartphone full charge ~0.0087 kg CO2 (17 Wh at grid intensity).
 * - 10 W LED bulb 1 hour ~0.0071 kg CO2.
 * - N95 respirator filters >=95% of PM2.5 when well-fitted (NIOSH).
 */

export type ActionCategory = 'transport' | 'home-energy' | 'indoor-air' | 'community';

export interface ImpactAction {
  id: string;
  title: string;
  category: ActionCategory;
  /** Why this matters in a smog episode (1-2 sentences, plain language). */
  why: string;
  /** Human-readable weekly impact headline shown on the card. */
  impact: string;
  /** Estimated weekly CO2 avoided (kg) for a typical household. */
  weeklyCo2Kg: number;
  /** Estimated personal PM2.5 exposure reduction (%) when applicable. */
  exposureCutPct: number;
  /** Shield points: 1-3, reflecting combined climate + health value. */
  points: number;
  difficulty: 'easy' | 'medium';
  cost: 'free' | 'low-cost';
}

export const ACTION_CATALOG: readonly ImpactAction[] = [
  {
    id: 'carpool-2x',
    title: 'Carpool or take the bus twice this week',
    category: 'transport',
    why: 'A single-occupancy car is the most polluting way to move one person through a smog inversion. Sharing rides cuts per-person exhaust and removes parking-queue idling.',
    impact: '~6.4 kg CO2 avoided per week and one fewer cold start on high-pollution mornings',
    weeklyCo2Kg: 6.4,
    exposureCutPct: 0,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'metro-2x',
    title: 'Switch two commutes to metro or train',
    category: 'transport',
    why: 'Electric mass transit emits roughly 4-5x less CO2 per passenger-km than a petrol car and lets you avoid the roadside exposure peak.',
    impact: '~9 kg CO2 per week; roadside PM2.5 exposure on commute days drops sharply underground',
    weeklyCo2Kg: 9,
    exposureCutPct: 40,
    points: 3,
    difficulty: 'medium',
    cost: 'low-cost',
  },
  {
    id: 'combine-trips',
    title: 'Batch errands into one trip',
    category: 'transport',
    why: 'Cold engines and short trips emit 2-3x more per km than a warmed-up engine. One combined trip instead of three short ones cuts both.',
    impact: '~2.4 kg CO2 per week and fewer idling minutes stuck in smog queues',
    weeklyCo2Kg: 2.4,
    exposureCutPct: 10,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'no-idling',
    title: 'Zero idling: engine off over 60 seconds',
    category: 'transport',
    why: 'Idling pumps exhaust right where people breathe, especially school gates and parking lots. Modern engines need almost no warm-up.',
    impact: '~1.5 kg CO2 per week plus cleaner air at school gates and kerbsides',
    weeklyCo2Kg: 1.5,
    exposureCutPct: 15,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'n95-commute',
    title: 'Well-fitted N95 on every commute above AQI 200',
    category: 'indoor-air',
    why: 'A sealed N95/FFP2 filters at least 95% of PM2.5; cloth and surgical masks filter far less. It protects your lungs during the highest-exposure 60 minutes of the day.',
    impact: 'Up to 90-95% less inhaled PM2.5 during the commute hour',
    weeklyCo2Kg: 0,
    exposureCutPct: 70,
    points: 3,
    difficulty: 'easy',
    cost: 'low-cost',
  },
  {
    id: 'purifier-bedtime',
    title: 'Purify the bedroom during sleep',
    category: 'indoor-air',
    why: 'You spend a third of the day sleeping; filtration in the bedroom removes the nightly PM2.5 dose that would otherwise accumulate for 8 hours.',
    impact: 'Indoor PM2.5 in the sleeping room typically cut 50-70% overnight',
    weeklyCo2Kg: 0.5,
    exposureCutPct: 50,
    points: 3,
    difficulty: 'easy',
    cost: 'low-cost',
  },
  {
    id: 'midday-ventilation',
    title: 'Ventilate only in the clean midday window',
    category: 'indoor-air',
    why: 'Homes still need fresh air, but timing matters: PM2.5 usually dips around midday and spikes after dusk. Opening windows at the wrong time doubles the indoor dose.',
    impact: 'Indoor smog infiltration reduced up to 30-40% versus all-day-open windows',
    weeklyCo2Kg: 0,
    exposureCutPct: 30,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'no-indoor-smoke',
    title: 'No candles, incense or dhoop during smog weeks',
    category: 'indoor-air',
    why: 'Burning incense or candles indoors adds fine particles exactly when the outdoor air is already at hazard levels. One agarbatti stick can spike a room\u2019s PM2.5 severely.',
    impact: 'Avoids indoor PM2.5 spikes that can exceed outdoor levels for hours',
    weeklyCo2Kg: 0,
    exposureCutPct: 20,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'kitchen-exhaust',
    title: 'Chimney or exhaust fan on for every cooking session',
    category: 'indoor-air',
    why: 'Frying and tadka release fine particles and oil fumes. A working chimney captures most of them before they drift into bedrooms.',
    impact: 'Cooking-hour PM2.5 cut by roughly 60-80% when extraction is used',
    weeklyCo2Kg: 0,
    exposureCutPct: 35,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'damp-dusting',
    title: 'Damp mop and damp dust instead of dry sweeping',
    category: 'indoor-air',
    why: 'Dry sweeping re-suspends settled smog dust back into the air you breathe; a damp mop locks it away.',
    impact: 'Resuspended indoor dust reduced by around half per cleaning session',
    weeklyCo2Kg: 0,
    exposureCutPct: 15,
    points: 1,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'induction-one-meal',
    title: 'Cook one meal a day on induction/LPG, not biomass or kerosene',
    category: 'home-energy',
    why: 'Biomass and kerosene stoves emit far more PM2.5 per meal than LPG or induction, right next to the cook and children doing homework.',
    impact: '~1.8 kg CO2 per week and the largest possible cut in kitchen PM2.5',
    weeklyCo2Kg: 1.8,
    exposureCutPct: 45,
    points: 3,
    difficulty: 'medium',
    cost: 'low-cost',
  },
  {
    id: 'geyser-10min',
    title: 'Geyser on for 10-minute showers only',
    category: 'home-energy',
    why: 'Water heating is one of the biggest winter electricity loads. Trimming shower time to 10 minutes trims both grid demand and your winter bill.',
    impact: '~2.5 kg CO2 per week (about 3.5 kWh of grid electricity saved)',
    weeklyCo2Kg: 2.5,
    exposureCutPct: 0,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'standby-cut',
    title: 'Switch off standby devices at night',
    category: 'home-energy',
    why: 'Set-top boxes, chargers and old adapters sip power all night. Every standby watt is grid CO2 with zero benefit.',
    impact: '~0.6 kg CO2 per week and slightly lower smog-season grid peak',
    weeklyCo2Kg: 0.6,
    exposureCutPct: 0,
    points: 1,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'no-burning',
    title: 'Never burn leaves, waste or crops; report burning instead',
    category: 'community',
    why: 'Open burning releases enormous PM2.5 plumes at street level. One leaf-fire evening can rival traffic emissions for an entire neighbourhood.',
    impact: 'Prevents a point-source PM2.5 plume that can blanket several streets',
    weeklyCo2Kg: 0,
    exposureCutPct: 0,
    points: 3,
    difficulty: 'easy',
    cost: 'free',
  },
  {
    id: 'share-alert',
    title: 'Share the daily AQI alert with 3 neighbours',
    category: 'community',
    why: 'Most people cannot see fine particles until symptoms appear. A daily alert turns one informed household into a protected street.',
    impact: 'Community exposure drops when neighbours time windows, masks and exercise together',
    weeklyCo2Kg: 0,
    exposureCutPct: 0,
    points: 2,
    difficulty: 'easy',
    cost: 'free',
  },
] as const;

export const ACTION_BY_ID: ReadonlyMap<string, ImpactAction> = new Map(
  ACTION_CATALOG.map((action) => [action.id, action]),
);

export function isKnownAction(id: string): boolean {
  return ACTION_BY_ID.has(id);
}

export const CATEGORY_META: Record<
  ActionCategory,
  { label: string; description: string }
> = {
  transport: { label: 'Transport', description: 'Lower-emission ways to move' },
  'home-energy': { label: 'Home energy', description: 'Cleaner cooking and electricity use' },
  'indoor-air': { label: 'Indoor air', description: 'Breath less smog indoors' },
  community: { label: 'Community', description: 'Neighbourhood-level impact' },
};

export interface ImpactSummary {
  count: number;
  totalWeeklyCo2Kg: number;
  totalPoints: number;
  exposureActions: number;
  bestExposureCutPct: number;
  equivalences: {
    carKmAvoided: number;
    phoneCharges: number;
    ledHours: number;
  };
  actions: ImpactAction[];
}

const CAR_KG_PER_KM = 0.16;
const PHONE_CHARGE_KG = 0.0087;
const LED_HOUR_KG = 0.0071;

/**
 * Aggregates committed actions into a weekly impact summary with tangible
 * equivalences so families can feel what the numbers mean.
 */
export function summarizeCommitments(actionIds: readonly string[]): ImpactSummary {
  const actions = actionIds
    .map((id) => ACTION_BY_ID.get(id))
    .filter((a): a is ImpactAction => Boolean(a));

  const totalWeeklyCo2Kg =
    Math.round(actions.reduce((sum, a) => sum + a.weeklyCo2Kg, 0) * 10) / 10;
  const totalPoints = actions.reduce((sum, a) => sum + a.points, 0);
  const exposureActions = actions.filter((a) => a.exposureCutPct > 0);
  const bestExposureCutPct = exposureActions.reduce(
    (max, a) => Math.max(max, a.exposureCutPct),
    0,
  );

  return {
    count: actions.length,
    totalWeeklyCo2Kg,
    totalPoints,
    exposureActions: exposureActions.length,
    bestExposureCutPct,
    equivalences: {
      carKmAvoided: Math.round(totalWeeklyCo2Kg / CAR_KG_PER_KM),
      phoneCharges: Math.round(totalWeeklyCo2Kg / PHONE_CHARGE_KG),
      ledHours: Math.round(totalWeeklyCo2Kg / LED_HOUR_KG),
    },
    actions,
  };
}
