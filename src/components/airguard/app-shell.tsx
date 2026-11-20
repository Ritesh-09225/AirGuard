'use client';

/**
 * Application shell: skip link, sticky header, tabbed main region and a
 * footer that sticks to the viewport bottom on short pages.
 */

import { useState } from 'react';
import { CalendarCheck, Gauge, MessagesSquare, Sprout } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/airguard/header';
import { LocationDialog } from '@/components/airguard/location-dialog';
import { ProfileDialog } from '@/components/airguard/profile-dialog';
import { DashboardTab } from '@/components/airguard/dashboard-tab';
import { CoachTab } from '@/components/airguard/coach-tab';
import { PlannerTab } from '@/components/airguard/planner-tab';
import { ActionsTab } from '@/components/airguard/actions-tab';

type TabKey = 'dashboard' | 'coach' | 'planner' | 'actions';

const TABS: Array<{ value: TabKey; label: string; icon: typeof Gauge }> = [
  { value: 'dashboard', label: 'Dashboard', icon: Gauge },
  { value: 'coach', label: 'AI Coach', icon: MessagesSquare },
  { value: 'planner', label: 'Daily Plan', icon: CalendarCheck },
  { value: 'actions', label: 'Actions & Impact', icon: Sprout },
];

function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-6xl px-4 py-5 text-xs leading-relaxed text-muted-foreground">
        <p className="micro-label">Airguard·AI — winter smog assistant for families &amp; communities</p>
        <p className="mt-1">
          Air data: Open-Meteo Air Quality API (US EPA AQI standard, WHO 2021
          guideline comparisons). Impact figures are transparent estimates from
          public averages. General guidance only — not medical advice.
        </p>
        <p className="mt-1">
          No accounts, no personal data stored: your household profile stays in
          this browser and conversations are keyed to an anonymous device UUID.
        </p>
      </div>
    </footer>
  );
}

export function AppShell() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [locationOpen, setLocationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function switchTab(next: string) {
    setTab(next as TabKey);
    // Keep context predictable: content starts at the top on tab change.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <Header
        onOpenLocation={() => setLocationOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />

      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Tabs value={tab} onValueChange={switchTab}>
          <TabsList
            aria-label="Application sections"
            className="mb-6 w-full justify-start"
          >
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-11 px-3 sm:flex-none sm:px-5"
              >
                <Icon aria-hidden="true" className="size-4" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <DashboardTab
              onGoToCoach={() => switchTab('coach')}
              onGoToPlanner={() => switchTab('planner')}
            />
          </TabsContent>
          <TabsContent value="coach" className="mt-0 focus-visible:outline-none">
            <CoachTab />
          </TabsContent>
          <TabsContent value="planner" className="mt-0 focus-visible:outline-none">
            <PlannerTab />
          </TabsContent>
          <TabsContent value="actions" className="mt-0 focus-visible:outline-none">
            <ActionsTab />
          </TabsContent>
        </Tabs>
      </main>

      <Footer />

      <LocationDialog open={locationOpen} onOpenChange={setLocationOpen} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
