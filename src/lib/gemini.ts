import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranscriptLine, TriageLevel } from './mock-call-logs';
import type { ExistingPatientContext } from './db';

/* ── Vertex AI helper ───────────────────────────────── */
// Vertex AI uses a different endpoint and auth from Google AI Studio.
// Endpoint: https://aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent?key={VERTEX_API_KEY}
// Request body is identical to the Gemini API — just a different host + key.

const VERTEX_API_KEY = process.env.VERTEX_API_KEY;
const VERTEX_MODEL   = 'gemini-2.5-flash';

async function vertexGenerate(
  parts: { text: string }[],
  model = VERTEX_MODEL,
  timeoutMs = 25_000,
): Promise<string> {
  if (!VERTEX_API_KEY) throw new Error('VERTEX_API_KEY is not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${VERTEX_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Vertex AI HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Vertex AI: unexpected response shape — ${JSON.stringify(data).slice(0, 200)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/* ── End-of-call comprehensive extraction ───────────── */

const SCHEMA_BLOCK = `Return ONLY valid JSON with this exact schema (use null for unknown fields):
{
  "call": {
    "triageLevel": "HIGH" | "MED" | "LOW",
    "reasonShort": "5-8 word reason for the call",
    "chiefComplaint": "1-2 sentence chief complaint",
    "symptoms": ["array of identified symptoms"],
    "riskFlags": ["array of risk factors"],
    "summary": "2-3 sentence clinical summary",
    "recommendation": "recommended next steps",
    "callStatus": "Escalated" | "Needs review" | "Resolved"
  },
  "patient": {
    "name": "full name or null",
    "age": number or null,
    "sex": "M" | "F" or null,
    "allergies": ["known allergies mentioned"],
    "riskLevel": "HIGH" | "MED" | "LOW",
    "patientStatus": "Critical" | "Active" | "Stable" | "Follow-up needed",
    "conditions": [{"name": "condition", "diagnosedDate": "YYYY-MM-DD or empty string", "status": "Active" | "Resolved" | "Chronic"}],
    "medications": [{"name": "medication", "dosage": "dosage or empty string", "frequency": "frequency or empty string", "startedDate": "YYYY-MM-DD or empty string"}],
    "priorEpisodes": ["prior medical episodes mentioned"]
  },
  "encounter": {
    "chiefComplaint": "primary presenting complaint",
    "symptoms": [{"name": "symptom", "severity": "Mild" | "Moderate" | "Severe", "onset": "onset description", "notes": "additional context or empty string"}],
    "outcome": "what was decided / what happened at the end of this call"
  }
}

Rules:
- callStatus "Escalated": emergency dispatched, patient sent to ER, or immediate escalation occurred
- callStatus "Resolved": issue fully handled (prescription, scheduling, information request answered)
- callStatus "Needs review": clinical concern requiring follow-up not immediately resolved
- triageLevel HIGH: life-threatening (cardiac, stroke, severe respiratory, altered consciousness, major trauma)
- triageLevel MED: significant concern requiring timely clinical attention
- triageLevel LOW: non-urgent (administrative, minor symptoms, information-only)
- patientStatus "Critical" for active emergencies, "Active" for ongoing issues, "Stable" for managed conditions, "Follow-up needed" for pending items
- riskLevel should match triageLevel
- Return ONLY the JSON object, no markdown fences or explanation`;

function buildEndOfCallPrompt(existingPatient?: ExistingPatientContext | null): string {
  if (existingPatient) {
    const conditionsSummary = existingPatient.conditions.length > 0
      ? existingPatient.conditions.map(c => `${c.name} (${c.status}, diagnosed ${c.diagnosedDate || 'unknown'})`).join('; ')
      : 'None on record';
    const medsSummary = existingPatient.medications.length > 0
      ? existingPatient.medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join('; ')
      : 'None on record';
    const allergyList = existingPatient.allergies.length > 0
      ? existingPatient.allergies.join(', ')
      : 'None on record';
    const episodeList = existingPatient.priorEpisodes.length > 0
      ? existingPatient.priorEpisodes.join('; ')
      : 'None on record';

    return `You are a medical AI analyst completing post-call processing for a patient triage phone call.

EXISTING PATIENT RECORD (retrieved from database by caller phone number):
  Name: ${existingPatient.name ?? 'Unknown'}
  Age: ${existingPatient.age ?? 'Unknown'}
  Sex: ${existingPatient.sex ?? 'Unknown'}
  Allergies: ${allergyList}
  Conditions: ${conditionsSummary}
  Medications: ${medsSummary}
  Prior episodes: ${episodeList}

INSTRUCTIONS FOR EXISTING PATIENT:
- You are UPDATING this patient's record with information from the new call
- In the "patient" section, start with the existing values above as your baseline
- Only change a field if the transcript explicitly provides new or updated information
- Do NOT blank out or remove existing data — if the transcript doesn't mention it, keep it as-is
- Do NOT guess or invent information not present in the transcript
- If the patient mentions a new condition, medication, allergy, or episode, ADD it to the existing list

${SCHEMA_BLOCK}`;
  }

  return `You are a medical AI analyst completing post-call processing for a patient triage phone call.

NEW PATIENT — no prior record found for this caller's phone number.

INSTRUCTIONS FOR NEW PATIENT:
This is the schema you must fill from this person's transcript. Fill in as much as you can given this transcript.
Do not make any guesses for missing information unless 100% sure based on what was explicitly stated in the call.
Leave fields as null if the transcript does not clearly indicate the value.

${SCHEMA_BLOCK}`;
}

export interface CallProfileExtraction {
  call: {
    triageLevel: TriageLevel;
    reasonShort: string;
    chiefComplaint: string;
    symptoms: string[];
    riskFlags: string[];
    summary: string;
    recommendation: string;
    callStatus: 'Escalated' | 'Needs review' | 'Resolved';
  };
  patient: {
    name?: string;
    age?: number;
    sex?: 'M' | 'F';
    allergies: string[];
    riskLevel: TriageLevel;
    patientStatus: 'Critical' | 'Active' | 'Stable' | 'Follow-up needed';
    conditions: Array<{ name: string; diagnosedDate: string; status: 'Active' | 'Resolved' | 'Chronic' }>;
    medications: Array<{ name: string; dosage: string; frequency: string; startedDate: string }>;
    priorEpisodes: string[];
  };
  encounter: {
    chiefComplaint: string;
    symptoms: Array<{ name: string; severity: 'Mild' | 'Moderate' | 'Severe'; onset: string; notes?: string }>;
    outcome: string;
  };
}

export async function extractCallProfile(
  transcript: TranscriptLine[],
  existingPatient?: ExistingPatientContext | null,
): Promise<CallProfileExtraction | null> {
  if (transcript.length < 2) return null;

  const transcriptText = transcript
    .map((l) => `[${l.timestamp}] ${l.speaker}: ${l.text}`)
    .join('\n');

  const prompt = buildEndOfCallPrompt(existingPatient);

  try {
    const rawText = await vertexGenerate([
      { text: prompt },
      { text: `TRANSCRIPT:\n${transcriptText}` },
    ]);

    const jsonStr = rawText.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const p = JSON.parse(jsonStr);

    const validTriage = (v: unknown): TriageLevel =>
      (['HIGH', 'MED', 'LOW'] as const).includes(v as TriageLevel) ? (v as TriageLevel) : 'MED';

    return {
      call: {
        triageLevel: validTriage(p.call?.triageLevel),
        reasonShort: p.call?.reasonShort || 'Call completed',
        chiefComplaint: p.call?.chiefComplaint || '',
        symptoms: Array.isArray(p.call?.symptoms) ? p.call.symptoms : [],
        riskFlags: Array.isArray(p.call?.riskFlags) ? p.call.riskFlags : [],
        summary: p.call?.summary || '',
        recommendation: p.call?.recommendation || '',
        callStatus: (['Escalated', 'Needs review', 'Resolved'] as const).includes(p.call?.callStatus)
          ? p.call.callStatus
          : 'Needs review',
      },
      patient: {
        name: p.patient?.name || undefined,
        age: typeof p.patient?.age === 'number' ? p.patient.age : undefined,
        sex: (['M', 'F'] as const).includes(p.patient?.sex) ? p.patient.sex : undefined,
        allergies: Array.isArray(p.patient?.allergies) ? p.patient.allergies : [],
        riskLevel: validTriage(p.patient?.riskLevel),
        patientStatus: (['Critical', 'Active', 'Stable', 'Follow-up needed'] as const).includes(
          p.patient?.patientStatus,
        )
          ? p.patient.patientStatus
          : 'Active',
        conditions: Array.isArray(p.patient?.conditions)
          ? p.patient.conditions.map((c: { name: string; diagnosedDate?: string; status?: string }) => ({
              name: c.name || '',
              diagnosedDate: c.diagnosedDate || '',
              status: (['Active', 'Resolved', 'Chronic'] as string[]).includes(c.status ?? '')
                ? (c.status as 'Active' | 'Resolved' | 'Chronic')
                : 'Active',
            }))
          : [],
        medications: Array.isArray(p.patient?.medications)
          ? p.patient.medications.map((m: { name: string; dosage?: string; frequency?: string; startedDate?: string }) => ({
              name: m.name || '',
              dosage: m.dosage || '',
              frequency: m.frequency || '',
              startedDate: m.startedDate || '',
            }))
          : [],
        priorEpisodes: Array.isArray(p.patient?.priorEpisodes) ? p.patient.priorEpisodes : [],
      },
      encounter: {
        chiefComplaint: p.encounter?.chiefComplaint || '',
        symptoms: Array.isArray(p.encounter?.symptoms)
          ? p.encounter.symptoms.map((s: { name: string; severity?: string; onset?: string; notes?: string }) => ({
              name: s.name || '',
              severity: (['Mild', 'Moderate', 'Severe'] as string[]).includes(s.severity ?? '')
                ? (s.severity as 'Mild' | 'Moderate' | 'Severe')
                : 'Moderate',
              onset: s.onset || 'unknown',
              notes: s.notes || undefined,
            }))
          : [],
        outcome: p.encounter?.outcome || '',
      },
    };
  } catch (err) {
    console.error('[Gemini] extractCallProfile failed:', err);
    return null;
  }
}

/* ── Live-call lightweight summary ─────────────────── */

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export interface AISummary {
  patientName?: string;
  age?: number;
  sex?: 'M' | 'F';
  symptoms: string[];
  riskFlags: string[];
  triageLevel: TriageLevel;
  reasonShort: string;
  chiefComplaint: string;
  summary: string;
  recommendation: string;
}

const SYSTEM_PROMPT = `You are a medical triage AI. Analyze this phone call transcript between a patient (Caller) and a triage agent (Agent). Extract structured patient information as it becomes available.

Return ONLY valid JSON with these fields (omit fields you can't determine yet):
{
  "patientName": "string or null",
  "age": number or null,
  "sex": "M" or "F" or null,
  "symptoms": ["array of identified symptoms"],
  "riskFlags": ["array of concerning risk factors"],
  "triageLevel": "HIGH" or "MED" or "LOW",
  "reasonShort": "brief 5-8 word reason for the call",
  "chiefComplaint": "1-2 sentence chief complaint",
  "summary": "2-3 sentence clinical summary of what's known so far",
  "recommendation": "recommended next step based on current information"
}

Rules:
- Only include information explicitly stated or strongly implied in the transcript
- Set triageLevel to HIGH for chest pain, difficulty breathing, severe bleeding, stroke symptoms, etc.
- Set triageLevel to MED for moderate pain, fever, persistent symptoms, etc.
- Set triageLevel to LOW for minor issues, prescription refills, general questions, etc.
- If not enough info yet, use triageLevel "MED" as default and note limited information in summary
- Keep reasonShort concise (e.g. "Chest pain + shortness of breath")
- Return ONLY the JSON object, no markdown fences or explanation`;

export async function summarizeTranscript(
  transcript: TranscriptLine[],
): Promise<AISummary | null> {
  if (transcript.length < 2) return null;

  const transcriptText = transcript
    .map((l) => `[${l.timestamp}] ${l.speaker}: ${l.text}`)
    .join('\n');

  // Try Vertex AI first; fall back to Google AI Studio
  try {
    const rawText = await vertexGenerate([
      { text: SYSTEM_PROMPT },
      { text: `TRANSCRIPT:\n${transcriptText}` },
    ]);
    const jsonStr = rawText.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);
    return parseSummary(parsed);
  } catch {
    // Vertex failed — fall back to Google AI Studio
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `TRANSCRIPT:\n${transcriptText}` },
    ]);
    const text = result.response.text().trim();
    const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);
    return parseSummary(parsed);
  } catch (err) {
    console.error('[Gemini] summarizeTranscript failed:', err);
    return null;
  }
}

function parseSummary(parsed: Record<string, unknown>): AISummary {
  return {
    patientName: parsed.patientName as string | undefined || undefined,
    age: parsed.age as number | undefined || undefined,
    sex: parsed.sex as 'M' | 'F' | undefined || undefined,
    symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms as string[] : [],
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags as string[] : [],
    triageLevel: (['HIGH', 'MED', 'LOW'].includes(parsed.triageLevel as string)
      ? parsed.triageLevel
      : 'MED') as TriageLevel,
    reasonShort: parsed.reasonShort as string || 'Live call in progress',
    chiefComplaint: parsed.chiefComplaint as string || '',
    summary: parsed.summary as string || 'Call in progress — analyzing transcript.',
    recommendation: parsed.recommendation as string || '',
  };
}
