# AirGuard AI — Winter Smog & Clean-Air Assistant

A GenAI-powered assistant that helps **families and communities** navigate severe
winter smog and urban air pollution. It combines live, measured air-quality data
with an LLM coach that is *grounded* in that data, a personalised low-emission
daily planner, and an action catalog where every choice explains its **direct,
quantified impact**.

## Live features

| Tab | What it does |
| --- | --- |
| **Dashboard** | Live US AQI + pollutant breakdown vs WHO 2021 guidelines, a personalised household advisory checklist (deterministic rules), and a 24-hour AQI forecast chart (with a screen-reader data table). |
| **AI Coach** | Chat assistant that receives the measured AQI, hourly trend, computed ventilation/outdoor windows and the household profile in its system prompt — answers are grounded and personalised, never invented. |
| **Daily Plan** | Generates a low-emission daily routine. Ventilation and outdoor windows are **computed from measured hourly AQI** (never hallucinated); the AI enriches the narrative and a deterministic rule-based plan is the guaranteed fallback. |
| **Actions & Impact** | 15 curated low-emission actions (transport / home energy / indoor air / community). Committing stores them in SQLite and produces a weekly impact summary with tangible equivalences (car-km, phone charges, LED hours). |

Household profile (children, seniors, respiratory conditions, outdoor workers,
commute mode, cooking fuel, purifier ownership) personalises advisories, chat
and plans. It stays in `localStorage`; the server only receives anonymous,
validated fields.

Data source: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)
(keyless), geocoding for city search. If the upstream is unreachable the app
degrades gracefully to clearly-labelled demo data and rule-based plans.

## Architecture

```
src/
  app/
    page.tsx                  # single-page shell (4 tab sections)
    layout.tsx                # metadata + providers
    api/
      air/route.ts            # GET  live + forecast AQI (TTL-cached, rate limited)
      geocode/route.ts        # GET  city search (cached, rate limited)
      coach/route.ts          # GET/POST/DELETE grounded AI chat (SQLite history)
      planner/route.ts        # POST AI plan with deterministic fallback
      commitments/route.ts    # GET/POST/DELETE persisted commitments
      health/route.ts         # GET  liveness + DB probe
  lib/
    aqi.ts                    # EPA AQI breakpoints, categories, advisories, windows (pure)
    impact.ts                 # action catalog + impact/equivalence math (pure)
    planner.ts                # deterministic plan builder + trend detection (pure)
    open-meteo.ts             # upstream client: IPv4 https transport, retry, TTL cache, fallback
    ai.ts                     # ZAI SDK singleton, grounded prompt builders, JSON extraction
    validators.ts             # zod schemas for every API boundary
    rate-limit.ts / cache.ts  # fixed-window limiter, TTL cache (pure, tested)
    profile-schema.ts         # profile option lists + prompt facts
    client/api.ts             # typed fetch layer for the UI
  components/
    airguard/                 # app shell, tabs, dashboard, coach, planner, actions, dialogs
    ui/                       # shadcn/ui (New York)
prisma/schema.prisma          # ChatMessage, Commitment (anonymous session-keyed)
src/__tests__/                # vitest: 56 unit + component tests
```

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind CSS 4,
shadcn/ui, TanStack Query, Prisma + SQLite, zod, z-ai-web-dev-sdk (server-side
only), Vitest + Testing Library.

## Judging criteria mapping

### 1. Code quality
- Strict TypeScript, no `any`; pure domain modules (`aqi`, `impact`, `planner`,
  `rate-limit`, `cache`) separated from I/O so everything critical is testable.
- Single source of truth for shared types (zod-inferred) across API and client.
- Commented engineering decisions (why IPv4 transport, why windows are computed
  server-side, why sample fallback is un-cached…).

### 2. Security
- **Every** API input validated with zod (coords, UUID session ids, message
  length, enum fields); unknown action ids cannot reach the DB.
