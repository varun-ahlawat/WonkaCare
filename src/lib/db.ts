import postgres from 'postgres';
import type { TranscriptLine } from './mock-call-logs';

/* ── Client singleton ───────────────────────────────── */
// Stored on globalThis to survive Next.js hot-module reloads
const globalKey = '__dbSql__' as const;

function getClient(): postgres.Sql {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = postgres(
      process.env.DATABASE_URL!,
      {
        ssl: 'require',
        max: 3,
        prepare: false, // Required: Supabase Supavisor on port 6543 uses transaction mode
      },
    );
  }
  return (globalThis as Record<string, unknown>)[globalKey] as postgres.Sql;
}

export const sql = getClient();

// postgres.js's JSONValue type doesn't accept domain-specific typed arrays.
// This cast helper avoids noise at every call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asJson = (v: unknown) => sql.json(v as any);

/* ── Call helpers ────────────────────────────────────── */

export async function upsertCall(data: {
  id: string;
  agentId?: string;
  createdAt?: string;
  callerPhone: string;
  status?: string;
  triageLevel?: string;
  reasonShort?: string;
  chiefComplaint?: string;
  symptoms?: string[];
  riskFlags?: string[];
  summary?: string;
  recommendation?: string;
  transcript?: TranscriptLine[];
  patientId?: string;
}): Promise<void> {
  await sql`
    INSERT INTO calls (
      id, agent_id, created_at, caller_phone, status, triage_level,
      reason_short, chief_complaint, symptoms, risk_flags,
      summary, recommendation, transcript, patient_id
    ) VALUES (
      ${data.id},
      ${data.agentId ?? 'a1'},
      ${data.createdAt ?? new Date().toISOString()},
      ${data.callerPhone},
      ${data.status ?? 'Live'},
      ${data.triageLevel ?? 'MED'},
      ${data.reasonShort ?? null},
      ${data.chiefComplaint ?? null},
      ${asJson(data.symptoms ?? [])},
      ${asJson(data.riskFlags ?? [])},
      ${data.summary ?? null},
      ${data.recommendation ?? null},
      ${asJson(data.transcript ?? [])},
      ${data.patientId ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      status         = EXCLUDED.status,
      triage_level   = EXCLUDED.triage_level,
      reason_short   = EXCLUDED.reason_short,
      chief_complaint = EXCLUDED.chief_complaint,
      symptoms       = EXCLUDED.symptoms,
      risk_flags     = EXCLUDED.risk_flags,
      summary        = EXCLUDED.summary,
      recommendation = EXCLUDED.recommendation,
      transcript     = EXCLUDED.transcript,
      patient_id     = COALESCE(EXCLUDED.patient_id, calls.patient_id)
  `.catch((err) => console.error('[DB] upsertCall error:', err));
}

export async function finalizeCall(
  callId: string,
  data: {
    callerPhone?: string;
    durationSec: number;
    status: string;
    triageLevel: string;
    reasonShort: string;
    chiefComplaint: string;
    symptoms: string[];
    riskFlags: string[];
    summary: string;
    recommendation: string;
    transcript: TranscriptLine[];
    patientId?: string;
  },
): Promise<void> {
  // Upsert so this works even if the initial startCall insert failed silently
  await sql`
    INSERT INTO calls (
      id, caller_phone, agent_id, created_at, ended_at, duration_sec,
      status, triage_level, reason_short, chief_complaint,
      symptoms, risk_flags, summary, recommendation, transcript, patient_id
    ) VALUES (
      ${callId},
      ${data.callerPhone ?? '***-***-****'},
      'a1',
      NOW(),
      NOW(),
      ${data.durationSec},
      ${data.status},
      ${data.triageLevel},
      ${data.reasonShort},
      ${data.chiefComplaint},
      ${asJson(data.symptoms)},
      ${asJson(data.riskFlags)},
      ${data.summary},
      ${data.recommendation},
      ${asJson(data.transcript)},
      ${data.patientId ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      ended_at        = NOW(),
      duration_sec    = EXCLUDED.duration_sec,
      caller_phone    = CASE WHEN EXCLUDED.caller_phone = '***-***-****' THEN calls.caller_phone ELSE EXCLUDED.caller_phone END,
      status          = EXCLUDED.status,
      triage_level    = EXCLUDED.triage_level,
      reason_short    = EXCLUDED.reason_short,
      chief_complaint = EXCLUDED.chief_complaint,
      symptoms        = EXCLUDED.symptoms,
      risk_flags      = EXCLUDED.risk_flags,
      summary         = EXCLUDED.summary,
      recommendation  = EXCLUDED.recommendation,
      transcript      = EXCLUDED.transcript,
      patient_id      = COALESCE(EXCLUDED.patient_id, calls.patient_id)
  `;
}

