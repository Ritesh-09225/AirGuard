'use client';

/**
 * App-wide client state: anonymous session id, selected location and the
 * household profile. Everything non-identifying persists in localStorage;
 * the server only ever sees a UUID session key and validated fields.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_PROFILE, type FamilyProfile } from '@/lib/aqi';
import type { LocationValue, ProfileValue } from '@/lib/validators';

const SESSION_KEY = 'airguard.sessionId';
const LOCATION_KEY = 'airguard.location';
const PROFILE_KEY = 'airguard.profile';

export const DEFAULT_LOCATION: LocationValue = {
  name: 'Delhi',
  region: 'National Capital Territory of Delhi',
  country: 'India',
  lat: 28.65195,
  lon: 77.23149,
};

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode); the app still works in-memory.
  }
}

function readOrCreateSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

interface AppContextValue {
  sessionId: string;
  location: LocationValue;
  setLocation: (location: LocationValue) => void;
  profile: ProfileValue;
  setProfile: (profile: ProfileValue) => void;
  /** True once localStorage has been read (avoids hydration mismatches). */
  hydrated: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState('');
  const [location, setLocationState] = useState<LocationValue>(DEFAULT_LOCATION);
  const [profile, setProfileState] = useState<ProfileValue>(
    DEFAULT_PROFILE as unknown as ProfileValue,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydration from an external store (localStorage): must happen after
    // mount to keep SSR markup deterministic. One-time, single effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(readOrCreateSessionId());
    setLocationState(readJson<LocationValue>(LOCATION_KEY) ?? DEFAULT_LOCATION);
    setProfileState(readJson<ProfileValue>(PROFILE_KEY) ?? (DEFAULT_PROFILE as unknown as ProfileValue));
    setHydrated(true);
  }, []);

  const setLocation = useCallback((next: LocationValue) => {
    setLocationState(next);
    writeJson(LOCATION_KEY, next);
  }, []);

  const setProfile = useCallback((next: ProfileValue) => {
    setProfileState(next);
    writeJson(PROFILE_KEY, next);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ sessionId, location, setLocation, profile, setProfile, hydrated }),
    [sessionId, location, setLocation, profile, setProfile, hydrated],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Convenience: shared query key factory for air data. */
export const airQueryKey = (lat: number, lon: number) => ['air', lat.toFixed(3), lon.toFixed(3)] as const;

export type { FamilyProfile };
