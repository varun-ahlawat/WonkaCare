# WonkaCare

AI-powered hospital voice agent that answers every patient call, conducts real-time medical triage, and routes emergencies to a nurse's phone in seconds — no hold, no voicemail. Built with HIPAA-aligned architecture from day one.

## Inspiration

Our teammate Shwejan's friend was spiked at a bar late at night. She called Shwejan, but he was 90 minutes away. He called 911 and had to explain the situation three times to three different operators. Every re-explanation burned critical minutes. The problem wasn't the paramedics — it was the handoff. Context gets lost between every caller, dispatcher, nurse, and doctor. Hospitals miss 1 in 3 calls, and 85% of those patients never call back. This made us realize how every second matters, which is why we built WonkaCare.

## What It Does

WonkaCare is an AI-powered voice agent for hospitals that aligns with all HIPAA requirements. It answers every patient call, conducts real-time medical triage, and routes emergencies to a nurse's phone in seconds — no hold, no voicemail.

- **Non-urgent calls** get a full AI-generated summary with symptoms and risk flags delivered to a triage operator's dashboard — without a human ever picking up.
- **Doctors** get a dedicated dashboard with the patient's full context — call transcript, AI triage summary, medical history, medications, test results — ready before they walk into the room.
- **Epidemiological analytics** — every call feeds structured data (symptoms, zip codes, timestamps) into an outbreak detection engine that catches geographic hotspots, symptom velocity spikes, and cluster patterns. A single heart attack is a medical event. Fourteen in one zip code is a public health emergency — and WonkaCare catches it in hours, not weeks.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 |
| Styling | Tailwind CSS 4 + PostCSS |
| Charts | Recharts 3 |
| AI / LLM | Google Gemini 2.5 Flash (Vertex AI) + Google AI Studio fallback |
| Voice | Vapi AI (`@vapi-ai/server-sdk`) |
| Database | Supabase (PostgreSQL) |
| Real-time | Server-Sent Events (SSE) + Node.js EventEmitter |
| Deployment | Docker → Google Cloud Run |

## How It Works

### Voice Pipeline

Patient calls come through **Vapi**, which streams live webhook events (`transcript`, `conversation-update`, `status-update`, `end-of-call-report`) to our backend. The webhook processes transcript segments and status updates into a **LiveCallStore** — an EventEmitter-based in-memory singleton managing all active call state. The store reconciles out-of-order Vapi events using a sync layer with safety guards to prevent transcript data loss.

### AI Triage

Transcripts are sent to **Gemini 2.5 Flash** with a medical triage prompt. During live calls, a lightweight summarizer extracts patient info, symptoms, risk flags, triage level (`HIGH` / `MED` / `LOW`), and a recommended action — streaming updates to the dashboard in real time.

At end-of-call, a comprehensive extraction pipeline runs against the full transcript and any existing patient records. Gemini returns structured JSON covering the call (triage level, chief complaint, symptoms, risk flags, recommendation), the patient profile (demographics, allergies, conditions, medications, prior episodes), and a detailed encounter record (symptom severity, onset, outcome). For returning patients, the prompt includes their existing medical record so Gemini merges — never overwrites — existing data.

### Real-time Streaming

The triage dashboard receives updates via **Server-Sent Events** (SSE). A custom `useLiveCalls()` React hook consumes the stream so operators see transcripts, AI summaries, and triage decisions update live as the call progresses.

### Emergency Routing

HIGH triage calls trigger an automated forward to a nurse's phone in under 30 seconds — fully automated, no human dispatcher needed.

### Epidemiological Analytics

Symptom clustering (K-Means / LDA in production) detects outbreak patterns and surfaces them as geographic hotspots, symptom velocity charts, and threat-level alerts. The engine tracks clusters across zip codes and time windows, detecting surges that would take traditional surveillance weeks to identify.

## Data Flow

```
Patient calls hospital number
        ↓
   [Vapi Platform]  ← AI voice agent handles the conversation
        ↓
POST /api/vapi  (webhook receives live events)
        ↓
LiveCallStore  (in-memory EventEmitter singleton)
  ├── accumulates transcript chunks
  ├── reconciles out-of-order events
  └── triggers Gemini for AI summary/triage
        ↓
emits "update" events
        ↓
GET /api/calls/stream  (SSE endpoint)
        ↓
useLiveCalls() hook  (React client)
        ↓
Triage Dashboard  ←──→  Doctor Dashboard  ←──→  Analytics Panel
        ↓
End-of-call → Gemini extraction → Supabase persistence
  ├── upsertPatient (find-by-phone or create, merge medical history)
  ├── finalizeCall (transcript, AI fields, triage level)
  ├── createEncounter (structured symptoms with severity/onset)
  └── createTimelineEvent (append-only patient audit trail)
```

## Dashboards

| Route | Surface | Purpose |
|---|---|---|
| `/` | **Triage Dashboard** | Live call monitoring, call history, status filtering, transcript view, emergency redirect to nurse |
| `/doctor` | **Doctor Portal** | Patient list with search/filter, patient profiles with full medical context |
| `/doctor/patients/[id]` | **Patient Detail** | Medical history, appointment timeline, test results, doctor notes, encounter history |
| `/analytics` | **Epidemiological Surveillance** | K-Means symptom clusters, geographic hotspot map, symptom velocity charts, outbreak alerts |
| `/calls/[id]` | **Transcript Viewer** | Full transcript for any completed call |

