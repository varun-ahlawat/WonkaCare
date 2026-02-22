# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run start            # Run production server
npm run lint             # Lint with ESLint
npx tsx scripts/setup-vapi.ts  # One-time Vapi phone number provisioning
npx tsx scripts/setup-db.ts   # One-time Supabase schema creation (run after setting DATABASE_URL)
```

## Cloud / Serverless Compatibility

**Partial — with a critical caveat.**

- Next.js has built-in serverless support and is natively deployable to Vercel, AWS Lambda@Edge, Google Cloud Run, etc. The `.gitignore` references `.vercel`, indicating Vercel is the intended deployment target.
- **However, the `LiveCallStore` (`src/lib/live-calls.ts`) is an in-memory EventEmitter singleton.** This is incompatible with:
  - True serverless environments (instance is cold-started per request, state is lost)
  - Multi-replica deployments (each replica has a separate store; SSE streams won't see calls handled by a different replica)
- The SSE endpoint (`GET /api/calls/stream`) depends on this in-memory store.
- **For a single-instance deployment** (e.g., one Cloud Run container with min-instances=1), it works fine.
- **To make it truly serverless/horizontally scalable**, the `LiveCallStore` would need to be replaced with a pub/sub layer (e.g., Redis Pub/Sub, Supabase Realtime, or Pusher).

## What This Is

**Meredith** is a real-time medical triage and analytics dashboard backed by a Vapi AI voice agent. Incoming patient phone calls are handled by the AI voice agent; this dashboard lets triage operators monitor live calls, view AI-extracted summaries, and manage routing. It also includes a doctor portal and an epidemiological outbreak detection panel.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5 |
| UI | React 19.2.3 |
| Styling | Tailwind CSS 4 + PostCSS |
| Charts | Recharts 3.7.0 |
| AI / LLM | Google Generative AI (`@google/generative-ai`) — Gemini 2.0 Flash |
| Voice API | Vapi AI (`@vapi-ai/server-sdk`) |
| Real-time | Server-Sent Events (SSE) + Node.js EventEmitter |

## Architecture

### Pages

| Route | Purpose |
|---|---|
| `/` | **Triage Dashboard** — live call monitoring, call history, status filtering, transcript view, call redirection |
| `/doctor` | **Doctor Portal** — patient list with search/filter, patient profiles |
| `/doctor/patients/[id]` | Individual patient detail: medical history, appointment timeline, test results |
| `/analytics` | **Epidemiological Surveillance** — K-Means symptom clusters, geographic hotspot map, symptom velocity, outbreak alerts |
| `/calls/[id]` | Full transcript viewer for a completed call |

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/vapi` | POST | Webhook receiver for Vapi call lifecycle events (transcript chunks, status changes, end-of-call reports) |
| `/api/calls/stream` | GET | SSE stream — pushes live call state to the triage dashboard |

### Data Flow

```
Incoming Patient Call
       ↓
   [Vapi Platform]
       ↓
POST /api/vapi  (webhook)
       ↓
LiveCallStore  (in-memory EventEmitter singleton)
  ├── accumulates transcript chunks
  └── calls Gemini for AI summary/triage extraction
       ↓
emits "update" events
       ↓
GET /api/calls/stream  (SSE)
       ↓
useLiveCalls() hook  (React client)
       ↓
Triage Dashboard UI (live updates)
```

### Repository Structure

```
src/
├── app/
│   ├── layout.tsx                       # Root layout + theme provider
│   ├── page.tsx                         # Triage Dashboard (main view)
│   ├── analytics/page.tsx               # Epidemiological early warning system
│   ├── doctor/page.tsx                  # Doctor dashboard + patient list
│   ├── doctor/patients/[id]/page.tsx    # Patient detail
│   ├── calls/[id]/page.tsx              # Call transcript viewer
│   ├── api/vapi/route.ts                # Vapi webhook handler
│   ├── api/calls/stream/route.ts        # SSE live call stream
│   ├── app-shell.tsx                    # App shell wrapper
│   └── globals.css                      # Global styles + theme variables
├── lib/
│   ├── live-calls.ts                    # LiveCallStore — in-memory call state + AI summarization
│   ├── gemini.ts                        # Google Generative AI (Gemini 2.0 Flash) client
│   ├── mock-call-logs.ts                # Mock call & transcript data for demo
│   ├── accounts.ts                      # Multi-role account system (triage, doctor, receptionist)
│   ├── doctor-data.ts                   # Mock patient data + medical history
│   ├── epi-data.ts                      # Epidemiological cluster simulation data
│   ├── format.ts                        # Time/duration formatters
│   └── theme.tsx                        # Dark/light theme provider
├── hooks/
│   └── use-live-calls.ts                # React hook — consumes SSE stream
└── components/
    ├── ui/                              # Primitive UI components (badge, button, card, modal, etc.)
    ├── settings-modal.tsx               # Settings / Vapi config modal
    ├── account-switcher.tsx             # Role switcher
    ├── analytics-panel.tsx              # Analytics UI panel
    └── doctor/                          # Doctor portal components (patient-list, timeline, test-results, etc.)
scripts/
└── setup-vapi.ts                        # One-time: provision Vapi phone number + configure webhooks
```

