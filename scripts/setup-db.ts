/**
 * One-time Supabase schema setup.
 * Run: npx tsx scripts/setup-db.ts
 *
 * Creates all tables needed to persist live calls, transcripts, and patient profiles.
 * Safe to re-run — uses IF NOT EXISTS everywhere.
 */

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: 'require',
  max: 1,
  prepare: false,
});

const schema = `
-- ── patients ─────────────────────────────────────────────────────────────────
-- Created first; calls table references it via patient_id FK.
-- Medical history (conditions, medications, prior_episodes) stored as JSONB
-- to match the frontend Patient / MedicalHistory interfaces exactly.
CREATE TABLE IF NOT EXISTS patients (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  mrn            TEXT        UNIQUE,
  name           TEXT,
  age            INTEGER,
  sex            TEXT        CHECK (sex IN ('M', 'F')),
  phone          TEXT        UNIQUE,
  primary_doctor TEXT,
  allergies      JSONB       NOT NULL DEFAULT '[]'::JSONB,
  risk_level     TEXT        NOT NULL DEFAULT 'MED',
  status         TEXT        NOT NULL DEFAULT 'Active',
  last_contact   TIMESTAMPTZ,
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Denormalized medical history (matches MedicalHistory interface)
  conditions     JSONB       NOT NULL DEFAULT '[]'::JSONB,
  medications    JSONB       NOT NULL DEFAULT '[]'::JSONB,
  prior_episodes JSONB       NOT NULL DEFAULT '[]'::JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── calls ────────────────────────────────────────────────────────────────────
-- One row per Vapi call. Transcript accumulated as JSONB (TranscriptLine[]).
-- AI summary fields populated live via Gemini; finalized on end-of-call-report.
CREATE TABLE IF NOT EXISTS calls (
  id             TEXT        PRIMARY KEY,          -- Vapi call ID
  agent_id       TEXT        NOT NULL DEFAULT 'a1',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  duration_sec   INTEGER     NOT NULL DEFAULT 0,
  caller_phone   TEXT        NOT NULL DEFAULT '***-***-****',
  status         TEXT        NOT NULL DEFAULT 'Live',     -- Live | Needs review | Escalated | Resolved
  triage_level   TEXT        NOT NULL DEFAULT 'MED',     -- HIGH | MED | LOW
  reason_short   TEXT,
  chief_complaint TEXT,
  symptoms       JSONB       NOT NULL DEFAULT '[]'::JSONB,
  risk_flags     JSONB       NOT NULL DEFAULT '[]'::JSONB,
  summary        TEXT,
  recommendation TEXT,
  transcript     JSONB       NOT NULL DEFAULT '[]'::JSONB, -- TranscriptLine[]
  patient_id     TEXT        REFERENCES patients(id)
);

-- ── encounters ───────────────────────────────────────────────────────────────
-- One row per patient encounter, created at end-of-call.
-- Matches the Encounter interface in doctor-data.ts.
CREATE TABLE IF NOT EXISTS encounters (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  patient_id     TEXT        REFERENCES patients(id),
  call_id        TEXT        REFERENCES calls(id),
  type           TEXT        NOT NULL DEFAULT 'call', -- call | visit | message
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chief_complaint TEXT,
  symptoms       JSONB       NOT NULL DEFAULT '[]'::JSONB, -- Symptom[] {name, severity, onset, notes}
  triage_level   TEXT,
  outcome        TEXT
);

-- ── timeline_events ──────────────────────────────────────────────────────────
-- Audit trail per patient. Matches TimelineEvent interface in doctor-data.ts.
CREATE TABLE IF NOT EXISTS timeline_events (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  patient_id  TEXT        REFERENCES patients(id),
  type        TEXT        NOT NULL, -- call | visit | medication | note | escalation | test
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title       TEXT        NOT NULL,
  description TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::JSONB
);

-- ── doctor_notes ─────────────────────────────────────────────────────────────
-- Matches DoctorNote interface in doctor-data.ts.
CREATE TABLE IF NOT EXISTS doctor_notes (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  patient_id  TEXT        REFERENCES patients(id),
  author_id   TEXT,
  author_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content     TEXT        NOT NULL
);

-- ── test_results ─────────────────────────────────────────────────────────────
-- Matches TestResult interface in doctor-data.ts.
CREATE TABLE IF NOT EXISTS test_results (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  patient_id     TEXT        REFERENCES patients(id),
  type           TEXT        NOT NULL,
  ordered_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_date TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'Pending', -- Pending | Complete | Abnormal
  results        JSONB       NOT NULL DEFAULT '[]'::JSONB, -- {label, value, unit?, flag?}[]
  notes          TEXT,
  attachments    JSONB       NOT NULL DEFAULT '[]'::JSONB
);

-- ── indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calls_patient_id       ON calls(patient_id);
CREATE INDEX IF NOT EXISTS idx_calls_status            ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at        ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id   ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_timeline_patient_id     ON timeline_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_timeline_timestamp      ON timeline_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_notes_patient_id ON doctor_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_test_results_patient_id ON test_results(patient_id);
`;

async function setup() {
  console.log('Setting up Supabase schema…');
  try {
    await sql.unsafe(schema);
    console.log('✓ Schema created successfully');
    console.log('  Tables: patients, calls, encounters, timeline_events, doctor_notes, test_results');
  } catch (err) {
    console.error('Schema setup failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setup();
