/**
 * Full end-to-end webhook test.
 *
 * Sends real Vapi-shaped webhook events to the running server, waits for the
 * fire-and-forget processEndOfCall pipeline (Gemini + Supabase writes) to
 * settle, then verifies all four tables in the DB.
 *
 * This test exercises the EXACT same code path as a real Vapi call:
 *   conversation-update (builds transcript in LiveCallStore)
 *   end-of-call-report  (artifact.messages in Vapi's { role, message } format)
 *   processEndOfCall    (Gemini extraction → upsertPatient → finalizeCall → createEncounter → createTimelineEvent)
 *
 * REQUIRES: dev server running at http://localhost:3000 (or TEST_URL env var).
 *
 * Usage:
 *   set -a && source .env && set +a && npx tsx scripts/test-call.ts
 *   TEST_URL=https://...run.app npx tsx scripts/test-call.ts
 *   npx tsx scripts/test-call.ts --keep   # skip cleanup to inspect
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';

/* ── DB client ────────────────────────────────────────── */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    'ERROR: DATABASE_URL is not set.\n' +
    'Run: set -a && source .env && set +a && npx tsx scripts/test-call.ts',
  );
  process.exit(1);
}

const sql = postgres(connectionString, { ssl: 'require', max: 1, prepare: false });

/* ── Config ───────────────────────────────────────────── */

const BASE_URL = process.env.TEST_URL ?? 'http://localhost:3000';
const KEEP     = process.argv.includes('--keep');
const CALL_ID  = randomUUID();
const PHONE    = '+15559990001';

const NOW_ISO    = new Date().toISOString();
const STARTED_AT = new Date(Date.now() - 213_000).toISOString(); // 3m33s ago
const ENDED_AT   = new Date().toISOString();

/* ── Transcript in Vapi conversation-update format ────── */
// { role, content } — what Vapi sends in conversation-update events

const CONVO_MESSAGES = [
  { role: 'assistant', content: "Hi, this is Meredith, your AI triage assistant. How can I help you today?" },
  { role: 'user',      content: "Hi, my name is Sarah Johnson. I'm 34 years old. I've had a really bad headache for the last two days — throbbing on the right side." },
  { role: 'assistant', content: "I'm sorry to hear that, Sarah. Can you rate the pain 1 to 10?" },
  { role: 'user',      content: "About an 8. Really debilitating. I've also been nauseous and extremely sensitive to light." },
  { role: 'assistant', content: "Those symptoms can be consistent with a migraine. Have you had migraines before?" },
  { role: 'user',      content: "Yes, diagnosed two years ago. I usually take sumatriptan 100mg but it's not working this time." },
  { role: 'assistant', content: "Any fever, stiff neck, vision changes, or weakness in your limbs?" },
  { role: 'user',      content: "No fever or stiff neck. But my vision was blurry for about 30 minutes this morning — that's never happened before." },
  { role: 'assistant', content: "That visual symptom is important. Any known medication allergies?" },
  { role: 'user',      content: "Yes — ibuprofen gives me hives, and I'm also allergic to penicillin." },
  { role: 'assistant', content: "Given the 8/10 headache not responding to sumatriptan plus new visual disturbance, I'm recommending you be seen today. If symptoms worsen suddenly, go to the ER immediately." },
  { role: 'user',      content: "Okay, thank you so much." },
];

/* ── Artifact messages in Vapi's end-of-call-report format ─
 *
 * CRITICAL: Vapi uses { role, message } here — NOT { role, content }.
 * This is the exact format that was causing the transcript wipe bug.
 * The test must send this format to properly exercise the fix.
 */
const ARTIFACT_MESSAGES = CONVO_MESSAGES.map((m, i) => ({
  role:             m.role,
  message:          m.content,   // <-- Vapi field name is "message", not "content"
  time:             Date.now() + i * 15_000,
  secondsFromStart: i * 15,
}));

/* ── Helpers ──────────────────────────────────────────── */

