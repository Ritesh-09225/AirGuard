/**
 * Shared zod schemas for every API boundary.
 *
 * All request bodies and query strings are validated server-side before any
 * processing; invalid input never reaches the AI layer or the database.
 */

import { z } from 'zod';
import { ACTION_CATALOG } from '@/lib/impact';
import { commuteModeValues, cookingFuelValues } from '@/lib/profile-schema';

/** Location selection shared by client and server. */
export const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).optional().default(''),
  country: z.string().trim().max(120).optional().default(''),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});
export type LocationValue = z.infer<typeof locationSchema>;

export const airQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

/** UUID v4 session id generated client-side; no accounts, no PII. */
export const sessionIdSchema = z
  .string()
  .uuid()
  .max(40);

export const profileSchema = z.object({
  adults: z.coerce.number().int().min(0).max(10),
  children: z.coerce.number().int().min(0).max(10),
  seniors: z.coerce.number().int().min(0).max(10),
  respiratoryConditions: z.boolean(),
  outdoorWork: z.boolean(),
  commuteMode: z.enum(commuteModeValues),
  cookingFuel: z.enum(cookingFuelValues),
  hasPurifier: z.boolean(),
});
export type ProfileValue = z.infer<typeof profileSchema>;

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(6000),
  id: z.string().max(64).optional(),
});

export const coachRequestSchema = z.object({
  sessionId: sessionIdSchema,
  message: z.string().trim().min(1).max(1000),
  location: locationSchema,
  profile: profileSchema,
});
export type CoachRequest = z.infer<typeof coachRequestSchema>;

export { chatMessageSchema };

export const plannerRequestSchema = z.object({
  location: locationSchema,
  profile: profileSchema,
});
export type PlannerRequest = z.infer<typeof plannerRequestSchema>;

const knownActionIds = ACTION_CATALOG.map((a) => a.id) as [string, ...string[]];

export const commitmentsPostSchema = z.object({
  sessionId: sessionIdSchema,
  actionId: z.enum(knownActionIds),
});

export const commitmentsDeleteSchema = z.object({
  sessionId: sessionIdSchema,
  actionId: z.enum(knownActionIds),
});

export const commitmentsQuerySchema = z.object({
  sessionId: sessionIdSchema,
});

/** Parses JSON and validates with a schema; returns null instead of throwing. */
export function safeParse<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  value: unknown,
): T | null {
  const result = schema.safeParse(value);
  return result.success && result.data !== undefined ? result.data : null;
}
