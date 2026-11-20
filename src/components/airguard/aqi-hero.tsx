'use client';

/**
 * AQI hero card: live index, category, dominant pollutant and a polite
 * aria-live announcement so screen readers hear updates without interrupt.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getCategory, timesWhoGuideline } from '@/lib/aqi';
import type { AirPayload } from '@/lib/client/api';

interface AqiHeroProps {
  air: AirPayload;
  place: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AqiHero({ air, place, isRefreshing, onRefresh }: AqiHeroProps) {
  const aqi = Math.round(air.current.usAqi);
  const category = getCategory(aqi);
  const pm25 = air.current.concentrations.pm25;
  const pm25Times = timesWhoGuideline('pm25', pm25);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="min-w-0">
          <p className="micro-label">Live reading · US EPA AQI</p>
          <p className="truncate text-sm font-medium text-foreground">{place}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh air quality data"
          className="min-h-9 shrink-0"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div
            aria-live="polite"
            aria-atomic="true"
            className="flex items-baseline gap-3"
          >
            <span className="sr-only">
              Air quality index {aqi}, category {category.label}.
            </span>
            <span
              aria-hidden="true"
              className="display-num text-7xl font-bold leading-none"
              style={{ color: category.color }}
            >
              {aqi}
            </span>
            <span aria-hidden="true" className="micro-label">
              US AQI
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex min-h-8 items-center rounded-md px-3 text-sm font-semibold"
              style={{ backgroundColor: category.color, color: category.foreground }}
            >
              {category.label}
            </span>
            {air.source === 'sample' ? (
              <span className="micro-label inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5">
                <AlertTriangle aria-hidden="true" className="size-3" />
                Demo data — live feed unreachable
              </span>
            ) : (
              <span className="micro-label inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-signal">
                <span
                  aria-hidden="true"
                  className="size-1.5 animate-pulse rounded-full bg-signal"
                />
                Live
              </span>
            )}
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground">{category.meaning}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t px-5 py-3">
        {pm25 !== null && pm25Times !== null && (
          <p className="text-sm">
            <span className="micro-label">PM2.5</span>{' '}
            <span className="font-mono font-medium tabular-nums text-foreground">
              {pm25} µg/m³
            </span>
            {pm25Times > 1 && (
              <span className="font-mono tabular-nums text-destructive">
                {' '}· {pm25Times.toFixed(1)}× WHO 24h
              </span>
            )}
          </p>
        )}
        <p className="text-sm">
          <span className="micro-label">Updated</span>{' '}
          <span className="font-mono tabular-nums text-foreground">
            {formatTime(air.current.time || air.fetchedAt)}
          </span>
        </p>
      </div>
    </Card>
  );
}
