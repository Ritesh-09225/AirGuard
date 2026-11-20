import { describe, expect, it } from 'vitest';
import {
  airQuerySchema,
  coachRequestSchema,
  commitmentsPostSchema,
  geocodeQuerySchema,
  plannerRequestSchema,
  profileSchema,
  safeParse,
  sessionIdSchema,
} from '@/lib/validators';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

const VALID_PROFILE = {
  adults: 2,
  children: 1,
  seniors: 1,
  respiratoryConditions: true,
  outdoorWork: false,
  commuteMode: 'metro',
  cookingFuel: 'lpg',
  hasPurifier: false,
};

const VALID_LOCATION = {
  name: 'Delhi',
  region: 'NCT',
  country: 'India',
  lat: 28.61,
  lon: 77.21,
};

describe('airQuerySchema', () => {
  it('accepts valid coordinates and coerces strings', () => {
    expect(airQuerySchema.safeParse({ lat: '12.5', lon: '-70' }).success).toBe(true);
  });
  it('rejects out-of-range coordinates', () => {
    expect(airQuerySchema.safeParse({ lat: 91, lon: 0 }).success).toBe(false);
    expect(airQuerySchema.safeParse({ lat: 0, lon: -181 }).success).toBe(false);
    expect(airQuerySchema.safeParse({ lat: 'abc', lon: 0 }).success).toBe(false);
  });
});

describe('sessionIdSchema', () => {
  it('accepts a UUID and rejects other formats', () => {
    expect(sessionIdSchema.safeParse(UUID).success).toBe(true);
    expect(sessionIdSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(sessionIdSchema.safeParse("1'; DROP TABLE users; --").success).toBe(false);
  });
});

describe('coachRequestSchema', () => {
  it('accepts a well-formed request', () => {
    const result = coachRequestSchema.safeParse({
      sessionId: UUID,
      message: 'Is it safe to jog today?',
      location: VALID_LOCATION,
      profile: VALID_PROFILE,
    });
    expect(result.success).toBe(true);
  });

  it('rejects oversized or empty messages', () => {
    expect(
      coachRequestSchema.safeParse({
        sessionId: UUID,
        message: 'x'.repeat(1001),
        location: VALID_LOCATION,
        profile: VALID_PROFILE,
      }).success,
    ).toBe(false);
    expect(
      coachRequestSchema.safeParse({
        sessionId: UUID,
        message: '   ',
        location: VALID_LOCATION,
        profile: VALID_PROFILE,
      }).success,
    ).toBe(false);
  });

  it('rejects invalid enum fields in the profile', () => {
    expect(
      coachRequestSchema.safeParse({
        sessionId: UUID,
        message: 'hello',
        location: VALID_LOCATION,
        profile: { ...VALID_PROFILE, commuteMode: 'spaceship' },
      }).success,
    ).toBe(false);
  });
});

describe('plannerRequestSchema', () => {
  it('requires location + profile only', () => {
    expect(
      plannerRequestSchema.safeParse({ location: VALID_LOCATION, profile: VALID_PROFILE })
        .success,
    ).toBe(true);
  });
});

describe('profileSchema', () => {
  it('bounds member counts', () => {
    expect(profileSchema.safeParse({ ...VALID_PROFILE, adults: 11 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...VALID_PROFILE, children: -1 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...VALID_PROFILE, adults: '3' }).success).toBe(true);
  });
});

describe('commitmentsPostSchema', () => {
  it('only accepts catalog action ids', () => {
    expect(
      commitmentsPostSchema.safeParse({ sessionId: UUID, actionId: 'carpool-2x' }).success,
    ).toBe(true);
    expect(
      commitmentsPostSchema.safeParse({ sessionId: UUID, actionId: 'burn-leaves' }).success,
    ).toBe(false);
    expect(
      commitmentsPostSchema.safeParse({ sessionId: 'oops', actionId: 'carpool-2x' }).success,
    ).toBe(false);
  });
});

describe('geocodeQuerySchema', () => {
  it('bounds the query length', () => {
    expect(geocodeQuerySchema.safeParse({ q: 'Delhi' }).success).toBe(true);
    expect(geocodeQuerySchema.safeParse({ q: 'D' }).success).toBe(false);
    expect(geocodeQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
  });
});

describe('safeParse helper', () => {
  it('returns data on success and null on failure', () => {
    expect(safeParse(geocodeQuerySchema, { q: 'Lahore' })).toEqual({ q: 'Lahore' });
    expect(safeParse(geocodeQuerySchema, { q: 'L' })).toBeNull();
  });
});
