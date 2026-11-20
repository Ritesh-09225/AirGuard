/**
 * POST /api/planner — personalised daily low-emission routine.
 *
 * The ventilation/outdoor windows and the fallback plan are computed
 * deterministically from measured hourly AQI; the AI only enriches the
 * narrative. If the AI output fails schema validation, the deterministic
 * plan is returned (flagged with source: "rules") so the feature never
 * breaks.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  airContextFromPayload,
  buildPlannerSystemPrompt,
  extractJsonObject,
  getZai,
} from '@/lib/ai';
import { getAirData } from '@/lib/open-meteo';
import { clientKey, RateLimiter } from '@/lib/rate-limit';
import { buildFallbackPlan } from '@/lib/planner';
import { plannerRequestSchema, safeParse } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** 6 plan generations per 5 minutes per client. */
const limiter = new RateLimiter(6, 5 * 60_000);
const AI_TIMEOUT_MS = 45_000;

const aiPlanSchema = z.object({
  summary: z.string().min(10).max(600),
  blocks: z
    .array(
      z.object({
        time: z.string().min(1).max(40),
        title: z.string().min(1).max(80),
        activity: z.string().min(1).max(400),
        why: z.string().min(1).max(400),
        impact: z.string().min(1).max(300),
      }),
    )
    .min(3)
    .max(6),
  tips: z.array(z.string().min(1).max(300)).max(10).optional().default([]),
});

function placeLabel(loc: { name: string; region: string; country: string }): string {
  return [loc.name, loc.region, loc.country].filter(Boolean).join(', ');
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

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const input = safeParse(plannerRequestSchema, body);
  if (!input) {
    return NextResponse.json(
      { error: 'Invalid request: check location and profile fields.' },
      { status: 400 },
    );
  }

  const limit = limiter.check(clientKey(request, 'planner'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Plan generation limit reached. Please wait a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const payload = await getAirData(input.location.lat, input.location.lon);
    const ctx = airContextFromPayload(payload, placeLabel(input.location));
    const fallback = buildFallbackPlan(
      payload.current.usAqi,
      payload.hourly.map((h) => ({ hour: h.hour, aqi: h.aqi })),
      input.profile,
    );

    let plan = fallback;
    try {
      const zai = await getZai();
      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: buildPlannerSystemPrompt(ctx, input.profile) },
            { role: 'user', content: `Generate the plan for ${ctx.place} now.` },
          ],
        }),
        AI_TIMEOUT_MS,
      );
      const raw = completion.choices[0]?.message?.content ?? '';
      const json = extractJsonObject(raw);
      const validated = json ? safeParse(aiPlanSchema, json) : null;
      if (validated) {
        plan = {
          summary: validated.summary,
          ventilationWindow: fallback.ventilationWindow,
          outdoorWindow: fallback.outdoorWindow,
          blocks: validated.blocks.map((b) => ({ ...b })),
          tips: validated.tips.length > 0 ? validated.tips : fallback.tips,
          source: 'ai',
        };
      } else {
        // Diagnosable, non-fatal: keep serving the deterministic plan.
        console.error(
          '[api/planner] AI output rejected by schema; raw head:',
          raw.slice(0, 200),
        );
        if (json) {
          const probe = aiPlanSchema.safeParse(json);
          if (!probe.success) {
            console.error(
              '[api/planner] first issues:',
              JSON.stringify(probe.error.issues.slice(0, 4)),
            );
          }
        }
      }
    } catch (aiError) {
      // Deterministic plan keeps the feature alive when the AI is down.
      console.error('[api/planner] AI enrichment failed, using rules:', aiError);
    }

    return NextResponse.json(plan, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/planner] unexpected failure:', error);
    return NextResponse.json(
      { error: 'Could not build a plan right now. Please try again.' },
      { status: 503 },
    );
  }
}