## Database Schema

Six tables in Supabase (PostgreSQL), created via `scripts/setup-db.ts`:

| Table | Purpose |
|---|---|
| `patients` | Patient profiles — demographics, allergies, conditions (JSONB), medications (JSONB), prior episodes. Lookup by phone number. |
| `calls` | One row per Vapi call — full transcript (JSONB), AI summary fields, status, triage level, FK to patient. |
| `encounters` | One per call; linked to patient and call. Structured symptoms with severity, onset, and outcome. |
| `timeline_events` | Append-only audit trail per patient (calls, visits, medications, notes, escalations, tests). |
| `doctor_notes` | Provider notes per patient with author attribution. |
| `test_results` | Lab/test results with status tracking and structured results (JSONB). |

## HIPAA Alignment

- Phone numbers are masked in the UI (`***-***-****` until authenticated)
- Raw audio never persists on our servers — only AI-extracted structured data
- The in-memory `LiveCallStore` doesn't write PHI to disk
- Architecture designed for production HIPAA constraints: E2E encryption, BAAs, audit logging
- Patient records use merge semantics — AI extraction never overwrites existing medical history

## Setup

1. Copy `.env.example` to `.env.local` and fill in:

```bash
VAPI_API_KEY=          # Vapi private API key (dashboard.vapi.ai)
VAPI_ASSISTANT_ID=     # Vapi assistant ID (created by setup script)
GOOGLE_AI_API_KEY=     # Google AI Studio key (Gemini fallback)
VERTEX_API_KEY=        # Vertex AI key (primary Gemini provider)
DATABASE_URL=          # Supabase PostgreSQL connection string (port 6543)
```

2. Install dependencies and set up the database:

```bash
npm install
npx tsx scripts/setup-db.ts    # Creates all tables in Supabase
npx tsx scripts/setup-vapi.ts  # Provisions Vapi assistant + phone number
```

## Development

```bash
npm run dev
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                         # Triage Dashboard (main view)
│   ├── analytics/page.tsx               # Epidemiological early warning system
│   ├── doctor/page.tsx                  # Doctor dashboard + patient list
│   ├── doctor/patients/[id]/page.tsx    # Patient detail view
│   ├── calls/[id]/page.tsx              # Call transcript viewer
│   ├── api/vapi/route.ts               # Vapi webhook handler
│   ├── api/calls/stream/route.ts       # SSE live call stream
│   ├── api/calls/history/route.ts      # Completed calls from Supabase
│   ├── api/patients/route.ts           # Patient list API
│   └── api/seed/route.ts               # Demo data seeder
├── lib/
│   ├── live-calls.ts                    # LiveCallStore — in-memory call state + AI summarization
│   ├── gemini.ts                        # Gemini 2.5 Flash (Vertex AI + Google AI Studio)
│   ├── db.ts                            # Supabase client + all DB operations
│   ├── epi-data.ts                      # Epidemiological cluster simulation
│   ├── accounts.ts                      # Multi-role accounts (triage, doctor, receptionist)
│   ├── doctor-data.ts                   # Patient data + medical history
│   ├── mock-call-logs.ts               # Mock call & transcript data for demo
│   ├── format.ts                        # Time/duration formatters
│   └── theme.tsx                        # Dark/light theme provider
├── hooks/
│   └── use-live-calls.ts                # React hook — consumes SSE stream
└── components/
    ├── ui/                              # Primitive UI components
    ├── doctor/                          # Doctor portal components
    ├── analytics-panel.tsx              # Analytics UI
    ├── account-switcher.tsx             # Role switcher
    └── settings-modal.tsx               # Settings modal
scripts/
├── setup-vapi.ts                        # One-time Vapi provisioning
├── setup-db.ts                          # One-time Supabase schema creation
├── test-call.ts                         # Call testing utility
└── test-db.ts                           # DB connection tester
```

## Challenges

- **Call state management** — Vapi sends events out of order (fragments, full syncs, abrupt endings). We built a reconciliation layer with safety guards and debounced AI summarization to keep state consistent without hammering the Gemini API.
- **HIPAA compliance** — Phone numbers are masked, raw audio never persists, and the in-memory store doesn't write PHI to disk. We designed around production HIPAA constraints from day one.
- **Real-time concurrency** — Race conditions between webhook events, SSE streams, and Gemini API calls required careful debouncing, state reconciliation, and fire-and-forget patterns with two-phase DB writes (save transcript immediately, then update with AI extraction).

## What's Next

- **Low-resource regions** — Where there's one doctor per ten thousand people, WonkaCare becomes the triage system they never had
- **Multilingual support** — Critical for developing countries where patients don't speak the dominant language
- **EHR integration** — Connect to Epic/Cerner so the doctor dashboard pulls real patient records
- **County health department alerts** — Automatically notify public health officials when outbreak thresholds are crossed

## System Architecture

<img width="7019" height="5660" alt="image" src="https://github.com/user-attachments/assets/950736e4-c975-473d-8cd4-076e0af8e57b" />

## Database/Schema Models

<!-- TODO: add image -->

## Triage Prioritization Decision Flow

<!-- TODO: add image -->

## Call Lifecycle Sequence

<!-- TODO: add image -->