/* ── Patient helpers ─────────────────────────────────── */

async function findPatientByPhone(phone: string): Promise<{ id: string } | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM patients WHERE phone = ${phone} LIMIT 1
  `;
  return rows[0] ?? null;
}

export interface PatientUpsertData {
  phone: string;
  name?: string;
  age?: number;
  sex?: string;
  primaryDoctor?: string;
  allergies?: string[];
  riskLevel?: string;
  patientStatus?: string;
  conditions?: object[];
  medications?: object[];
  priorEpisodes?: string[];
  lastContact?: string;
}

export async function upsertPatient(data: PatientUpsertData): Promise<string> {
  const existing = await findPatientByPhone(data.phone);

  if (existing) {
    // Fetch current arrays for merge semantics — only replace if extraction returned data
    const current = await sql<{
      conditions: object[];
      medications: object[];
      prior_episodes: string[];
      allergies: string[];
    }[]>`
      SELECT conditions, medications, prior_episodes, allergies
      FROM patients WHERE id = ${existing.id}
    `;
    const c = current[0];
    const mergedConditions  = (data.conditions?.length ?? 0) > 0 ? data.conditions! : c.conditions;
    const mergedMedications = (data.medications?.length ?? 0) > 0 ? data.medications! : c.medications;
    const mergedEpisodes    = (data.priorEpisodes?.length ?? 0) > 0 ? data.priorEpisodes! : c.prior_episodes;
    const mergedAllergies   = (data.allergies?.length ?? 0) > 0 ? data.allergies! : c.allergies;

    await sql`
      UPDATE patients SET
        name           = COALESCE(${data.name ?? null}, name),
        age            = COALESCE(${data.age ?? null}, age),
        sex            = COALESCE(${data.sex ?? null}, sex),
        primary_doctor = COALESCE(${data.primaryDoctor ?? null}, primary_doctor),
        allergies      = ${asJson(mergedAllergies)},
        risk_level     = COALESCE(${data.riskLevel ?? null}, risk_level),
        status         = COALESCE(${data.patientStatus ?? null}, status),
        conditions     = ${asJson(mergedConditions)},
        medications    = ${asJson(mergedMedications)},
        prior_episodes = ${asJson(mergedEpisodes)},
        last_contact   = ${data.lastContact ?? new Date().toISOString()},
        last_updated   = NOW()
      WHERE id = ${existing.id}
    `;
    return existing.id;
  }

  // New patient — generate MRN
  const mrn = `MRN-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const rows = await sql<{ id: string }[]>`
    INSERT INTO patients (
      mrn, name, age, sex, phone, primary_doctor, allergies,
      risk_level, status, conditions, medications, prior_episodes,
      last_contact, last_updated
    ) VALUES (
      ${mrn},
      ${data.name ?? null},
      ${data.age ?? null},
      ${data.sex ?? null},
      ${data.phone},
      ${data.primaryDoctor ?? null},
      ${asJson(data.allergies ?? [])},
      ${data.riskLevel ?? 'MED'},
      ${data.patientStatus ?? 'Active'},
      ${asJson(data.conditions ?? [])},
      ${asJson(data.medications ?? [])},
      ${asJson(data.priorEpisodes ?? [])},
      ${data.lastContact ?? new Date().toISOString()},
      NOW()
    )
    RETURNING id
  `;
  console.log(`[DB] Created new patient ${rows[0].id} (${mrn}) for phone ${data.phone}`);
  return rows[0].id;
}

/* ── Encounter / Timeline helpers ────────────────────── */

export async function createEncounter(data: {
  patientId: string;
  callId: string;
  timestamp: string;
  chiefComplaint: string;
  symptoms: object[];
  triageLevel: string;
  outcome: string;
}): Promise<void> {
  await sql`
    INSERT INTO encounters (
      patient_id, call_id, type, timestamp,
      chief_complaint, symptoms, triage_level, outcome
    ) VALUES (
      ${data.patientId}, ${data.callId}, 'call', ${data.timestamp},
      ${data.chiefComplaint}, ${asJson(data.symptoms)},
      ${data.triageLevel}, ${data.outcome}
    )
  `;
}

export async function createTimelineEvent(data: {
  patientId: string;
  type: string;
  timestamp: string;
  title: string;
  description: string;
  metadata?: object;
}): Promise<void> {
  await sql`
    INSERT INTO timeline_events (
      patient_id, type, timestamp, title, description, metadata
    ) VALUES (
      ${data.patientId}, ${data.type}, ${data.timestamp},
      ${data.title}, ${data.description},
      ${asJson(data.metadata ?? {})}
    )
  `;
}

/* ── Context-aware patient lookup (for Gemini injection) ── */

