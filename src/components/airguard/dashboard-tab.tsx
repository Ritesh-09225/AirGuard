'use client';

/**
 * Dashboard tab: AQI hero + personalised advisory, pollutant breakdown,
 * 24h forecast and quick-win CTAs into the AI features.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, MessageCircleHeart } from 'lucide-react';
import { useApp } from '@/components/airguard/state';
import { useAirData } from '@/components/airguard/hooks';
import { AqiHero } from '@/components/airguard/aqi-hero';
import { HealthAdvisory } from '@/components/airguard/health-advisory';
import { PollutantGrid } from '@/components/airguard/pollutant-grid';
import { ForecastChart } from '@/components/airguard/forecast-chart';
import { describeProfile } from '@/lib/aqi';

export interface DashboardTabProps {
  onGoToCoach: () => void;
  onGoToPlanner: () => void;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-56 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading air quality data…</span>
    </div>
  );
}

function AirError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Air data unavailable</CardTitle>
        <CardDescription>
          We could not reach the air quality service. Check your connection and
          try again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onRetry} className="min-h-11">
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardTab({ onGoToCoach, onGoToPlanner }: DashboardTabProps) {
  const { profile, location } = useApp();
  const { data: air, isPending, isError, refetch, isFetching } = useAirData();

  if (isPending) return <DashboardSkeleton />;
  if (isError || !air) return <AirError onRetry={() => refetch()} />;

  const placeLabel = [location.name, location.region || location.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <AqiHero
        air={air}
        place={placeLabel}
        isRefreshing={isFetching && !isPending}
        onRefresh={() => refetch()}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <HealthAdvisory aqi={air.current.usAqi} profile={profile} />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Act on today&apos;s air</CardTitle>
            <CardDescription>
              {describeProfile(profile).length} profile facts are applied to
              everything below — no need to repeat them.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={onGoToPlanner} className="min-h-11 justify-start gap-2">
              <CalendarCheck aria-hidden="true" className="size-4" />
              Build my low-emission day plan
            </Button>
            <Button
              onClick={onGoToCoach}
              variant="secondary"
              className="min-h-11 justify-start gap-2"
            >
              <MessageCircleHeart aria-hidden="true" className="size-4" />
              Ask the air coach
            </Button>
            <p className="text-xs text-muted-foreground">
              Both tools already know the live AQI, the hourly trend and your
              household profile.
            </p>
          </CardContent>
        </Card>
      </div>

      <PollutantGrid air={air} />
      <ForecastChart air={air} />
    </div>
  );
}
