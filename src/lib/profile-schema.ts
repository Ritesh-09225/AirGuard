/**
 * Household profile primitives shared by client state, API validation and
 * the AI prompt builders. Single source of truth for the option lists.
 */

import type { CommuteMode, CookingFuel } from '@/lib/aqi';

export const commuteModeValues = [
  'walk',
  'cycle',
  'two-wheeler',
  'car',
  'bus',
  'metro',
] as const satisfies readonly CommuteMode[];

export const cookingFuelValues = [
  'lpg',
  'induction',
  'biomass',
  'kerosene',
] as const satisfies readonly CookingFuel[];

export const COMMUTE_LABELS: Record<CommuteMode, string> = {
  walk: 'Walking',
  cycle: 'Cycling',
  'two-wheeler': 'Two-wheeler',
  car: 'Car',
  bus: 'Bus',
  metro: 'Metro / train',
};

export const COOKING_FUEL_LABELS: Record<CookingFuel, string> = {
  lpg: 'LPG / piped gas',
  induction: 'Induction / electric',
  biomass: 'Biomass / wood / coal',
  kerosene: 'Kerosene',
};

/** Profile facts flattened for AI prompts (no names, no identifiers). */
export function profileFactsForPrompt(profile: {
  adults: number;
  children: number;
  seniors: number;
  respiratoryConditions: boolean;
  outdoorWork: boolean;
  commuteMode: CommuteMode;
  cookingFuel: CookingFuel;
  hasPurifier: boolean;
}): string[] {
  const facts: string[] = [];
  facts.push(
    `Household: ${profile.adults} adult(s), ${profile.children} child(ren) under 12, ${profile.seniors} senior(s) over 60.`,
  );
  if (profile.respiratoryConditions) {
    facts.push('Someone in the household has asthma or another respiratory condition.');
  }
  if (profile.outdoorWork) {
    facts.push('Someone works outdoors (e.g., delivery, vending, construction, farming).');
  }
  facts.push(`Main commute mode: ${COMMUTE_LABELS[profile.commuteMode]}.`);
  facts.push(`Main cooking fuel: ${COOKING_FUEL_LABELS[profile.cookingFuel]}.`);
  facts.push(`Air purifier at home: ${profile.hasPurifier ? 'yes' : 'no'}.`);
  return facts;
}
