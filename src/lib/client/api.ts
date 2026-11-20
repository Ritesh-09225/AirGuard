/**
 * Typed client-side API access layer.
 *
 * Every call: relative path only, JSON in/out, explicit result types shared
 * with the server via zod-inferred types. No dynamic URLs built from user
 * strings (geocode query is the sole exception and is encodeURIComponent'd).
 */

import type { LocationValue, ProfileValue } from '@/lib/validators';

export interface AirPayload {
  location: { lat: number; lon: number };
  current: {
    time: string;
    usAqi: number;
    concentrations: {
      pm25: number | null;
      pm10: number | null;
      no2: number | null;
      o3: number | null;
      so2: number | null;
      co: number | null;
    };
  };
  hourly: Array<{ time: string; hour: number; aqi: number }>;
  timezone: string;
  source: 'live' | 'sample';
  fetchedAt: string;
}

export interface GeocodeResponse {
  results: Array<{
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
  }>;
}

export interface CoachReply {
  reply: string;
  replyId: string;
  context: {
    aqi: number;
    place: string;
    ventilationWindow: string | null;
    outdoorWindow: string | null;
  };
}

export interface ChatHistoryItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface DayPlanPayload {
  summary: string;
  ventilationWindow: string | null;
  outdoorWindow: string | null;
  blocks: Array<{
    time: string;
    title: string;
    activity: string;
    why: string;
    impact: string;
  }>;
  tips: string[];
  source: 'ai' | 'rules';
}

export interface CommitmentsResponse {
  commitments: Array<{ actionId: string; committedAt: string }>;
}

export interface CommitmentResult {
  committed?: string;
  removed?: string;
  committedAt?: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Uniform JSON POST helper with typed error extraction. */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export async function fetchAir(lat: number, lon: number, signal?: AbortSignal): Promise<AirPayload> {
  const response = await fetch(
    `/api/air?lat=${encodeURIComponent(lat.toString())}&lon=${encodeURIComponent(lon.toString())}`,
    { signal },
  );
  if (!response.ok) {
    throw new ApiError('Air data unavailable', response.status);
  }
  return (await response.json()) as AirPayload;
}

export async function searchCities(q: string, signal?: AbortSignal): Promise<GeocodeResponse> {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal });
  if (!response.ok) {
    throw new ApiError('Search unavailable', response.status);
  }
  return (await response.json()) as GeocodeResponse;
}

export async function askCoach(
  input: { sessionId: string; message: string; location: LocationValue; profile: ProfileValue },
): Promise<CoachReply> {
  return postJson<CoachReply>('/api/coach', input);
}

export async function fetchCoachHistory(
  sessionId: string,
  signal?: AbortSignal,
): Promise<{ messages: ChatHistoryItem[] }> {
  const response = await fetch(
    `/api/coach?sessionId=${encodeURIComponent(sessionId)}`,
    { signal },
  );
  if (!response.ok) throw new ApiError('History unavailable', response.status);
  return (await response.json()) as { messages: ChatHistoryItem[] };
}

export async function clearCoachHistory(sessionId: string): Promise<void> {
  await fetch(`/api/coach?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}

export async function generatePlan(
  input: { location: LocationValue; profile: ProfileValue },
): Promise<DayPlanPayload> {
  return postJson<DayPlanPayload>('/api/planner', input);
}

export async function fetchCommitments(
  sessionId: string,
  signal?: AbortSignal,
): Promise<CommitmentsResponse> {
  const response = await fetch(
    `/api/commitments?sessionId=${encodeURIComponent(sessionId)}`,
    { signal },
  );
  if (!response.ok) throw new ApiError('Commitments unavailable', response.status);
  return (await response.json()) as CommitmentsResponse;
}

export async function commitAction(
  sessionId: string,
  actionId: string,
): Promise<CommitmentResult> {
  return postJson<CommitmentResult>('/api/commitments', { sessionId, actionId });
}

export async function uncommitAction(
  sessionId: string,
  actionId: string,
): Promise<CommitmentResult> {
  const response = await fetch('/api/commitments', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, actionId }),
  });
  if (!response.ok) throw new ApiError('Could not update', response.status);
  return (await response.json()) as CommitmentResult;
}
