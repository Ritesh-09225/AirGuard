'use client';

/**
 * Daily plan tab: one tap generates a personalised low-emission routine.
 * Windows shown are always the measured ones (computed server-side from
 * hourly AQI); the AI enriches the narrative, with a deterministic
 * fallback flagged as "Standard checklist".
 */

import { useMutation } from '@tanstack/react-query';
import { CalendarClock, CloudSun, DoorOpen, Leaf, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useApp } from '@/components/airguard/state';
import { generatePlan, ApiError, type DayPlanPayload } from '@/lib/client/api';

export function PlannerTab() {
  const { location, profile } = useApp();

  const plan = useMutation({
    mutationFn: () => generatePlan({ location, profile }),
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Network problem — please try again.',
      );
    },
  });

  function renderPlan(data: DayPlanPayload) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">Today&apos;s plan for {location.name}</CardTitle>
              <Badge variant={data.source === 'ai' ? 'default' : 'secondary'}>
                {data.source === 'ai' ? 'AI-personalised' : 'Standard checklist'}
              </Badge>
            </div>
            <CardDescription>{data.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <DoorOpen aria-hidden="true" className="size-4 text-primary" />
                  Ventilation window
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.ventilationWindow ?? 'None today — keep windows closed and filter instead.'}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CloudSun aria-hidden="true" className="size-4 text-primary" />
                  Best outdoor window
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.outdoorWindow ?? 'No good outdoor window today.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="plan-blocks-heading" className="space-y-4">
          <h3 id="plan-blocks-heading" className="sr-only">
            Schedule blocks
          </h3>
          <ol className="relative space-y-4 border-l pl-6">
            {data.blocks.map((block, index) => (
              <li key={`${block.time}-${index}`} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[31px] top-1.5 flex size-6 items-center justify-center rounded-full border bg-background"
                >
                  <CalendarClock className="size-3.5 text-primary" />
                </span>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {block.time}
                  </p>
                  <p className="mt-0.5 font-semibold">{block.title}</p>
                  <p className="mt-1.5 text-sm">{block.activity}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Why: </span>
                    {block.why}
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-muted/60 p-2.5 text-sm">
                    <Leaf aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{block.impact}</span>
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Extra tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.tips.map((tip, index) => (
                <li key={`${tip}-${index}`} className="flex items-start gap-2.5 text-sm">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Daily routine planner</h2>
          <p className="text-sm text-muted-foreground">
            A schedule that keeps your family moving while dodging the smog.
          </p>
        </div>
        <Button
          onClick={() => plan.mutate()}
          disabled={plan.isPending}
          className="min-h-11 gap-2"
        >
          {plan.isPending ? (
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="size-4" />
          )}
          {plan.isPending
            ? 'Building…'
            : plan.data
              ? 'Regenerate plan'
              : 'Generate my plan'}
        </Button>
      </div>

      {plan.isPending && (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <span className="sr-only">Generating your personalised plan…</span>
        </div>
      )}

      {plan.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plan generation failed</CardTitle>
            <CardDescription>
              The planner could not be reached. Your request limits reset in a
              few minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => plan.mutate()} className="min-h-11">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {plan.data && !plan.isPending && renderPlan(plan.data)}

      {!plan.data && !plan.isPending && !plan.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What you will get</CardTitle>
            <CardDescription>
              A full-day schedule tuned to measured air quality and your
              household: when to move, commute and cook, where the cleanest
              ventilation window sits, and the impact of each swap.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <span>
                  Built for <span className="font-medium text-foreground">{location.name}</span>{' '}
                  from the live hourly AQI forecast.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <span>
                  Personalised for {profile.children} child(ren), {profile.seniors}{' '}
                  senior(s) and your {profile.commuteMode} commute.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <span>Every block explains its reasoning and direct impact.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