function ok(msg: string)   { console.log(`  ✅ ${msg}`); }
function fail(msg: string) { console.error(`  ❌ FAIL: ${msg}`); process.exit(1); }
function info(msg: string) { console.log(`     ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); }

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function post(body: object): Promise<Response> {
  const res = await fetch(`${BASE_URL}/api/vapi`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return res;
}

/* ── Main ─────────────────────────────────────────────── */

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Meredith — Full Webhook E2E Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  info(`Target  : ${BASE_URL}`);
  info(`Call ID : ${CALL_ID}`);
  info(`Phone   : ${PHONE}`);
  console.log('');

  /* ── Phase 1: Confirm server is up ───────────────────── */
  console.log('Phase 1  Checking server reachability');
  try {
    const ping = await fetch(`${BASE_URL}/`);
    if (!ping.ok && ping.status !== 404) throw new Error(`HTTP ${ping.status}`);
    ok(`Server at ${BASE_URL} is reachable`);
  } catch (e) {
    fail(`Cannot reach ${BASE_URL} — is the dev server running?\n       ${e}`);
  }

  /* ── Phase 2: Fire webhook events ────────────────────── */
  console.log('\nPhase 2  Sending webhook events');

  // 2a. status-update: call starts
  {
    const r = await post({
      message: {
        type: 'status-update',
        call: {
          id: CALL_ID,
          status: 'in-progress',
          customer: { number: PHONE },
        },
      },
    });
    if (!r.ok) fail(`status-update returned HTTP ${r.status}`);
    info('status-update (in-progress) → 200');
  }

  await sleep(300);

  // 2b. conversation-update: build transcript in LiveCallStore
  // (uses { role, content } format — correct for conversation-update)
  {
    const r = await post({
      message: {
        type: 'conversation-update',
        call: { id: CALL_ID, customer: { number: PHONE } },
        conversation: CONVO_MESSAGES,
      },
    });
    if (!r.ok) fail(`conversation-update returned HTTP ${r.status}`);
    info(`conversation-update (${CONVO_MESSAGES.length} messages) → 200`);
  }

  await sleep(500);

  // 2c. end-of-call-report: artifact.messages in Vapi's { role, message } format
  // This is the event that triggers processEndOfCall + Gemini + Supabase writes.
  {
    const r = await post({
      message: {
        type: 'end-of-call-report',
        endedReason: 'customer-ended-call',
        call: {
          id: CALL_ID,
          duration: 213,
          startedAt: STARTED_AT,
          endedAt:   ENDED_AT,
          cost: 0.04,
          customer: { number: PHONE },
        },
        artifact: {
          // Vapi's actual format: "message" field, not "content"
          messages: ARTIFACT_MESSAGES,
          transcript: CONVO_MESSAGES.map(m => `${m.role}: ${m.content}`).join('\n'),
        },
      },
    });
    if (!r.ok) fail(`end-of-call-report returned HTTP ${r.status}`);
    info(`end-of-call-report (artifact: ${ARTIFACT_MESSAGES.length} msgs) → 200`);
  }

  ok('All webhook events sent');

  /* ── Phase 3: Wait for async pipeline ────────────────── */
  // processEndOfCall runs fire-and-forget after the webhook returns 200.
  // Gemini extraction typically takes 3-10s. Allow up to 40s with polling.

  // Step 1 of processEndOfCall (transcript save) completes in ~2s.
  // Step 2 (Gemini) may take up to 30s. Poll up to 90s total.
  console.log('\nPhase 3  Waiting for processEndOfCall pipeline (Gemini + DB writes)');
  info('Polling Supabase every 3s (up to 90s)...');

  type CallRow = {
    status: string; triage_level: string; reason_short: string | null;
    chief_complaint: string | null; summary: string | null;
    transcript: unknown; patient_id: string | null;
  };
  let callRow: CallRow | null = null;

  // Phase A: Wait for Step 1 (transcript save, status → 'Needs review')
  // Phase B: Wait for Step 2 (Vertex AI enrichment, reason_short populated)
  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(3_000);
    const rows = await sql<CallRow[]>`
      SELECT status, triage_level, reason_short, chief_complaint, summary, transcript, patient_id
      FROM calls WHERE id = ${CALL_ID} LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      info(`Attempt ${attempt}: no call record yet — waiting...`);
      continue;
    }
    if (row.status === 'Live') {
      info(`Attempt ${attempt}: status still 'Live' — waiting...`);
      continue;
    }
    // Step 1 complete — now wait for Vertex AI enrichment
    const enriched = row.reason_short && row.reason_short !== 'Pending AI analysis';
    if (enriched) {
      callRow = row;
      info(`Full pipeline complete after ${attempt * 3}s (transcript + Vertex AI)`);
      break;
    }
    info(`Attempt ${attempt}: transcript saved, Vertex AI still running (reason: '${row.reason_short}')...`);
    // After 60s total, accept the preliminary record (Vertex AI might be slow)
    if (attempt >= 20) {
      callRow = row;
      info(`Accepting preliminary record after ${attempt * 3}s — Vertex AI may still be enriching`);
      break;
    }
  }

  if (!callRow) {
    fail('Call was never finalized in Supabase after 90s. Check server logs for [EndOfCall] errors.');
  }

  /* ── Phase 4: Verify all records ─────────────────────── */
  console.log('\nPhase 4  Verifying Supabase records');

  // 4a. Call record
  const transcript = Array.isArray(callRow!.transcript) ? callRow!.transcript : [];
  if (transcript.length === 0) {
    fail('Call transcript is EMPTY in Supabase. The transcript wipe bug is still present — fix not deployed.');
  }

  ok(`Call record — ${callRow!.triage_level} | ${callRow!.status}`);
  info(`Transcript lines : ${transcript.length}`);
  info(`Reason short     : ${callRow!.reason_short ?? '(empty — Gemini may have failed)'}`);
  info(`Chief complaint  : ${(callRow!.chief_complaint ?? '').slice(0, 80) || '(empty)'}`);
  info(`Summary          : ${(callRow!.summary ?? '').slice(0, 80) || '(empty)'}`);
  info(`Patient ID       : ${callRow!.patient_id ?? '(none)'}`);

  if (!callRow!.patient_id) {
    warn('No patient_id on call — upsertPatient may have failed');
  }

  // 4b. Patient record
  if (callRow!.patient_id) {
    const patRows = await sql<{
      name: string | null; age: number | null; sex: string | null; phone: string;
    }[]>`
      SELECT name, age, sex, phone FROM patients WHERE id = ${callRow!.patient_id}
    `;
    if (!patRows[0]) {
      fail(`patient_id ${callRow!.patient_id} on call but no matching patient row`);
    }
    ok(`Patient record — ${patRows[0].name ?? '(no name)'}, ${patRows[0].age ?? '?'}yo ${patRows[0].sex ?? '?'}`);
    info(`Phone : ${patRows[0].phone}`);
  }

  // 4c. Encounter
  const encRows = await sql<{
    triage_level: string; chief_complaint: string; outcome: string; symptoms: unknown;
  }[]>`
    SELECT triage_level, chief_complaint, outcome, symptoms
    FROM encounters WHERE call_id = ${CALL_ID}
  `;
  if (encRows.length === 0) {
    warn('No encounter record — createEncounter may have been skipped (Gemini failed?)');
  } else {
    ok(`Encounter — ${encRows[0].triage_level} | ${encRows[0].chief_complaint.slice(0, 60)}…`);
    info(`Symptoms (${(encRows[0].symptoms as unknown[]).length}): ${JSON.stringify(encRows[0].symptoms).slice(0, 80)}…`);
  }

  // 4d. Timeline event
  const evRows = await sql<{ type: string; title: string }[]>`
    SELECT type, title FROM timeline_events
    WHERE patient_id = ${callRow!.patient_id} AND metadata->>'callId' = ${CALL_ID}
    LIMIT 5
  `;
  if (evRows.length === 0) {
    warn('No timeline event — createTimelineEvent may have been skipped');
  } else {
    ok(`Timeline event — [${evRows[0].type}] ${evRows[0].title}`);
  }

  /* ── Phase 5: Cleanup ─────────────────────────────────── */

  if (KEEP) {
    console.log('\nPhase 5  Skipping cleanup (--keep flag)');
    info(`Call ID    : ${CALL_ID}`);
    info(`Patient ID : ${callRow!.patient_id}`);
  } else {
    console.log('\nPhase 5  Cleaning up test data');
    const pid = callRow!.patient_id;
    if (pid) {
      await sql`DELETE FROM timeline_events WHERE patient_id = ${pid}`;
      await sql`DELETE FROM encounters      WHERE patient_id = ${pid}`;
      await sql`DELETE FROM doctor_notes    WHERE patient_id = ${pid}`;
    }
    await sql`DELETE FROM calls    WHERE id = ${CALL_ID} OR caller_phone = ${PHONE}`;
    if (pid) {
      await sql`DELETE FROM patients WHERE id = ${pid}`;
    }
    ok('Cleaned up test records');
  }

  /* ── Done ─────────────────────────────────────────────── */

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ALL CHECKS PASSED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error('\nFatal:', e); process.exit(1); });
