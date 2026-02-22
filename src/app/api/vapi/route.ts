import { NextRequest, NextResponse } from "next/server";
import { liveCallStore } from "@/lib/live-calls";
import type { LiveCall } from "@/lib/live-calls";
import { extractCallProfile } from "@/lib/gemini";
import {
  finalizeCall,
  upsertPatient,
  createEncounter,
  createTimelineEvent,
  getPatientFullByPhone,
  getDoctorNotesByPatientId,
} from "@/lib/db";

/* ── End-of-call processing pipeline ───────────────── */
// Runs as a fire-and-forget after the webhook returns 200.
// Extracts the full patient profile via Gemini, then persists everything
// to Supabase: finalizes the call record, upserts the patient profile,
// creates an encounter, and appends a timeline event.

async function processEndOfCall(call: LiveCall, durationSec: number) {
  console.log(`[EndOfCall] Processing call ${call.id} (${call.transcript.length} transcript lines)`);

  // ── Step 1: Persist transcript immediately (before any Gemini call) ────────
  // This ensures data is never lost due to Cloud Run CPU throttling after
  // the response is returned, or Gemini rate-limiting / timeout.
  let patientId: string | undefined;
  try {
    patientId = await upsertPatient({ phone: call.phoneNumber });
    console.log(`[EndOfCall] Initial patient upsert → ${patientId}`);
  } catch (err) {
    console.error('[EndOfCall] Initial patient upsert failed:', err);
  }

  await finalizeCall(call.id, {
    callerPhone: call.phoneNumber,
    durationSec,
    status: 'Needs review',
    triageLevel: 'MED',
    reasonShort: 'Pending AI analysis',
    chiefComplaint: '',
    symptoms: [],
    riskFlags: [],
    summary: '',
    recommendation: '',
    transcript: call.transcript,
    patientId,
  });
  console.log(`[EndOfCall] ✓ Transcript + patient saved for call ${call.id}`);

  // ── Step 2: Gemini extraction (updates the record we just saved) ────────────
  // If Gemini fails for any reason, the transcript + call record are already in DB.
  const existingPatient = await getPatientFullByPhone(call.phoneNumber).catch(() => null);

  const extraction = await extractCallProfile(call.transcript, existingPatient);

  if (!extraction) {
    console.log(`[EndOfCall] Gemini returned no extraction for call ${call.id} — keeping preliminary record`);
    return;
  }

  // ── Step 3: Update everything with full Gemini data ────────────────────────
  const fullPatientId = await upsertPatient({
    phone: call.phoneNumber,
    name: extraction.patient.name,
    age: extraction.patient.age,
    sex: extraction.patient.sex,
    allergies: extraction.patient.allergies,
    riskLevel: extraction.patient.riskLevel,
    patientStatus: extraction.patient.patientStatus,
    conditions: extraction.patient.conditions,
    medications: extraction.patient.medications,
    priorEpisodes: extraction.patient.priorEpisodes,
    lastContact: call.createdAt,
  });

  await finalizeCall(call.id, {
    callerPhone: call.phoneNumber,
    durationSec,
    status: extraction.call.callStatus,
    triageLevel: extraction.call.triageLevel,
    reasonShort: extraction.call.reasonShort,
    chiefComplaint: extraction.call.chiefComplaint,
    symptoms: extraction.call.symptoms,
    riskFlags: extraction.call.riskFlags,
    summary: extraction.call.summary,
    recommendation: extraction.call.recommendation,
    transcript: call.transcript,
    patientId: fullPatientId,
  });

  await createEncounter({
    patientId: fullPatientId,
    callId: call.id,
    timestamp: call.createdAt,
    chiefComplaint: extraction.encounter.chiefComplaint,
    symptoms: extraction.encounter.symptoms,
    triageLevel: extraction.call.triageLevel,
    outcome: extraction.encounter.outcome,
  });

  await createTimelineEvent({
    patientId: fullPatientId,
    type: 'call',
    timestamp: call.createdAt,
    title: `Triage call — ${extraction.call.reasonShort}`,
    description: extraction.call.summary,
    metadata: {
      triageLevel: extraction.call.triageLevel,
      callStatus: extraction.call.callStatus,
      callId: call.id,
    },
  });

  console.log(
    `[EndOfCall] ✓ Full extraction done: call ${call.id} → patient ${fullPatientId} | ${extraction.call.callStatus} | ${extraction.call.triageLevel}`,
  );
}

