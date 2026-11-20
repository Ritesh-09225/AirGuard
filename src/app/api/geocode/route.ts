/**
 * GET /api/geocode?q=<city name>
 * Location autocomplete backed by the keyless Open-Meteo geocoding API.
 * Results are cached (1 h) and rate limited because search is upstream-bound.
 */

import { NextResponse } from 'next/server';
import { clientKey, RateLimiter } from '@/lib/rate-limit';
import { searchLocations } from '@/lib/open-meteo';
import { geocodeQuerySchema, safeParse } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const limiter = new RateLimiter(40, 60_000);

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = safeParse(
    geocodeQuerySchema,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed) {
    return NextResponse.json(
      { error: 'Query must be 2-100 characters.' },
      { status: 400 },
    );
  }

  const limit = limiter.check(clientKey(request, 'geocode'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many searches. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const results = await searchLocations(parsed.q);
  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