## Supabase Persistence

**Tables** (created by `scripts/setup-db.ts`):

| Table | Purpose |
|---|---|
| `patients` | Patient profiles — demographics, allergies, conditions, medications, prior episodes. Matches `Patient` + `MedicalHistory` interfaces. |
| `calls` | One row per Vapi call — transcript (JSONB), AI summary fields, status, triage level, FK to `patients`. |
| `encounters` | One per call; linked to patient and call. Matches `Encounter` interface (symptoms with severity/onset). |
| `timeline_events` | Append-only audit trail per patient. Matches `TimelineEvent` interface. |
| `doctor_notes` | Matches `DoctorNote` interface. |
| `test_results` | Matches `TestResult` interface (results as JSONB array). |

**DB client** (`src/lib/db.ts`):
- Singleton `postgres.Sql` client stored on `globalThis.__dbSql__`. Uses `prepare: false` (required for Supabase Supavisor transaction-mode pooler on port 6543).
- `upsertCall` — insert-or-update call record (called on call start and each Gemini cycle).
- `finalizeCall` — sets `ended_at`, `duration_sec`, final AI fields, and `patient_id` on call end.
- `upsertPatient` — find-by-phone or create. On update, arrays (conditions, medications, allergies) are merged: non-empty Gemini output wins, otherwise existing DB values are kept.
- `createEncounter` / `createTimelineEvent` — appended once per call on `end-of-call-report`.

**End-of-call pipeline** (`src/app/api/vapi/route.ts` → `processEndOfCall`):
1. Captures the in-memory `LiveCall` before `endCall()` removes it.
2. Fires `extractCallProfile()` (Gemini, comprehensive prompt) on the full transcript.
3. `upsertPatient` — finds patient by caller phone, creates if new.
4. `finalizeCall` — writes complete AI analysis + `patient_id` to `calls` table.
5. `createEncounter` — creates encounter record with structured symptom severity/onset.
6. `createTimelineEvent` — appends `type: 'call'` event to patient timeline.
7. All of this runs fire-and-forget; the webhook returns 200 immediately.

## Key Modules

### `src/lib/live-calls.ts` — LiveCallStore
- Singleton `EventEmitter` holding all active and recent calls in memory. Stored on `globalThis` under `__liveCallStore__` to survive Next.js hot-module reloads in dev.
- Receives transcript chunks and status updates from the Vapi webhook.
- Calls Gemini on each transcript update with a **3-second debounce** to extract triage level, chief complaint, and recommended action.
- Fires `"update"` events consumed by the SSE endpoint. Event union type is `LiveCallEvent`.
- `getAll()` only returns calls with `status === 'Live'`; ended calls are deleted after a 5-second delay.

### `src/lib/gemini.ts` — Gemini Integration
- Uses `@google/generative-ai` with the `gemini-2.0-flash` model.
- Called with accumulated transcript to extract structured medical triage info (JSON).

### `src/app/api/vapi/route.ts` — Vapi Webhook
- Receives `transcript`, `conversation-update`, `status-update`, and `end-of-call-report` event types from Vapi.
- `conversation-update` carries the full conversation array and is the primary transcript sync mechanism (`syncTranscript`); `transcript` events add individual final lines.
- Auto-starts a call in the store on the first event received for an unknown `callId`.

### `src/app/api/calls/stream/route.ts` — SSE Endpoint
- Opens a long-lived HTTP response with `Content-Type: text/event-stream`.
- Listens to `LiveCallStore` updates and streams JSON to the client.

### `src/hooks/use-live-calls.ts` — React SSE Consumer
- Opens an `EventSource` to `/api/calls/stream`.
- Returns live call state as React state.

## Environment Variables

```bash
# .env.local
VAPI_API_KEY=          # Vapi private API key (from dashboard.vapi.ai)
GOOGLE_AI_API_KEY=     # Google AI Studio API key for Gemini
DATABASE_URL=          # Supabase PostgreSQL connection string (port 6543 = Supavisor pooler)
```

Copy `.env.example` to `.env.local` and fill in the values before running. Run `npx tsx scripts/setup-db.ts` once to create the schema.

## Key Conventions

- **App Router only** — all routes under `src/app/`. No Pages Router.
- **Path alias** `@/*` maps to `src/*` (configured in `tsconfig.json`).
- **Mock data** is used throughout the demo for patients, historical calls, and epi clusters. Real data only flows in via the Vapi webhook.
- **No database** — all state is in-memory or mock. `LiveCallStore` resets on server restart.
- **Theme** — dark/light via `src/lib/theme.tsx` context + CSS variables in `globals.css`.
- **Triage levels** — `HIGH`, `MED`, `LOW` (`TriageLevel` type in `src/lib/mock-call-logs.ts`) — used for color-coding throughout the UI. Gemini maps these from call transcripts.
- **Call statuses** — `Needs review`, `Escalated`, `Resolved`, `Live` (`CallStatus` type in `src/lib/mock-call-logs.ts`).
