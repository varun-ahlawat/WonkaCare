import { EventEmitter } from 'events';
import type { CallLog, TranscriptLine } from './mock-call-logs';
import { summarizeTranscript, type AISummary } from './gemini';
import { upsertCall } from './db';

/* ── Types ─────────────────────────────────────────── */

export interface LiveCall {
  id: string;            // Vapi call ID
  phoneNumber: string;   // caller's phone
  createdAt: string;     // ISO timestamp
  transcript: TranscriptLine[];
  status: 'Live' | 'Ended';
  aiSummary?: AISummary;
}

export type LiveCallEvent =
  | { type: 'call-started'; call: LiveCall }
  | { type: 'transcript'; callId: string; line: TranscriptLine }
  | { type: 'transcript-sync'; callId: string; transcript: TranscriptLine[] }
  | { type: 'call-ended'; callId: string; endedReason: string }
  | { type: 'full-state'; calls: LiveCall[]; completedCalls: CallLog[] }
  | { type: 'ai-summary'; callId: string; summary: AISummary }
  | { type: 'call-completed'; call: CallLog };

/* ── Store ─────────────────────────────────────────── */

class LiveCallStore extends EventEmitter {
  private calls = new Map<string, LiveCall>();
  private completedCalls = new Map<string, CallLog>();

  has(callId: string): boolean {
    return this.calls.has(callId);
  }

  getById(callId: string): LiveCall | undefined {
    return this.calls.get(callId);
  }

  /**
   * Finalize a completed call: run Gemini summarization on the full transcript,
   * then emit call-completed with the AI data.
   */
  private async finalizeCall(callId: string) {
    const completed = this.completedCalls.get(callId);
    if (!completed) return;

    if (completed.transcript.length >= 2) {
      console.log(`[AI] Summarizing completed call ${callId} (${completed.transcript.length} lines)`);
      try {
        const summary = await summarizeTranscript(completed.transcript);
        if (summary) {
          completed.patientName = summary.patientName;
          completed.age = summary.age;
          completed.sex = summary.sex;
          completed.symptoms = summary.symptoms;
          completed.riskFlags = summary.riskFlags;
          completed.triageLevel = summary.triageLevel;
          completed.reasonShort = summary.reasonShort;
          completed.chiefComplaint = summary.chiefComplaint;
          completed.summary = summary.summary;
          completed.recommendation = summary.recommendation;
          console.log(`[AI] Summary ready for ${callId}: ${summary.reasonShort}`);
        }
      } catch (err) {
        console.error(`[AI] Summarization failed for ${callId}:`, err);
      }
    }

    console.log(`[Store] Emitting call-completed for ${callId}: "${completed.reasonShort}"`);
    this.emit('update', {
      type: 'call-completed',
      call: { ...completed },
    } satisfies LiveCallEvent);
  }

  startCall(callId: string, phoneNumber: string) {
    const call: LiveCall = {
      id: callId,
      phoneNumber: phoneNumber || '***-***-****',
      createdAt: new Date().toISOString(),
      transcript: [],
      status: 'Live',
    };
    this.calls.set(callId, call);
    this.emit('update', { type: 'call-started', call } satisfies LiveCallEvent);

    // Persist to Supabase (fire-and-forget)
    upsertCall({
      id: callId,
      callerPhone: call.phoneNumber,
      createdAt: call.createdAt,
      status: 'Live',
    }).catch((err) => console.error('[DB] startCall persist failed:', err));
  }

