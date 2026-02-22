/**
 * DB CRUD test suite — exercises every helper in src/lib/db.ts
 * Run: npx tsx scripts/test-db.ts
 *
 * All test data is tagged with a unique run ID and cleaned up at the end
 * regardless of whether tests pass or fail.
 */

import postgres from 'postgres';
import {
  sql,
  upsertCall,
  finalizeCall,
  upsertPatient,
  createEncounter,
  createTimelineEvent,
} from '../src/lib/db';

/* ── Test runner ─────────────────────────────────────── */

let passed = 0;
let failed = 0;
const errors: string[] = [];

function ok(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.log(`  ✗  ${msg}`);
    errors.push(msg);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

/* ── Unique test IDs (keyed to this run) ─────────────── */

const RUN = Date.now().toString(36).toUpperCase();
const CALL_ID_1   = `test-call-${RUN}-1`;
const CALL_ID_2   = `test-call-${RUN}-2`;
const PHONE_1     = `TEST-555-${RUN.slice(-4)}-1`;
const PHONE_2     = `TEST-555-${RUN.slice(-4)}-2`;

/* ── Cleanup ─────────────────────────────────────────── */

async function cleanup() {
  console.log('\n── Cleanup ────────────────────────────────────────');
  // Delete in FK-safe order (sequential): child rows first, then parent rows.
  // encounters and timeline_events reference calls + patients → delete first.
  // calls references patients → delete before patients.
  const enc  = await sql`DELETE FROM encounters     WHERE call_id IN (${CALL_ID_1}, ${CALL_ID_2}) RETURNING id`;
  const tl   = await sql`DELETE FROM timeline_events WHERE patient_id IN (
                            SELECT id FROM patients WHERE phone IN (${PHONE_1}, ${PHONE_2})
                          ) RETURNING id`;
  const calls = await sql`DELETE FROM calls    WHERE id    IN (${CALL_ID_1}, ${CALL_ID_2}) RETURNING id`;
  const pats  = await sql`DELETE FROM patients WHERE phone IN (${PHONE_1}, ${PHONE_2}) RETURNING id`;
  console.log(
    `  Deleted: ${enc.length} encounter(s), ${tl.length} timeline event(s), ` +
    `${calls.length} call(s), ${pats.length} patient(s)`,
  );
}

/* ══════════════════════════════════════════════════════ */
/*  T E S T S                                            */
/* ══════════════════════════════════════════════════════ */

async function run() {
  console.log(`\n╔══ Meredith DB test suite  (run: ${RUN}) ══╗`);

  try {
    /* ── 1. upsertCall — INSERT ────────────────────────── */
    section('1. upsertCall — INSERT new call');

    await upsertCall({
      id: CALL_ID_1,
      callerPhone: PHONE_1,
      createdAt: '2026-02-21T10:00:00Z',
      status: 'Live',
      triageLevel: 'HIGH',
      reasonShort: 'Test chest pain',
      transcript: [
        { timestamp: '0:00', speaker: 'Agent', text: 'Hello, how can I help?' },
        { timestamp: '0:05', speaker: 'Caller', text: 'I have chest pain.' },
      ],
    });

    const row1 = await sql<{
      id: string; caller_phone: string; status: string;
      triage_level: string; reason_short: string;
      transcript: unknown[]; symptoms: unknown[]; patient_id: string | null;
    }[]>`SELECT * FROM calls WHERE id = ${CALL_ID_1}`;

    ok('Row exists',            row1.length === 1);
    ok('caller_phone matches',  row1[0]?.caller_phone === PHONE_1);
    ok('status = Live',         row1[0]?.status === 'Live');
    ok('triage_level = HIGH',   row1[0]?.triage_level === 'HIGH');
    ok('reason_short stored',   row1[0]?.reason_short === 'Test chest pain');
    ok('transcript is array',   Array.isArray(row1[0]?.transcript));
    ok('transcript has 2 lines', (row1[0]?.transcript as unknown[]).length === 2);
    ok('symptoms defaults []',  Array.isArray(row1[0]?.symptoms) && (row1[0]?.symptoms as unknown[]).length === 0);
    ok('patient_id is null',    row1[0]?.patient_id === null);

    /* ── 2. upsertCall — ON CONFLICT UPDATE ────────────── */
    section('2. upsertCall — ON CONFLICT UPDATE (same ID)');

    await upsertCall({
      id: CALL_ID_1,
      callerPhone: PHONE_1,
      status: 'Live',
      triageLevel: 'MED',                  // changed
      reasonShort: 'Test chest pain — updated',
      symptoms: ['chest pain', 'dyspnea'],
      riskFlags: ['age >65'],
      summary: 'Ongoing call summary.',
      recommendation: 'Monitor closely.',
      transcript: [
        { timestamp: '0:00', speaker: 'Agent', text: 'Hello, how can I help?' },
        { timestamp: '0:05', speaker: 'Caller', text: 'I have chest pain.' },
        { timestamp: '0:10', speaker: 'Agent', text: 'How long have you had this?' },
      ],
    });

    const row2 = await sql<{
      triage_level: string; reason_short: string;
      symptoms: unknown[]; risk_flags: unknown[];
      transcript: unknown[]; summary: string;
    }[]>`SELECT * FROM calls WHERE id = ${CALL_ID_1}`;

    ok('triage_level updated to MED',  row2[0]?.triage_level === 'MED');
    ok('reason_short updated',         row2[0]?.reason_short === 'Test chest pain — updated');
    ok('symptoms populated',           (row2[0]?.symptoms as string[])?.includes('chest pain'));
    ok('risk_flags populated',         (row2[0]?.risk_flags as string[])?.includes('age >65'));
    ok('transcript grew to 3 lines',   (row2[0]?.transcript as unknown[]).length === 3);
    ok('summary stored',               row2[0]?.summary === 'Ongoing call summary.');

    /* ── 3. upsertPatient — INSERT new patient ──────────── */
    section('3. upsertPatient — INSERT new patient');

    const patientId1 = await upsertPatient({
      phone: PHONE_1,
      name: 'Test Patient One',
      age: 67,
      sex: 'M',
      allergies: ['Penicillin'],
      riskLevel: 'HIGH',
      patientStatus: 'Critical',
      conditions: [
        { name: 'Hypertension', diagnosedDate: '2020-01-01', status: 'Chronic' },
      ],
      medications: [
        { name: 'Metoprolol', dosage: '50mg', frequency: 'Daily', startedDate: '2020-01-01' },
      ],
      priorEpisodes: ['ER visit Jan 2025'],
      lastContact: '2026-02-21T10:00:00Z',
    });

    ok('Returns a patient ID',  typeof patientId1 === 'string' && patientId1.length > 0);

    const pat1 = await sql<{
      id: string; name: string; age: number; sex: string;
      phone: string; mrn: string; risk_level: string; status: string;
      allergies: unknown[]; conditions: unknown[];
      medications: unknown[]; prior_episodes: unknown[];
    }[]>`SELECT * FROM patients WHERE id = ${patientId1}`;

    ok('Row exists',                   pat1.length === 1);
    ok('name stored',                  pat1[0]?.name === 'Test Patient One');
    ok('age stored',                   pat1[0]?.age === 67);
    ok('sex stored',                   pat1[0]?.sex === 'M');
    ok('phone stored',                 pat1[0]?.phone === PHONE_1);
    ok('MRN auto-generated',           pat1[0]?.mrn?.startsWith('MRN-'));
    ok('risk_level stored',            pat1[0]?.risk_level === 'HIGH');
    ok('status stored',                pat1[0]?.status === 'Critical');
    ok('allergies stored',             (pat1[0]?.allergies as string[])?.includes('Penicillin'));
    ok('conditions stored (1 item)',   (pat1[0]?.conditions as unknown[]).length === 1);
    ok('medications stored (1 item)',  (pat1[0]?.medications as unknown[]).length === 1);
    ok('prior_episodes stored',        (pat1[0]?.prior_episodes as string[])?.includes('ER visit Jan 2025'));

    /* ── 4. upsertPatient — UPDATE with new data ─────────── */
    section('4. upsertPatient — UPDATE: new conditions/medications replace old');

    const patientId1b = await upsertPatient({
      phone: PHONE_1,        // same phone → UPDATE path
      name: 'Test Patient One (Updated)',
      age: 68,               // birthday
      conditions: [
        { name: 'Hypertension',        diagnosedDate: '2020-01-01', status: 'Chronic' },
        { name: 'Coronary artery disease', diagnosedDate: '2023-03-01', status: 'Chronic' },
      ],
      medications: [
        { name: 'Metoprolol',   dosage: '50mg', frequency: 'Daily',       startedDate: '2020-01-01' },
        { name: 'Atorvastatin', dosage: '40mg', frequency: 'Once daily',  startedDate: '2023-03-01' },
      ],
    });

    ok('Returns same patient ID', patientId1b === patientId1);

    const pat1b = await sql<{
      id: string; name: string; age: number;
      conditions: unknown[]; medications: unknown[]; prior_episodes: unknown[];
      allergies: unknown[];
    }[]>`SELECT * FROM patients WHERE id = ${patientId1}`;

    ok('name updated',             pat1b[0]?.name === 'Test Patient One (Updated)');
    ok('age updated',              pat1b[0]?.age === 68);
    ok('conditions grew to 2',     (pat1b[0]?.conditions as unknown[]).length === 2);
    ok('medications grew to 2',    (pat1b[0]?.medications as unknown[]).length === 2);
    ok('prior_episodes unchanged', (pat1b[0]?.prior_episodes as string[])?.includes('ER visit Jan 2025'));
    ok('allergies unchanged',      (pat1b[0]?.allergies as string[])?.includes('Penicillin'));

    /* ── 5. upsertPatient — merge: empty arrays keep existing ─ */
    section('5. upsertPatient — merge: empty arrays keep existing DB values');

    await upsertPatient({
      phone: PHONE_1,
      name: 'Test Patient One (Final)',
      conditions: [],    // empty → should NOT wipe existing conditions
      medications: [],   // empty → should NOT wipe existing medications
      allergies: [],     // empty → should NOT wipe existing allergies
    });

    const pat1c = await sql<{
      name: string; conditions: unknown[]; medications: unknown[]; allergies: unknown[];
    }[]>`SELECT name, conditions, medications, allergies FROM patients WHERE id = ${patientId1}`;

    ok('name updated again',       pat1c[0]?.name === 'Test Patient One (Final)');
    ok('conditions kept (not wiped)', (pat1c[0]?.conditions as unknown[]).length === 2);
    ok('medications kept (not wiped)', (pat1c[0]?.medications as unknown[]).length === 2);
    ok('allergies kept (not wiped)',   (pat1c[0]?.allergies as string[])?.includes('Penicillin'));

    /* ── 6. finalizeCall ──────────────────────────────────── */
    section('6. finalizeCall — seal call on end-of-call-report');

    await finalizeCall(CALL_ID_1, {
      durationSec: 187,
      status: 'Escalated',
      triageLevel: 'HIGH',
      reasonShort: 'Chest pain — finalized',
      chiefComplaint: 'Chest pain radiating to left arm.',
      symptoms: ['chest pain', 'dyspnea', 'diaphoresis'],
      riskFlags: ['cardiac history', 'age >65'],
      summary: 'Male, 67, chest pain for 20 minutes.',
      recommendation: 'Dispatch EMS immediately.',
      transcript: [
        { timestamp: '0:00', speaker: 'Agent', text: 'Hello.' },
        { timestamp: '0:05', speaker: 'Caller', text: 'Chest pain.' },
        { timestamp: '0:10', speaker: 'Agent', text: 'How long?' },
        { timestamp: '0:15', speaker: 'Caller', text: '20 minutes.' },
      ],
      patientId: patientId1,
    });

    const finalized = await sql<{
      status: string; triage_level: string; duration_sec: number;
      ended_at: string | null; reason_short: string; chief_complaint: string;
      symptoms: unknown[]; risk_flags: unknown[]; summary: string;
      recommendation: string; transcript: unknown[]; patient_id: string | null;
    }[]>`SELECT * FROM calls WHERE id = ${CALL_ID_1}`;

    ok('status = Escalated',       finalized[0]?.status === 'Escalated');
    ok('triage_level = HIGH',      finalized[0]?.triage_level === 'HIGH');
    ok('duration_sec = 187',       finalized[0]?.duration_sec === 187);
    ok('ended_at set',             finalized[0]?.ended_at !== null);
    ok('reason_short updated',     finalized[0]?.reason_short === 'Chest pain — finalized');
    ok('chief_complaint stored',   finalized[0]?.chief_complaint === 'Chest pain radiating to left arm.');
    ok('symptoms has 3 items',     (finalized[0]?.symptoms as unknown[]).length === 3);
    ok('risk_flags has 2 items',   (finalized[0]?.risk_flags as unknown[]).length === 2);
    ok('summary stored',           finalized[0]?.summary?.includes('67'));
    ok('recommendation stored',    finalized[0]?.recommendation?.includes('EMS'));
    ok('transcript has 4 lines',   (finalized[0]?.transcript as unknown[]).length === 4);
    ok('patient_id linked',        finalized[0]?.patient_id === patientId1);

    /* ── 7. createEncounter ───────────────────────────────── */
    section('7. createEncounter — create encounter linked to patient + call');

    await createEncounter({
      patientId: patientId1,
      callId: CALL_ID_1,
      timestamp: '2026-02-21T10:00:00Z',
      chiefComplaint: 'Chest pain radiating to left arm.',
      symptoms: [
        { name: 'Chest pain',   severity: 'Severe',   onset: '20 minutes ago' },
        { name: 'Dyspnea',      severity: 'Moderate', onset: '20 minutes ago' },
        { name: 'Diaphoresis',  severity: 'Mild',     onset: '15 minutes ago' },
      ],
      triageLevel: 'HIGH',
      outcome: 'EMS dispatched. Patient advised to chew aspirin.',
    });

    const enc1 = await sql<{
      patient_id: string; call_id: string; type: string;
      chief_complaint: string; symptoms: unknown[];
      triage_level: string; outcome: string;
    }[]>`SELECT * FROM encounters WHERE call_id = ${CALL_ID_1}`;

    ok('Row exists',                   enc1.length === 1);
    ok('patient_id linked',            enc1[0]?.patient_id === patientId1);
    ok('call_id linked',               enc1[0]?.call_id === CALL_ID_1);
    ok('type = call',                  enc1[0]?.type === 'call');
    ok('chief_complaint stored',       enc1[0]?.chief_complaint?.includes('left arm'));
    ok('symptoms is array (3 items)',  (enc1[0]?.symptoms as unknown[]).length === 3);
    ok('triage_level = HIGH',          enc1[0]?.triage_level === 'HIGH');
    ok('outcome stored',               enc1[0]?.outcome?.includes('EMS'));

    const firstSym = (enc1[0]?.symptoms as Array<{ name: string; severity: string; onset: string }>)[0];
    ok('symptom has severity field',   firstSym?.severity === 'Severe');
    ok('symptom has onset field',      firstSym?.onset === '20 minutes ago');

    /* ── 8. createTimelineEvent ───────────────────────────── */
    section('8. createTimelineEvent — append to patient timeline');

    await createTimelineEvent({
      patientId: patientId1,
      type: 'call',
      timestamp: '2026-02-21T10:00:00Z',
      title: 'Triage call — Chest pain',
      description: 'Patient reports chest pain radiating to left arm.',
      metadata: {
        triageLevel: 'HIGH',
        callStatus: 'Escalated',
        callId: CALL_ID_1,
      },
    });

    // Add a second event type to test polymorphism
    await createTimelineEvent({
      patientId: patientId1,
      type: 'escalation',
      timestamp: '2026-02-21T10:03:00Z',
      title: 'EMS dispatched',
      description: 'Emergency services dispatched to patient location.',
    });

    const events = await sql<{
      patient_id: string; type: string; title: string;
      description: string; metadata: Record<string, unknown>;
    }[]>`
      SELECT * FROM timeline_events
      WHERE patient_id = ${patientId1}
      ORDER BY timestamp ASC
    `;

    ok('2 events created',              events.length === 2);
    ok('first type = call',             events[0]?.type === 'call');
    ok('first title stored',            events[0]?.title === 'Triage call — Chest pain');
    ok('first description stored',      events[0]?.description?.includes('left arm'));
    ok('metadata.triageLevel = HIGH',   events[0]?.metadata?.triageLevel === 'HIGH');
    ok('metadata.callId stored',        events[0]?.metadata?.callId === CALL_ID_1);
    ok('second type = escalation',      events[1]?.type === 'escalation');
    ok('metadata defaults to {} on no metadata', typeof events[1]?.metadata === 'object');

    /* ── 9. upsertCall ON CONFLICT keeps patient_id ──────── */
    section('9. ON CONFLICT: patient_id not overwritten by COALESCE(null, existing)');

    await upsertCall({
      id: CALL_ID_1,
      callerPhone: PHONE_1,
      status: 'Needs review',
      transcript: [],
      // patientId deliberately omitted → COALESCE(null, existing) should keep patientId1
    });

    const afterUpdate = await sql<{ patient_id: string | null; status: string }[]>`
      SELECT patient_id, status FROM calls WHERE id = ${CALL_ID_1}
    `;
    ok('patient_id preserved after upsert without patientId', afterUpdate[0]?.patient_id === patientId1);
    ok('status updated to Needs review', afterUpdate[0]?.status === 'Needs review');

    /* ── 10. Second patient + call — full end-to-end ──────── */
    section('10. Full end-to-end: second patient + second call');

    // Insert call 2 first (no patient yet)
    await upsertCall({
      id: CALL_ID_2,
      callerPhone: PHONE_2,
      createdAt: '2026-02-21T11:00:00Z',
      status: 'Live',
      triageLevel: 'LOW',
      reasonShort: 'Prescription refill',
      transcript: [
        { timestamp: '0:00', speaker: 'Agent', text: 'Hello.' },
        { timestamp: '0:03', speaker: 'Caller', text: 'I need a refill.' },
      ],
    });

    // Create patient
    const patientId2 = await upsertPatient({
      phone: PHONE_2,
      name: 'Test Patient Two',
      age: 34,
      sex: 'F',
      riskLevel: 'LOW',
      patientStatus: 'Stable',
    });

    ok('Second patient different ID', patientId2 !== patientId1);

    // Finalize call 2 with patient link
    await finalizeCall(CALL_ID_2, {
      durationSec: 65,
      status: 'Resolved',
      triageLevel: 'LOW',
      reasonShort: 'Prescription refill — resolved',
      chiefComplaint: 'Medication refill request.',
      symptoms: [],
      riskFlags: [],
      summary: 'Female, 34, prescription refill. Non-urgent.',
      recommendation: 'Route to pharmacy.',
      transcript: [
        { timestamp: '0:00', speaker: 'Agent', text: 'Hello.' },
        { timestamp: '0:03', speaker: 'Caller', text: 'I need a refill.' },
        { timestamp: '0:07', speaker: 'Agent', text: 'Routing you to pharmacy.' },
      ],
      patientId: patientId2,
    });

    // Encounter + timeline
    await createEncounter({
      patientId: patientId2,
      callId: CALL_ID_2,
      timestamp: '2026-02-21T11:00:00Z',
      chiefComplaint: 'Prescription refill request.',
      symptoms: [],
      triageLevel: 'LOW',
      outcome: 'Routed to pharmacy support. Non-urgent.',
    });

    await createTimelineEvent({
      patientId: patientId2,
      type: 'call',
      timestamp: '2026-02-21T11:00:00Z',
      title: 'Triage call — Prescription refill',
      description: 'Patient requested refill. Routed to pharmacy.',
      metadata: { triageLevel: 'LOW', callStatus: 'Resolved', callId: CALL_ID_2 },
    });

    // Verify second call
    const call2 = await sql<{
      status: string; duration_sec: number; patient_id: string | null;
    }[]>`SELECT status, duration_sec, patient_id FROM calls WHERE id = ${CALL_ID_2}`;
    const enc2  = await sql<{ triage_level: string }[]>`
      SELECT triage_level FROM encounters WHERE call_id = ${CALL_ID_2}`;
    const tl2   = await sql<{ type: string }[]>`
      SELECT type FROM timeline_events WHERE patient_id = ${patientId2}`;

    ok('call2 status = Resolved',    call2[0]?.status === 'Resolved');
    ok('call2 duration_sec = 65',    call2[0]?.duration_sec === 65);
    ok('call2 patient_id linked',    call2[0]?.patient_id === patientId2);
    ok('encounter2 triage_level = LOW', enc2[0]?.triage_level === 'LOW');
    ok('timeline has 1 event',       tl2.length === 1);
    ok('timeline event type = call', tl2[0]?.type === 'call');

    /* ── 11. Schema — verify all 6 tables exist ──────────── */
    section('11. Schema integrity — all tables accessible');

    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('patients','calls','encounters','timeline_events','doctor_notes','test_results')
      ORDER BY tablename
    `;
    const tableNames = tables.map((t) => t.tablename);

    for (const name of ['calls', 'doctor_notes', 'encounters', 'patients', 'test_results', 'timeline_events']) {
      ok(`table "${name}" exists`, tableNames.includes(name));
    }

  } finally {
    await cleanup();
    await sql.end();
  }

  /* ── Summary ─────────────────────────────────────────── */
  console.log('\n╔══ Results ═════════════════════════════════════════╗');
  console.log(`║  Passed : ${passed}`);
  console.log(`║  Failed : ${failed}`);
  if (errors.length > 0) {
    console.log('╠══ Failed checks ═══════════════════════════════════╣');
    errors.forEach((e) => console.log(`║  • ${e}`));
  }
  console.log('╚════════════════════════════════════════════════════╝\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nFatal error during test run:', err);
  sql.end().finally(() => process.exit(1));
});
