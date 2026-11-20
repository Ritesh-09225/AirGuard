/**
 * /api/commitments — persisted household action commitments.
 *
 * GET    ?sessionId=<uuid>            -> committed action ids
 * POST   { sessionId, actionId }      -> commit (idempotent upsert)
 * DELETE { sessionId, actionId }      -> un-commit
 *
 * actionId values are constrained to the compiled catalog, so no arbitrary
 * strings reach the database.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientKey, RateLimiter } from '@/lib/rate-limit';
import {
  commitmentsDeleteSchema,
  commitmentsPostSchema,
  commitmentsQuerySchema,
  safeParse,
} from '@/lib/validators';

export const dynamic = 'force-dynamic';

const readLimiter = new RateLimiter(120, 60_000);
const writeLimiter = new RateLimiter(40, 60_000);

function jsonError(message: string, status: number, retryAfter?: string): NextResponse {
  const headers: Record<string, string> = {};
  if (retryAfter) headers['Retry-After'] = retryAfter;
  return NextResponse.json({ error: message }, { status, headers });
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = safeParse(
    commitmentsQuerySchema,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed) {
    return jsonError('Invalid session id.', 400);
  }

  const limit = readLimiter.check(clientKey(request, 'commitments-read'));
  if (!limit.allowed) {
    return jsonError('Too many requests.', 429, String(limit.retryAfterSeconds));
  }

  const rows = await db.commitment.findMany({
    where: { sessionId: parsed.sessionId },
    select: { actionId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(
    {
      commitments: rows.map((r) => ({
        actionId: r.actionId,
        committedAt: r.createdAt.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Body must be valid JSON.', 400);
  }

  const parsed = safeParse(commitmentsPostSchema, body);
  if (!parsed) {
    return jsonError('Invalid session id or unknown action id.', 400);
  }

  const limit = writeLimiter.check(clientKey(request, 'commitments-write'));
  if (!limit.allowed) {
    return jsonError('Too many requests.', 429, String(limit.retryAfterSeconds));
  }

  const commitment = await db.commitment.upsert({
    where: {
      sessionId_actionId: {
        sessionId: parsed.sessionId,
        actionId: parsed.actionId,
      },
    },
    create: { sessionId: parsed.sessionId, actionId: parsed.actionId },
    update: {},
    select: { actionId: true, createdAt: true },
  });

  return NextResponse.json(
    { committed: commitment.actionId, committedAt: commitment.createdAt.toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Body must be valid JSON.', 400);
  }

  const parsed = safeParse(commitmentsDeleteSchema, body);
  if (!parsed) {
    return jsonError('Invalid session id or unknown action id.', 400);
  }

  const limit = writeLimiter.check(clientKey(request, 'commitments-write'));
  if (!limit.allowed) {
    return jsonError('Too many requests.', 429, String(limit.retryAfterSeconds));
  }

  await db.commitment.deleteMany({
    where: { sessionId: parsed.sessionId, actionId: parsed.actionId },
  });

  return NextResponse.json({ removed: parsed.actionId }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