export interface ExistingPatientContext {
  id: string;
  name: string | null;
  age: number | null;
  sex: string | null;
  allergies: string[];
  conditions: Array<{ name: string; diagnosedDate: string; status: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; startedDate: string }>;
  priorEpisodes: string[];
}

export async function getPatientFullByPhone(phone: string): Promise<ExistingPatientContext | null> {
  const rows = await sql<Array<{
    id: string;
    name: string | null;
    age: number | null;
    sex: string | null;
    allergies: unknown;
    conditions: unknown;
    medications: unknown;
    prior_episodes: unknown;
  }>>`
    SELECT id, name, age, sex, allergies, conditions, medications, prior_episodes
    FROM patients WHERE phone = ${phone} LIMIT 1
  `.catch(() => []);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    age: r.age,
    sex: r.sex,
    allergies: (r.allergies as string[]) ?? [],
    conditions: (r.conditions as ExistingPatientContext['conditions']) ?? [],
    medications: (r.medications as ExistingPatientContext['medications']) ?? [],
    priorEpisodes: (r.prior_episodes as string[]) ?? [],
  };
}

export async function getDoctorNotesByPatientId(
  patientId: string,
  limit = 5,
): Promise<Array<{ author_name: string | null; created_at: string; content: string }>> {
  return sql<Array<{ author_name: string | null; created_at: string; content: string }>>`
    SELECT author_name, created_at, content
    FROM doctor_notes
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `.catch((err) => {
    console.error('[DB] getDoctorNotesByPatientId error:', err);
    return [];
  });
}

/* ── Query helpers for API routes ─────────────────────── */

export async function getCompletedCalls(limit = 100) {
  return sql`
    SELECT
      c.id, c.created_at, c.ended_at,
      COALESCE(NULLIF(c.duration_sec, 0),
        EXTRACT(EPOCH FROM (c.ended_at - c.created_at))::int, 0) AS duration_sec,
      c.caller_phone,
      c.status, c.triage_level, c.reason_short, c.chief_complaint,
      c.symptoms, c.risk_flags, c.summary, c.recommendation,
      c.transcript, c.patient_id,
      p.name  AS patient_name,
      p.age   AS patient_age,
      p.sex   AS patient_sex
    FROM calls c
    LEFT JOIN patients p ON c.patient_id = p.id
    WHERE c.status != 'Live'
    ORDER BY c.created_at DESC
    LIMIT ${limit}
  `.catch((err) => {
    console.error('[DB] getCompletedCalls error:', err);
    return [];
  });
}

export async function getAllPatientsFromDB() {
  return sql`
    SELECT id, mrn, name, age, sex, phone, primary_doctor,
           allergies, risk_level, status, last_contact, last_updated
    FROM patients
    ORDER BY last_contact DESC NULLS LAST
  `.catch((err) => {
    console.error('[DB] getAllPatientsFromDB error:', err);
    return [];
  });
}

export async function updateCallStatus(callId: string, status: string): Promise<void> {
  await sql`UPDATE calls SET status = ${status} WHERE id = ${callId}`;
}

export async function getCallByIdFromDB(callId: string) {
  const rows = await sql`
    SELECT
      c.id, c.created_at, c.ended_at,
      COALESCE(NULLIF(c.duration_sec, 0),
        EXTRACT(EPOCH FROM (c.ended_at - c.created_at))::int, 0) AS duration_sec,
      c.caller_phone,
      c.status, c.triage_level, c.reason_short, c.chief_complaint,
      c.symptoms, c.risk_flags, c.summary, c.recommendation,
      c.transcript, c.patient_id,
      p.name  AS patient_name,
      p.age   AS patient_age,
      p.sex   AS patient_sex
    FROM calls c
    LEFT JOIN patients p ON c.patient_id = p.id
    WHERE c.id = ${callId}
    LIMIT 1
  `.catch((err) => {
    console.error('[DB] getCallByIdFromDB error:', err);
    return [];
  });
  return rows[0] ?? null;
}

export async function getPatientWithDetails(id: string) {
  const [patients, encounters, timeline, notes] = await Promise.all([
    sql`SELECT * FROM patients WHERE id = ${id} LIMIT 1`,
    sql`SELECT * FROM encounters WHERE patient_id = ${id} ORDER BY timestamp DESC LIMIT 10`,
    sql`SELECT * FROM timeline_events WHERE patient_id = ${id} ORDER BY timestamp DESC LIMIT 20`,
    sql`SELECT * FROM doctor_notes WHERE patient_id = ${id} ORDER BY created_at DESC LIMIT 10`,
  ]);
  if (!patients[0]) return null;
  return { patient: patients[0], encounters, timeline, notes };
}
