'use client';

/**
 * Actions & impact tab: the commitment catalog with quantified, explained
 * impact, plus a live weekly impact summary with tangible equivalences.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Bike,
  Car,
  Filter,
  Flame,
  HandHeart,
  Leaf,
  Plug,
  Smartphone,
  Lightbulb,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ACTION_CATALOG,
  CATEGORY_META,
  summarizeCommitments,
  type ActionCategory,
} from '@/lib/impact';
import { useApp } from '@/components/airguard/state';
import { useCommitments, useCommitmentToggle } from '@/components/airguard/hooks';

const CATEGORY_ICONS: Record<ActionCategory, typeof Bike> = {
  transport: Car,
  'home-energy': Plug,
  'indoor-air': Filter,
  community: Users,
};

type CategoryFilter = 'all' | ActionCategory;

const FILTERS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'transport', label: CATEGORY_META.transport.label },
  { key: 'home-energy', label: CATEGORY_META['home-energy'].label },
  { key: 'indoor-air', label: CATEGORY_META['indoor-air'].label },
  { key: 'community', label: CATEGORY_META.community.label },
];

function ImpactSummary({ committedIds }: { committedIds: string[] }) {
  const summary = summarizeCommitments(committedIds);

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
          Your weekly impact
        </CardTitle>
        <CardDescription>
          {summary.count === 0
            ? 'Commit to actions below and this panel adds up your household\u2019s direct impact.'
            : `${summary.count} committed action${summary.count > 1 ? 's' : ''} — estimated weekly effect if you keep them up.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border p-3">
            <dt className="text-xs text-muted-foreground">CO2 avoided</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.totalWeeklyCo2Kg} kg
            </dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="text-xs text-muted-foreground">Shield points</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.totalPoints}
            </dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="text-xs text-muted-foreground">Exposure cuts</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.exposureActions}
            </dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="text-xs text-muted-foreground">Best cut</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.bestExposureCutPct}%
            </dd>
          </div>
        </dl>

        {summary.totalWeeklyCo2Kg > 0 && (
          <div className="mt-4 space-y-2 rounded-xl bg-muted/60 p-4 text-sm">
            <p className="font-medium">What that feels like</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Car aria-hidden="true" className="size-4 shrink-0 text-primary" />
                Like skipping {summary.equivalences.carKmAvoided} km of car travel this week
              </li>
              <li className="flex items-center gap-2">
                <Smartphone aria-hidden="true" className="size-4 shrink-0 text-primary" />
                Or {summary.equivalences.phoneCharges} full smartphone charges
              </li>
              <li className="flex items-center gap-2">
                <Lightbulb aria-hidden="true" className="size-4 shrink-0 text-primary" />
                Or {summary.equivalences.ledHours} hours of a 10 W LED bulb
              </li>
            </ul>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Estimates use public averages (car ~160 g CO2/km, India grid ~0.71 kg
          CO2/kWh, NIOSH N95 filtration). They are honest approximations for
          behaviour change, not carbon accounting.
        </p>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  actionId,
  committed,
  onToggle,
  togglePending,
}: {
  actionId: string;
  committed: boolean;
  onToggle: (id: string, next: boolean) => void;
  togglePending: boolean;
}) {
  const action = ACTION_CATALOG.find((a) => a.id === actionId);
  if (!action) return null;

  const Icon = CATEGORY_ICONS[action.category];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary"
          >
            <Icon className="size-4.5 text-primary" />
          </div>
          <Switch
            checked={committed}
            onCheckedChange={(next) => onToggle(action.id, next)}
            disabled={togglePending}
            aria-label={`${committed ? 'Remove commitment to' : 'Commit to'} ${action.title}`}
          />
        </div>
        <CardTitle className="text-base leading-snug">{action.title}</CardTitle>
        <CardDescription className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="secondary" className="gap-1">
            <Flame aria-hidden="true" className="size-3" />
            {action.difficulty === 'easy' ? 'Easy' : 'Medium'}
          </Badge>
          <Badge variant="secondary">{action.cost === 'free' ? 'Free' : 'Low-cost'}</Badge>
          {action.exposureCutPct > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Leaf aria-hidden="true" className="size-3" />
              Up to {action.exposureCutPct}% less exposure
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <p className="text-sm text-muted-foreground">{action.why}</p>
        <p className="rounded-lg bg-muted/60 p-2.5 text-sm">
          <span className="font-medium">Direct impact: </span>
          {action.impact}
        </p>
        {committed && (
          <p className="flex items-center gap-2 text-sm font-medium text-primary" role="status">
            <HandHeart aria-hidden="true" className="size-4" />
            Committed — counted in your weekly impact
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ActionsTab() {
  const { sessionId, hydrated } = useApp();
  const commitments = useCommitments();
  const { toggle, isPending } = useCommitmentToggle();
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const committedIds = commitments.data?.commitments.map((c) => c.actionId) ?? [];
  const committedSet = new Set(committedIds);

  function handleToggle(actionId: string, next: boolean) {
    toggle(actionId, next);
    toast[next ? 'success' : 'message'](
      next ? 'Committed — every week counts.' : 'Commitment removed.',
    );
  }

  const visible = ACTION_CATALOG.filter(
    (action) => filter === 'all' || action.category === filter,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Actions &amp; impact</h2>
        <p className="text-sm text-muted-foreground">
          Pick low-emission swaps for your week. Every card explains exactly
          what changes when you keep the habit.
        </p>
      </div>

      {commitments.isPending && hydrated ? (
        <Skeleton className="h-44 w-full rounded-xl" aria-hidden="true" />
      ) : (
        <ImpactSummary committedIds={committedIds} />
      )}

      <div role="group" aria-label="Filter actions by category" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.key)}
              className={`min-h-9 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((action) => (
          <ActionCard
            key={action.id}
            actionId={action.id}
            committed={committedSet.has(action.id)}
            onToggle={handleToggle}
            togglePending={isPending}
          />
        ))}
      </div>

      {commitments.isError && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="text-sm text-muted-foreground">
              Commitments could not be loaded — switching an action on will
              retry automatically.
            </p>
            <Button variant="outline" onClick={() => commitments.refetch()} className="min-h-11">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