/* ── Webhook handler ────────────────────────────────── */

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message } = body;

  if (!message?.type) {
    return NextResponse.json({ ok: true });
  }

  const callId = message.call?.id;

  // Auto-start the call on the first event we see for it
  if (callId && !liveCallStore.has(callId) && message.type !== "end-of-call-report") {
    const phone = message.call?.customer?.number || "***-***-****";
    console.log(`[Vapi] Auto-starting call ${callId} (first event: ${message.type})`);
    liveCallStore.startCall(callId, phone);
    console.log(`[Vapi] Store now has ${liveCallStore.getAll().length} live calls, listeners: ${liveCallStore.listenerCount('update')}`);
  }

  switch (message.type) {
    case "assistant-request": {
      const phone = message.call?.customer?.number ?? null;
      let patientName = 'there';
      let patientContext = 'New patient — no prior record on file.';

      if (phone) {
        const patient = await getPatientFullByPhone(phone).catch(() => null);
        if (patient) {
          const allergies  = patient.allergies.length   ? patient.allergies.join(', ')                                                     : 'none on record';
          const conditions = patient.conditions.length  ? patient.conditions.map(c => `${c.name} (${c.status})`).join(', ')               : 'none on record';
          const meds       = patient.medications.length ? patient.medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join(', ') : 'none on record';
          const episodes   = patient.priorEpisodes.length ? patient.priorEpisodes.join('; ')                                               : 'none on record';

          const notes = await getDoctorNotesByPatientId(patient.id).catch(() => []);
          const notesBlock = notes.length > 0
            ? notes.map(n => {
                const date = new Date(n.created_at).toISOString().slice(0, 10);
                const author = n.author_name ?? 'Unknown provider';
                return `  [${date}] ${author}: ${n.content}`;
              }).join('\n')
            : '  none on record';

          patientName = patient.name ?? 'there';
          patientContext = [
            `RETURNING PATIENT — record found in database.`,
            `Name: ${patient.name ?? 'Unknown'} | Age: ${patient.age ?? 'Unknown'} | Sex: ${patient.sex ?? 'Unknown'}`,
            `Allergies: ${allergies}`,
            `Conditions: ${conditions}`,
            `Medications: ${meds}`,
            `Prior episodes: ${episodes}`,
            `Recent doctor notes:\n${notesBlock}`,
          ].join('\n');
        }
      }

      console.log(`[Vapi] assistant-request for ${phone ?? 'unknown'} → ${patientContext.startsWith('RETURNING') ? 'returning' : 'new'} patient`);

      return NextResponse.json({
        assistantId: process.env.VAPI_ASSISTANT_ID,
        assistantOverrides: {
          variableValues: { patientName, patientContext },
        },
      });
    }

    case "status-update": {
      const status = message.call?.status;
      console.log(`[Vapi] Status: ${status} for call ${callId}`);

      if (status === "ended" && callId) {
        console.log(`[Vapi] Call ended. Reason: ${message.endedReason || "unknown"}`);
        liveCallStore.endCall(callId, message.endedReason || "unknown");
      }
      break;
    }

    case "transcript": {
      if (message.transcriptType === "final" && callId && message.transcript) {
        const role = message.role || "user";
        liveCallStore.addTranscript(callId, role, message.transcript);
        console.log(`[Vapi] Transcript (${role}): ${message.transcript.slice(0, 80)}`);
      }
      break;
    }

    case "conversation-update": {
      // Vapi sends the transcript as `message.conversation`
      const convo = message.conversation as { role: string; content: string }[] | undefined;
      if (callId && convo?.length) {
        liveCallStore.syncTranscript(callId, convo);
        console.log(`[Vapi] Conversation update for call ${callId} (${convo.length} messages)`);
      }
      break;
    }

    case "end-of-call-report": {
      console.log("[Vapi] Call ended", {
        callId,
        duration: message.call?.duration,
        cost: message.call?.cost,
        artifactLines: message.artifact?.messages?.length ?? 0,
        transcript: message.artifact?.transcript?.slice(0, 200),
      });

      if (callId) {
        let call = liveCallStore.getById(callId);
        // Prefer Vapi-reported duration; fall back to computing from startedAt/endedAt timestamps
        const vapiDuration = Math.round(message.call?.duration ?? 0);
        const startedAt: string | undefined = message.call?.startedAt;
        const endedAt: string | undefined   = message.call?.endedAt;
        const computedDuration = (startedAt && endedAt)
          ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
          : 0;
        const durationSec = vapiDuration > 0 ? vapiDuration : computedDuration;
        console.log(`[Vapi] Duration: vapiReported=${vapiDuration}s computed=${computedDuration}s → using ${durationSec}s`);
        const phone = message.call?.customer?.number || "***-***-****";

        // The call may have been auto-started from conversation-update which sometimes lacks
        // customer.number, leaving phoneNumber as "***-***-****". The end-of-call-report always
        // carries the real number — write it back so processEndOfCall uses the correct phone for
        // patient lookup / creation.
        if (call && phone !== "***-***-****") {
          call.phoneNumber = phone;
        }

        // Vapi artifact.messages uses { role, message } but conversation-update uses { role, content }.
        // Normalize to { role, content } so syncTranscript handles both sources identically.
        const rawArtifactMessages = message.artifact?.messages as
          | { role: string; content?: string; message?: string }[]
          | undefined;
        const artifactMessages = rawArtifactMessages
          ?.map((m) => ({ role: m.role, content: (m.content || m.message || '').trim() }))
          .filter((m) => m.content);

        // If call is not in memory (server restarted mid-call?), reconstruct from artifact
        if (!call) {
          if (artifactMessages?.length) {
            console.log(`[Vapi] Call ${callId} not in memory — reconstructing from artifact (${artifactMessages.length} messages)`);
            liveCallStore.startCall(callId, phone);
            liveCallStore.syncTranscript(callId, artifactMessages);
            call = liveCallStore.getById(callId);
          } else {
            console.error(`[Vapi] end-of-call-report: call ${callId} not in memory and no artifact messages — cannot process`);
          }
        } else if (artifactMessages && artifactMessages.length > call.transcript.length) {
          // Artifact has more messages than in-memory — supplement to ensure full transcript for Gemini
          console.log(`[Vapi] Supplementing in-memory transcript (${call.transcript.length}) with artifact (${artifactMessages.length} messages)`);
          liveCallStore.syncTranscript(callId, artifactMessages);
          call = liveCallStore.getById(callId);
        }

        // End the call in the in-memory store (triggers SSE update to dashboard)
        liveCallStore.endCall(callId, message.endedReason || "completed");

        // Fire-and-forget: run full Gemini extraction + persist to Supabase
        if (call) {
          processEndOfCall(call, durationSec).catch((err) =>
            console.error(`[EndOfCall] Pipeline failed for call ${callId}:`, err),
          );
        }
      }
      break;
    }

    case "speech-update":
    case "user-interrupted":
      break;

    case "function-call": {
      console.log("[Vapi] Function call:", message.functionCall?.name);
      break;
    }

    default:
      console.log(`[Vapi] Unhandled event: ${message.type}`);
  }

  return NextResponse.json({ ok: true });
}