  addTranscript(callId: string, role: 'user' | 'assistant' | 'bot', text: string) {
    const call = this.calls.get(callId);
    if (!call) return;

    const elapsed = Math.floor((Date.now() - new Date(call.createdAt).getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;

    const speaker = (role === 'user') ? 'Caller' as const : 'Agent' as const;
    const line: TranscriptLine = { timestamp, speaker, text };
    call.transcript.push(line);

    this.emit('update', { type: 'transcript', callId, line } satisfies LiveCallEvent);
  }

  /**
   * Sync transcript from conversation-update's full conversation array.
   * Always replaces the entire transcript — Vapi streams partial content
   * for the current message, so we can't just compare array lengths.
   *
   * Handles both Vapi message formats:
   *   - conversation-update: { role, content }
   *   - artifact.messages:   { role, message, time, secondsFromStart }
   */
  syncTranscript(callId: string, messages: { role: string; content?: string; message?: string }[]) {
    const call = this.calls.get(callId);
    if (!call) return;

    const newTranscript: TranscriptLine[] = [];
    let idx = 0;
    for (const msg of messages) {
      const text = (msg.content || msg.message || '').trim();
      if (msg.role === 'system' || !text) continue;

      const speaker = msg.role === 'user' ? 'Caller' as const : 'Agent' as const;
      const mins = Math.floor(idx * 5 / 60);
      const secs = (idx * 5) % 60;
      const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;
      newTranscript.push({ timestamp, speaker, text });
      idx++;
    }

    // Safety guard: never wipe an existing transcript with an empty result.
    // This can happen if the message array uses an unknown format — keep existing data.
    if (newTranscript.length === 0 && call.transcript.length > 0) {
      console.warn(`[Store] syncTranscript for ${callId}: new messages produced 0 lines but call already has ${call.transcript.length} — keeping existing transcript`);
      return;
    }

    call.transcript = newTranscript;
    this.emit('update', {
      type: 'transcript-sync',
      callId,
      transcript: newTranscript,
    } satisfies LiveCallEvent);
  }

  endCall(callId: string, endedReason: string) {
    const call = this.calls.get(callId);
    if (!call) return;

    call.status = 'Ended';
    console.log(`[Store] endCall ${callId}, reason: "${endedReason}", hasSummary: ${!!call.aiSummary}`);

    // Detect if call was transferred — check both endedReason and transcript content
    const transcriptText = call.transcript.map(l => l.text).join(' ').toLowerCase();
    const isTransfer = /transfer|forward|handoff|hand-off/i.test(endedReason)
      || /transfer initiated|forwarded|handed off|transferring/i.test(transcriptText);

    // Append a system note to the transcript so Gemini knows about the transfer
    if (isTransfer) {
      const elapsed = Math.floor((Date.now() - new Date(call.createdAt).getTime()) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;
      call.transcript.push({
        timestamp,
        speaker: 'Agent',
        text: `[Call was escalated and transferred to a human operator. Reason: ${endedReason}]`,
      });
    }

    // Calculate duration
    const durationSec = Math.floor(
      (Date.now() - new Date(call.createdAt).getTime()) / 1000,
    );

    // Convert to CallLog and store as completed
    const callLog = LiveCallStore.toCallLog(call);
    callLog.status = isTransfer ? 'Escalated' : 'Needs review';
    callLog.durationSec = durationSec;
    this.completedCalls.set(callId, callLog);

    // Remove from active calls
    this.calls.delete(callId);

    // Emit call-ended so frontend removes from live list immediately
    this.emit('update', { type: 'call-ended', callId, endedReason } satisfies LiveCallEvent);

    // Finalize async: wait for Gemini summary, THEN emit call-completed once with full data
    this.finalizeCall(callId);
  }

  getAll(): LiveCall[] {
    return Array.from(this.calls.values()).filter(c => c.status === 'Live');
  }

  getCompleted(): CallLog[] {
    return Array.from(this.completedCalls.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  getCompletedById(id: string): CallLog | undefined {
    return this.completedCalls.get(id);
  }

  /** Convert a LiveCall to the CallLog shape the dashboard expects */
  static toCallLog(live: LiveCall): CallLog {
    const ai = live.aiSummary;
    return {
      id: live.id,
      agentId: 'a1',
      createdAt: live.createdAt,
      durationSec: 0,
      callerPhone: live.phoneNumber,
      patientName: ai?.patientName,
      age: ai?.age,
      sex: ai?.sex,
      triageLevel: ai?.triageLevel || 'MED',
      reasonShort: ai?.reasonShort || 'Live call in progress',
      chiefComplaint: ai?.chiefComplaint || '',
      symptoms: ai?.symptoms || [],
      riskFlags: ai?.riskFlags || [],
      summary: ai?.summary || 'Call in progress — AI triage ongoing.',
      recommendation: ai?.recommendation || '',
      status: 'Live',
      transcript: live.transcript,
    };
  }
}

// Use globalThis to ensure a true singleton across Next.js module reloads / workers
const globalKey = '__liveCallStore__' as const;

function getStore(): LiveCallStore {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = new LiveCallStore();
  }
  return (globalThis as Record<string, unknown>)[globalKey] as LiveCallStore;
}

export const liveCallStore = getStore();
