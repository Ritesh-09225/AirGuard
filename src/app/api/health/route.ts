/**
 * GET /api/health — liveness + database connectivity probe.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  let database = 'up';
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }

  return NextResponse.json(
    { status: 'ok', database, time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
