'use client';

/**
 * Sticky app header: brand, location picker trigger, household profile
 * trigger and theme toggle. All controls are real <button>s with
 * descriptive accessible names and 44px+ touch targets.
 */

import { useTheme } from 'next-themes';
import { MapPin, Moon, Sun, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/components/airguard/state';

interface HeaderProps {
  onOpenLocation: () => void;
  onOpenProfile: () => void;
}

export function Header({ onOpenLocation, onOpenProfile }: HeaderProps) {
  const { location, profile } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const sensitivePeople =
    profile.children + profile.seniors + (profile.respiratoryConditions ? 1 : 0);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 flex-col items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <span className="wordmark text-[11px] leading-none">AG</span>
          </div>
          <div className="min-w-0">
            <p className="wordmark truncate text-sm leading-tight text-foreground">
              Airguard<span className="text-signal">·</span>AI
            </p>
            <p className="micro-label truncate">
              Winter smog &amp; clean-air assistant
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenLocation}
          aria-haspopup="dialog"
          className="min-h-9 gap-2"
        >
          <MapPin className="size-4" aria-hidden="true" />
          <span className="max-w-36 truncate sm:max-w-52">{location.name}</span>
          <span className="sr-only">. Change location</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenProfile}
          aria-haspopup="dialog"
          className="min-h-9 gap-2"
          aria-label={`Household profile${
            sensitivePeople > 0 ? `, ${sensitivePeople} sensitive member(s)` : ''
          }. Open to edit`}
        >
          <UsersRound className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Household</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Sun aria-hidden="true" className="size-4 dark:hidden" />
          <Moon aria-hidden="true" className="size-4 hidden dark:block" />
        </Button>
      </div>
    </header>
  );
}