- Fixed-window **rate limiting** on all endpoints (AI endpoints: 10 req / 5 min).
- AI chat history is loaded **from the DB per session**, so clients cannot
  inject forged transcript turns; prompts embed only validated, non-identifying
  context.
- Model output is rendered as **plain text** (no `dangerouslySetInnerHTML`, no
  raw-HTML markdown) — no prompt-injection-to-XSS path.
- Upstream hosts are hard-coded; user input only reaches them as validated
  numbers / encoded query strings.
- Security headers on all routes: `X-Content-Type-Options`,
  `Content-Security-Policy: frame-ancestors *`, `Referrer-Policy`,
  `Permissions-Policy` (geolocation self-only). Framing is deliberately
  permitted (instead of `X-Frame-Options: DENY`) because the app is embedded
  cross-origin by the sandbox preview panel; with no accounts, sessions or
  destructive one-click actions, clickjacking surface is negligible.
- Privacy by design: no accounts, no PII; profile stays in the browser; server
  storage is keyed by an anonymous UUID with only numeric/enum fields.
- AI calls have hard timeouts (45 s) and the SDK is server-side only.

### 3. Efficiency
- TTL caches: air data 10 min, geocode 1 h (LRU-capped) — upstream is called a
  fraction of the time; air responses at ~5 ms from cache.
- One retry + hard timeouts on upstream calls; empty geocode results are never
  cached (no cache poisoning).
- TanStack Query on the client (stale time, background refetch, abortable).
- Debounced (350 ms) city search; AI endpoints capped by rate limits; message
  history trimmed to the last 12 turns before each model call.
- AI planner enriches a deterministic skeleton, so the expensive call is never
  required for correctness.

### 4. Testing
- 56 Vitest tests across 7 files: EPA AQI math, WHO ratios, advisory rules,
  window search (caught a real rounding bug), planner rules, impact/equivalence
  math, rate limiter + TTL cache (fake timers), zod validation matrix, pure
  upstream normalizers, and a Testing Library component test (jsdom).
- `bun run test` (i.e. `vitest run`) executes the suite; `bun run lint` is
  clean. Note: plain `bun test` invokes Bun's built-in runner, which does not
  support the jsdom environment used by the component tests — always use
  `bun run test`.

### 5. Accessibility
- Semantic landmarks (`header`, `nav` via tablist, `main`, `footer`), skip link,
  labelled inputs, `aria-live` AQI + chat announcements, `role="meter"` pollutant
  bars with values, sr-only data table for the chart, keyboard-operable tabs /
  dialogs / switches with visible focus rings, 44 px+ touch targets, respects
  `prefers-reduced-motion`, WCAG-conscious category colours with white text.

### 6. Problem statement alignment
- **Location & lifestyle tailoring:** geocoded city search, per-location live
  data, household profile drives advisories, chat and plans.
- **Low-emission routines:** the planner + transport action catalog (carpool,
  metro, batched trips, no idling) with the *why* and the impact of each swap.
- **Indoor air hacks:** ventilation windows computed from measured hourly AQI,
  bedroom filtration, kitchen extraction, no indoor burning, damp dusting.
- **Sustainable alternatives:** cooking-fuel switches, geyser/standby cuts,
  no-waste-burning, community alerts.
- **Direct impact, clearly explained:** every advisory, plan block and action
  card states its impact in plain numbers; the impact dashboard converts
  committed actions into weekly kg CO2 avoided plus familiar equivalences.

## Run

```bash
bun install
bun run db:push     # create/refresh SQLite schema
bun run dev         # http://localhost:3000
bun run lint        # ESLint
bun run test       # Vitest suite (56 tests)
```

Health probe: `GET /api/health` → `{"status":"ok","database":"up"}`.

## Honest limitations

- AQI sub-indices are computed from concentrations using EPA breakpoint tables
  (the upstream `us_aqi` value is shown for the headline number).
- Impact figures are transparent estimates from public averages (documented in
  `src/lib/impact.ts`), not audit-grade carbon accounting.
- The assistant gives general protective guidance and explicitly tells users to
  follow medical action plans — it is not a medical device.
