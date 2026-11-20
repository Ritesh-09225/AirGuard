'use client';

/**
 * Location search dialog: debounced city search against /api/geocode,
 * plus optional device GPS. Selection updates global state + localStorage.
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { searchCities } from '@/lib/client/api';
import { useApp } from '@/components/airguard/state';
import type { LocationValue } from '@/lib/validators';

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationDialog({ open, onOpenChange }: LocationDialogProps) {
  const { setLocation } = useApp();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search input (350 ms) to keep request volume low.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery({
    queryKey: ['geocode', debounced],
    queryFn: ({ signal }) => searchCities(debounced, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
  });

  function choose(result: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
  }) {
    const location: LocationValue = {
      name: result.name,
      region: result.region ?? '',
      country: result.country ?? '',
      lat: result.lat,
      lon: result.lon,
    };
    setLocation(location);
    onOpenChange(false);
    toast.success(`Now watching air quality for ${result.name}`);
  }

  function useDeviceLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('This browser does not support location detection.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        setLocation({
          name: 'My location',
          region: '',
          country: '',
          lat: Number(position.coords.latitude.toFixed(4)),
          lon: Number(position.coords.longitude.toFixed(4)),
        });
        onOpenChange(false);
        toast.success('Using your current location');
      },
      () => {
        setGeoLoading(false);
        toast.error('Location permission denied. Search for your city instead.');
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your location</DialogTitle>
          <DialogDescription>
            Advice, routines and impact estimates are tuned to local air quality.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const first = results.data?.results[0];
            if (first) choose(first);
          }}
        >
          <label htmlFor="city-search" className="sr-only">
            Search for a city
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="city-search"
              ref={inputRef}
              type="search"
              placeholder="Search a city, e.g. Delhi, Lahore, Beijing"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              className="min-h-11 pl-9"
              aria-describedby="city-search-status"
            />
          </div>
          <p id="city-search-status" className="mt-2 min-h-5 text-sm text-muted-foreground" aria-live="polite">
            {debounced.length < 2
              ? 'Type at least 2 characters to search.'
              : results.isPending
                ? 'Searching…'
                : results.isError
                  ? 'Search is unavailable right now.'
                  : `${results.data.results.length} result(s) found.`}
          </p>
        </form>

        <div className="max-h-64 overflow-y-auto rounded-lg border" role="listbox" aria-label="Search results">
          {results.isPending && debounced.length >= 2 ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : results.data && results.data.results.length > 0 ? (
            <ul className="divide-y">
              {results.data.results.map((result) => {
                const key = `${result.name}-${result.lat}-${result.lon}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => choose(result)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{result.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[result.region, result.country].filter(Boolean).join(', ')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : debounced.length >= 2 && results.data ? (
            <p className="p-4 text-sm text-muted-foreground">
              No cities matched. Try a different spelling.
            </p>
          ) : null}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={useDeviceLocation}
            disabled={geoLoading}
            className="min-h-11"
          >
            <LocateFixed aria-hidden="true" className="size-4" />
            {geoLoading ? 'Detecting…' : 'Use my location'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
