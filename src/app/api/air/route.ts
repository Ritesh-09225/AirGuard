/**
 * GET /api/air?lat=&lon=
 * Live (cached) air quality for a coordinate, with normalized pollutants,
 * US AQI and the hourly series. Falls back to clearly-flagged sample data.
 */

import { NextResponse } from 'next/server';
import { clientKey, RateLimiter } from '@/lib/rate-limit';
import { getAirData } from '@/lib/open-meteo';
import { airQuerySchema, safeParse } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** Generous limit: the endpoint is cheap thanks to the TTL cache. */
const limiter = new RateLimiter(60, 60_000);

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = safeParse(
    airQuerySchema,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid coordinates. lat must be -90..90 and lon -180..180.' },
      { status: 400 },
    );
  }

  const limit = limiter.check(clientKey(request, 'air'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const payload = await getAirData(parsed.lat, parsed.lon);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/air] unexpected failure:', error);
    return NextResponse.json(
      { error: 'Air quality service is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
