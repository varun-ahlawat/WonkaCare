'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CallLog, TranscriptLine, TriageLevel } from '@/lib/mock-call-logs';

interface AISummaryData {
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

interface LiveCallState {
  id: string;
  phoneNumber: string;
  createdAt: string;
  transcript: TranscriptLine[];
  aiSummary?: AISummaryData;
}

/**
 * Connects to the SSE stream and returns live calls and completed calls.
 * AI summaries are streamed in real time as Gemini processes transcripts.
 */
export function useLiveCalls(): { liveCalls: CallLog[]; completedCalls: CallLog[] } {
  const [liveCallMap, setLiveCallMap] = useState<Map<string, LiveCallState>>(new Map());
  const [completedCalls, setCompletedCalls] = useState<CallLog[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleEvent = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'full-state': {
        const calls = data.calls as LiveCallState[];
        const completed = data.completedCalls as CallLog[] | undefined;
        console.log(`[SSE] full-state: ${calls.length} live, ${completed?.length ?? 0} completed`);
        setLiveCallMap(new Map(calls.map(c => [c.id, c])));
        if (completed) {
          setCompletedCalls(completed);
        }
        break;
      }
      case 'call-started': {
        const call = data.call as LiveCallState;
        setLiveCallMap(prev => {
          const next = new Map(prev);
          next.set(call.id, call);
          return next;
        });
        break;
      }
      case 'transcript': {
        const callId = data.callId as string;
        const line = data.line as TranscriptLine;
        setLiveCallMap(prev => {
          const call = prev.get(callId);
          if (!call) return prev;
          const next = new Map(prev);
          next.set(callId, {
            ...call,
            transcript: [...call.transcript, line],
          });
          return next;
        });
        break;
      }
      case 'transcript-sync': {
        const callId = data.callId as string;
        const transcript = data.transcript as TranscriptLine[];
        setLiveCallMap(prev => {
          const call = prev.get(callId);
          if (!call) return prev;
          const next = new Map(prev);
          next.set(callId, { ...call, transcript });
          return next;
        });
        break;
      }
      case 'ai-summary': {
        const callId = data.callId as string;
        const summary = data.summary as AISummaryData;
        setLiveCallMap(prev => {
          const call = prev.get(callId);
          if (!call) return prev;
          const next = new Map(prev);
          next.set(callId, { ...call, aiSummary: summary });
          return next;
        });
        break;
      }
      case 'call-ended': {
        const callId = data.callId as string;
        setLiveCallMap(prev => {
          const next = new Map(prev);
          next.delete(callId);
          return next;
        });
        break;
      }
      case 'call-completed': {
        const call = data.call as CallLog;
        console.log(`[SSE] call-completed: ${call.id}, reason: "${call.reasonShort}", status: ${call.status}, triage: ${call.triageLevel}`);
        setCompletedCalls(prev => {
          // Replace if exists (late summary update), otherwise prepend
          const idx = prev.findIndex(c => c.id === call.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = call;
            return next;
          }
          return [call, ...prev];
        });
        break;
      }
    }
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/calls/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [handleEvent]);

  const liveCalls = Array.from(liveCallMap.values()).map((live): CallLog => {
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
  });

  return { liveCalls, completedCalls };
}
