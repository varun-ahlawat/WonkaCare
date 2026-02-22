import { NextRequest, NextResponse } from 'next/server';
import {
  getCallByIdFromDB,
  finalizeCall,
  upsertPatient,
  getPatientFullByPhone,
} from '@/lib/db';
import { extractCallProfile } from '@/lib/gemini';
import type { TranscriptLine } from '@/lib/mock-call-logs';

// POST /api/calls/[id]/analyze
// Re-runs Gemini extraction on the stored transcript and updates the call + patient records.
// Used when the original extraction failed (e.g. Gemini rate-limited at call-end time).

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await getCallByIdFromDB(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const transcript = (Array.isArray(row.transcript) ? row.transcript : []) as TranscriptLine[];
  if (transcript.length < 2) {
    return NextResponse.json(
      { error: 'Transcript too short — nothing to analyze' },
      { status: 422 },
    );
  }

  const callerPhone = (row.caller_phone as string) ?? '';

  // Inject existing patient context if available (same logic as processEndOfCall)
  const existingPatient = callerPhone
    ? await getPatientFullByPhone(callerPhone).catch(() => null)
    : null;

  const extraction = await extractCallProfile(transcript, existingPatient);
  if (!extraction) {
    return NextResponse.json(
      { error: 'Gemini analysis failed — try again in a moment' },
      { status: 503 },
    );
  }

  // Upsert patient (create if new, update if existing)
  const patientId = await upsertPatient({
    phone: callerPhone,
    name: extraction.patient.name,
    age: extraction.patient.age,
    sex: extraction.patient.sex,
    allergies: extraction.patient.allergies,
    riskLevel: extraction.patient.riskLevel,
    patientStatus: extraction.patient.patientStatus,
    conditions: extraction.patient.conditions,
    medications: extraction.patient.medications,
    priorEpisodes: extraction.patient.priorEpisodes,
  });

  // Update the call record with full extraction
  await finalizeCall(id, {
    callerPhone,
    durationSec: (row.duration_sec as number) ?? 0,
    status: extraction.call.callStatus,
    triageLevel: extraction.call.triageLevel,
    reasonShort: extraction.call.reasonShort,
    chiefComplaint: extraction.call.chiefComplaint,
    symptoms: extraction.call.symptoms,
    riskFlags: extraction.call.riskFlags,
    summary: extraction.call.summary,
    recommendation: extraction.call.recommendation,
    transcript,
    patientId,
  });

  const updated = await getCallByIdFromDB(id);
  return NextResponse.json(updated);
}
