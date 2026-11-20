'use client';

/**
 * Shared client data hooks built on TanStack Query. Centralises caching,
 * polling intervals and abort handling so tabs stay consistent.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  commitAction,
  fetchAir,
  fetchCommitments,
  uncommitAction,
} from '@/lib/client/api';
import { airQueryKey, useApp } from '@/components/airguard/state';

/** Live + forecast air data for the selected location (10 min polling). */
export function useAirData() {
  const { location, hydrated } = useApp();
  return useQuery({
    queryKey: airQueryKey(location.lat, location.lon),
    queryFn: ({ signal }) => fetchAir(location.lat, location.lon, signal),
    enabled: hydrated,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    refetchIntervalInBackground: false,
  });
}

/** Committed action ids for the current anonymous session. */
export function useCommitments() {
  const { sessionId, hydrated } = useApp();
  return useQuery({
    queryKey: ['commitments', sessionId],
    queryFn: ({ signal }) => fetchCommitments(sessionId, signal),
    enabled: hydrated && sessionId !== '',
    staleTime: 60_000,
  });
}

/** Commit / un-commit toggles with optimistic update + rollback on error. */
export function useCommitmentToggle() {
  const { sessionId } = useApp();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['commitments', sessionId] });

  const commit = useMutation({
    mutationFn: (actionId: string) => commitAction(sessionId, actionId),
    onError: () => invalidate(),
    onSuccess: invalidate,
  });

  const uncommit = useMutation({
    mutationFn: (actionId: string) => uncommitAction(sessionId, actionId),
    onError: () => invalidate(),
    onSuccess: invalidate,
  });

  return {
    toggle: (actionId: string, next: boolean) =>
      next ? commit.mutate(actionId) : uncommit.mutate(actionId),
    isPending: commit.isPending || uncommit.isPending,
  };
}
