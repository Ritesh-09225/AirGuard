'use client';

/**
 * 24-hour AQI forecast area chart (recharts) with a screen-reader data
 * table alternative. The chart container is a labelled figure; the hidden
 * table carries the exact values for assistive technology.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatHour, getCategory } from '@/lib/aqi';
import type { AirPayload } from '@/lib/client/api';

interface ForecastChartProps {
  air: AirPayload;
}

interface ChartPoint {
  hour: number;
  label: string;
  aqi: number;
  category: string;
}

function buildSeries(air: AirPayload): ChartPoint[] {
  return air.hourly.slice(0, 24).map((point) => ({
    hour: point.hour,
    label: formatHour(point.hour),
    aqi: point.aqi,
    category: getCategory(point.aqi).label,
  }));
}

interface TooltipPayloadItem {
  payload: ChartPoint;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{point.label}</p>
      <p className="tabular-nums">
        AQI {point.aqi} — {point.category}
      </p>
    </div>
  );
}

export function ForecastChart({ air }: ForecastChartProps) {
  const series = buildSeries(air);
  if (series.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hourly forecast</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Hourly forecast data is unavailable right now.
        </CardContent>
      </Card>
    );
  }

  const max = Math.max(...series.map((s) => s.aqi), 100);
  const cleanest = series.reduce((a, b) => (b.aqi < a.aqi ? b : a));
  const summary = `Hourly air quality forecast for the next 24 hours. It ranges from ${Math.min(
    ...series.map((s) => s.aqi),
  )} around ${cleanest.label} to ${max} at the worst hour.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Next 24 hours</CardTitle>
        <CardDescription>
          Plan outdoor activity and ventilation around the dips. Dashed line:
          US AQI 100 (upper edge of Moderate).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <figure
          role="img"
          aria-label={summary}
          className="h-56 w-full sm:h-64"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--signal)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--signal)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickMargin={6}
                minTickGap={28}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                domain={[0, Math.ceil(max / 50) * 50 + 25]}
                tick={{ fontSize: 11 }}
                width={36}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)' }} />
              <ReferenceLine
                y={100}
                stroke="var(--muted-foreground)"
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
              />
              <Area
                type="monotone"
                dataKey="aqi"
                stroke="var(--signal)"
                strokeWidth={2}
                fill="url(#aqiFill)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </figure>

        {/* Screen-reader alternative: exact hourly values. Wrapped in a
            sr-only div because a table's intrinsic min-content width defeats
            the 1px sizing of sr-only and would stretch the page. */}
        <div className="sr-only">
          <table>
            <caption>Hourly air quality index forecast values</caption>
            <thead>
              <tr>
                <th scope="col">Hour</th>
                <th scope="col">US AQI</th>
                <th scope="col">Category</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.hour}>
                  <th scope="row">{point.label}</th>
                  <td>{point.aqi}</td>
                  <td>{point.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
