'use client';

/**
 * Personalised advisory checklist. The bullets are deterministic
 * (src/lib/aqi.ts buildAdvisories) so the same AQI + profile always
 * produces the same, reviewable advice.
 */

import { HeartPulse } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buildAdvisories, describeProfile, type FamilyProfile } from '@/lib/aqi';

interface HealthAdvisoryProps {
  aqi: number;
  profile: FamilyProfile;
}

export function HealthAdvisory({ aqi, profile }: HealthAdvisoryProps) {
  const advisories = buildAdvisories(aqi, profile);
  const facts = describeProfile(profile).slice(0, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HeartPulse aria-hidden="true" className="size-5 text-destructive" />
          Your household advisory
        </CardTitle>
        <CardDescription>{facts.join(' — ')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {advisories.map((advisory) => (
            <li key={advisory} className="flex items-start gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
              />
              <span>{advisory}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          General guidance based on measured AQI — not a substitute for medical
          advice from your doctor.
        </p>
      </CardContent>
    </Card>
  );
}
