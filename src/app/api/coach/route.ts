/**
 * GET    /api/coach?sessionId=<uuid> — persisted conversation history
 * POST   /api/coach                  — ask the coach a question
 * DELETE /api/coach?sessionId=<uuid> — clear the conversation
 *
 * Pipeline (POST): validate -> rate limit -> persist user turn -> build
 * grounded context (measured AQI + profile) -> AI completion (timeout-guarded)
 * -> persist reply -> respond. History is loaded from the database, so the
 * client cannot inject forged transcript turns.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  airContextFromPayload,
  buildCoachSystemPrompt,
  getZai,
} from '@/lib/ai';
import { getAirData } from '@/lib/open-meteo';
import { clientKey, RateLimiter } from '@/lib/rate-limit';
import {
  coachRequestSchema,
  commitmentsQuerySchema as coachSessionQuerySchema,
  safeParse,
} from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** 10 AI turns per 5 minutes per client. */
const limiter = new RateLimiter(10, 5 * 60_000);
const AI_TIMEOUT_MS = 45_000;
const HISTORY_TURNS = 12;

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function placeLabel(loc: { name: string; region: string; country: string }): string {
  return [loc.name, loc.region, loc.country].filter(Boolean).join(', ');
}

/** Conversation history for a session (capped, oldest first). */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = safeParse(
    coachSessionQuerySchema,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid session id.' }, { status: 400 });
  }

  const limit = limiter.check(clientKey(request, 'coach-read'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const messages = await db.chatMessage.findMany({
    where: { sessionId: parsed.sessionId },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return NextResponse.json(
    {
      messages: messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Clears the session's conversation. */
export async function DELETE(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = safeParse(
    coachSessionQuerySchema,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid session id.' }, { status: 400 });
  }

  const limit = limiter.check(clientKey(request, 'coach-read'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  await db.chatMessage.deleteMany({ where: { sessionId: parsed.sessionId } });
  return NextResponse.json({ cleared: true }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const input = safeParse(coachRequestSchema, body);
  if (!input) {
    return NextResponse.json(
      { error: 'Invalid request: check message length, ids and profile fields.' },
      { status: 400 },
    );
  }

  const limit = limiter.check(clientKey(request, 'coach'));
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          'You have sent several questions in a row. Please wait a couple of minutes and try again.',
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    // Persist the user turn first so the conversation survives AI hiccups.
    await db.chatMessage.create({
      data: { sessionId: input.sessionId, role: 'user', content: input.message },
    });

    const [payload, zai] = await Promise.all([
      getAirData(input.location.lat, input.location.lon),
      getZai(),
    ]);

    const ctx = airContextFromPayload(payload, placeLabel(input.location));
    const systemPrompt = buildCoachSystemPrompt(ctx, input.profile);

    const history = await db.chatMessage.findMany({
      where: { sessionId: input.sessionId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TURNS,
    });
    // Restore chronological order (newest last) for the model context.
    history.reverse();

    const messages: ChatTurn[] = [
      // SDK convention: the system prompt is the first 'assistant' turn.
      { role: 'assistant', content: systemPrompt },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as ChatTurn['role'], content: m.content })),
    ];

    const completion = await withTimeout(
      zai.chat.completions.create({ messages }),
      AI_TIMEOUT_MS,
    );

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error('EMPTY_AI_RESPONSE');
    }

    const saved = await db.chatMessage.create({
      data: { sessionId: input.sessionId, role: 'assistant', content: reply },
    });

    return NextResponse.json(
      {
        reply,
        replyId: saved.id,
        context: {
          aqi: ctx.aqi,
          place: ctx.place,
          ventilationWindow: ctx.ventilationWindow,
          outdoorWindow: ctx.outdoorWindow,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[api/coach] failure:', message);
    if (message === 'AI_TIMEOUT') {
      return NextResponse.json(
        { error: 'The coach took too long to think. Please try again.' },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: 'The coach is unavailable right now. Please try again shortly.' },
      { status: 503 },
    );
  }
}
