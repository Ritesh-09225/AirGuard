'use client';

/**
 * Pollutant breakdown grid: concentration vs WHO 2021 guideline with a
 * semantic <meter>-style progress indicator per pollutant.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  POLLUTANT_META,
  POLLUTANT_KEYS,
  timesWhoGuideline,
} from '@/lib/aqi';
import type { AirPayload } from '@/lib/client/api';

/** How full the WHO-ratio meter should render (capped for display). */
function meterPercent(value: number | null): number {
  if (value === null) return 0;
  return Math.min(100, Math.round((value / 4) * 100));
}

export function PollutantGrid({ air }: { air: AirPayload }) {
  const concentrations = air.current.concentrations;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pollutant breakdown</CardTitle>
        <CardDescription>
          Measured concentrations compared with WHO 2021 guideline levels
          (meter caps at 4× the guideline).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POLLUTANT_KEYS.map((key) => {
            const value = concentrations[key];
            const times = timesWhoGuideline(key, value);
            const meta = POLLUTANT_META[key];
            const over = times !== null && times > 1;
            return (
              <li key={key} className="rounded-md border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium" title={meta.full}>
                    {meta.label}
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    {value === null ? (
                      <span className="text-muted-foreground">N/A</span>
                    ) : (
                      <>
                        <span className="text-lg font-semibold">{value}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {meta.unit}
                        </span>
                      </>
                    )}
                  </span>
                </div>

                {times !== null && (
                  <p
                    className={`mt-1 font-mono text-xs font-medium tabular-nums ${
                      over ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {times.toFixed(1)}× WHO guideline
                  </p>
                )}

                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-valuenow={times ?? 0}
                  aria-label={`${meta.label} relative to WHO guideline: ${
                    times === null ? 'no data' : `${times.toFixed(1)} times`
                  }`}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${meterPercent(times)}%`,
                      backgroundColor: over
                        ? 'var(--destructive)'
                        : 'var(--primary)',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
