'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getCallById,
  getMockLiveCalls,
  mockAgents,
  type CallLog,
  type TriageLevel,
  type CallStatus,
} from '@/lib/mock-call-logs';
import { fmtDateTime, fmtDuration } from '@/lib/format';
import { TriageBadge, StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLiveCalls } from '@/hooks/use-live-calls';

/* ── Icons ──────────────────────────────────────────── */

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function PhoneForwardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2l4 4-4 4" /><path d="M14 6h8" />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M5 3l.9 2.1L8 6l-2.1.9L5 9l-.9-2.1L2 6l2.1-.9z" />
      <path d="M19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </svg>
  );
}

/* ── Not found ──────────────────────────────────────── */

function NotFound() {
  const router = useRouter();
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="text-center">
        <p className="text-[15px] font-semibold text-text">Call not found</p>
        <p className="mt-1 text-[13px] text-muted">The call you&apos;re looking for doesn&apos;t exist.</p>
        <Button variant="secondary" size="lg" onClick={() => router.push('/')} className="mt-5">
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

/* ── Meta row ───────────────────────────────────────── */

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="text-text">{children}</span>
    </div>
  );
}

/* ── DB row → CallLog mapper ────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbCall(row: Record<string, any>): CallLog {
  return {
    id: row.id,
    agentId: row.agent_id ?? 'a1',
    createdAt: row.created_at,
    durationSec: row.duration_sec ?? 0,
    callerPhone: row.caller_phone ?? '',
    patientName: row.patient_name ?? undefined,
    age: row.patient_age ?? undefined,
    sex: (row.patient_sex as 'M' | 'F') ?? undefined,
    triageLevel: (row.triage_level as TriageLevel) ?? 'MED',
    reasonShort: row.reason_short ?? 'Call completed',
    chiefComplaint: row.chief_complaint ?? '',
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    riskFlags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
    summary: row.summary ?? '',
    recommendation: row.recommendation ?? '',
    status: (row.status as CallStatus) ?? 'Needs review',
    transcript: Array.isArray(row.transcript) ? row.transcript : [],
  };
}

/* ── Call detail ────────────────────────────────────── */

function CallDetail({
  call,
  isMock,
  onStatusChange,
  onReanalyze,
}: {
  call: CallLog;
  isMock: boolean;
  onStatusChange: (status: CallStatus) => Promise<void>;
  onReanalyze: () => Promise<void>;
}) {
  const router = useRouter();
  const agent = mockAgents.find((a) => a.id === call.agentId);
  const [statusLoading, setStatusLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll live transcript to bottom as new lines arrive
  useEffect(() => {
    if (call.status === 'Live') {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [call.transcript.length, call.status]);

  const fieldsEmpty = !call.summary && !call.chiefComplaint && call.transcript.length >= 2;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleMarkResolved() {
    if (call.status === 'Resolved' || isMock) return;
    setStatusLoading(true);
    try {
      await onStatusChange('Resolved');
      showToast('Marked as resolved');
    } catch {
      showToast('Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleReanalyze() {
    if (isMock) return;
    setAnalyzeLoading(true);
    try {
      await onReanalyze();
      showToast('AI analysis complete');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Analysis failed — try again');
    } finally {
      setAnalyzeLoading(false);
    }
  }

  function handleExportTranscript() {
    const lines = [
      `CALL TRANSCRIPT`,
      `===============`,
      `Reason   : ${call.reasonShort}`,
      `Date     : ${fmtDateTime(call.createdAt)}`,
      `Phone    : ${call.callerPhone}`,
      `Triage   : ${call.triageLevel}  |  Status: ${call.status}`,
      `Duration : ${fmtDuration(call.durationSec)}`,
      call.patientName ? `Patient  : ${call.patientName}` : '',
      '',
      '--- TRANSCRIPT ---',
      '',
      ...call.transcript.map((l) => `[${l.timestamp}]  ${l.speaker === 'Agent' ? 'Meredith' : 'Caller '}: ${l.text}`),
      '',
      '--- AI SUMMARY ---',
      '',
      call.summary || '(none)',
      '',
      '--- RECOMMENDATION ---',
      '',
      call.recommendation || '(none)',
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-${call.id.slice(0, 8)}-${call.createdAt.slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg font-sans animate-page-enter">
      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-surface2 px-4 py-2.5 text-[12px] font-medium text-text shadow-lg ring-1 ring-border">
          {toast}
        </div>
      )}

      {/* ── Main area ── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <header className="shrink-0 border-b border-border px-6 py-5">
          <button
            onClick={() => router.push('/')}
            className="focus-ring mb-4 flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12px] text-muted transition-colors duration-200 hover:text-text"
          >
            <ArrowLeft />
            Dashboard
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="text-[16px] font-semibold tracking-[-0.01em] text-text">
              {call.reasonShort}
            </h1>
            <TriageBadge level={call.triageLevel} />
            <StatusBadge status={call.status} />
          </div>

          <p className="mt-1.5 text-[11px] text-muted">
            {call.callerPhone}
            <span className="mx-1 text-border-strong">·</span>
            {fmtDateTime(call.createdAt)}
            {call.status !== 'Live' && (
              <>
                <span className="mx-1 text-border-strong">·</span>
                {fmtDuration(call.durationSec)}
              </>
            )}
          </p>
        </header>

        {/* Body */}
        <div className="flex flex-col gap-4 p-6">
          {/* Live transcript */}
          {call.status === 'Live' && (
            <Card title={
              <span className="flex items-center gap-2">
                Live transcript
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
                </span>
              </span>
            }>
              <div className="space-y-2">
                {call.transcript.map((line, i) => (
                  <div key={i} className={`flex flex-col ${line.speaker === 'Agent' ? 'items-start' : 'items-end'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${line.speaker === 'Agent' ? 'text-info' : 'text-muted'}`}>
                        {line.speaker === 'Agent' ? 'Meredith' : 'Caller'}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted/60">{line.timestamp}</span>
                    </div>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${line.speaker === 'Agent' ? 'bg-info/10 text-text' : 'bg-surface2 text-text'}`}>
                      {line.text}
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} className="flex items-center gap-2 pt-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
                  </span>
                  <span className="text-[11px] text-muted">Listening…</span>
                </div>
              </div>
            </Card>
          )}

          {/* AI Summary */}
          <Card title={
            <span className="flex items-center justify-between w-full">
              <span>AI Summary</span>
              {fieldsEmpty && !isMock && (
                <button
                  onClick={handleReanalyze}
                  disabled={analyzeLoading}
                  className="flex items-center gap-1.5 rounded-md bg-info/10 px-2.5 py-1 text-[11px] font-medium text-info transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  <SparkleIcon />
                  {analyzeLoading ? 'Analyzing…' : 'Re-analyze'}
                </button>
              )}
            </span>
          }>
            {call.summary ? (
              <>
                <p className="mb-3 text-[12px] leading-relaxed text-text-secondary">{call.summary}</p>
                {call.symptoms.length > 0 && (
                  <ul className="space-y-1 text-[12px] leading-relaxed text-text-secondary">
                    {call.symptoms.map((s) => (
                      <li key={s} className="flex items-start gap-2">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-muted" />
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-[12px] text-muted italic">
                {analyzeLoading ? 'Running AI analysis — this may take up to 30 seconds…' : 'AI analysis not yet available for this call.'}
              </p>
            )}
          </Card>

          {/* Patient info */}
          {(call.patientName || call.age || call.sex) && (
            <Card title="Patient info">
              <div className="grid grid-cols-3 gap-4 text-[12px]">
                {call.patientName && (
                  <div><p className="text-muted">Name</p><p className="mt-0.5 font-medium text-text">{call.patientName}</p></div>
                )}
                {call.age && (
                  <div><p className="text-muted">Age</p><p className="mt-0.5 font-medium text-text">{call.age}</p></div>
                )}
                {call.sex && (
                  <div><p className="text-muted">Sex</p><p className="mt-0.5 font-medium text-text">{call.sex === 'M' ? 'Male' : 'Female'}</p></div>
                )}
              </div>
            </Card>
          )}

          {/* Reason for call */}
          <Card title="Reason for call">
            {call.chiefComplaint ? (
              <p className="text-[12px] leading-relaxed text-text-secondary">{call.chiefComplaint}</p>
            ) : (
              <p className="text-[12px] text-muted italic">Not yet extracted.</p>
            )}
          </Card>

          {/* Transcript */}
          {call.status !== 'Live' && (
            <Card title="Transcript">
              {call.transcript.length > 0 ? (
                <div className="space-y-0">
                  {call.transcript.map((line, i) => (
                    <div key={i} className="flex gap-3 border-b border-border/50 py-2 text-[12px] last:border-0">
                      <span className="w-10 shrink-0 tabular-nums font-mono text-muted">{line.timestamp}</span>
                      <span className={`w-12 shrink-0 font-semibold ${line.speaker === 'Agent' ? 'text-info' : 'text-warning'}`}>
                        {line.speaker}
                      </span>
                      <span className="leading-relaxed text-text-secondary">{line.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-muted italic">No transcript available.</p>
              )}
            </Card>
          )}

          {/* Extracted signals */}
          <Card title="Extracted signals">
            <div className="grid grid-cols-2 gap-5 text-[12px]">
              <div>
                <p className="mb-2 text-muted">Symptoms</p>
                <div className="flex flex-wrap gap-1.5">
                  {call.symptoms.length > 0 ? (
                    call.symptoms.map((s) => <Badge key={s} variant="neutral">{s}</Badge>)
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-muted">Risk flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {call.riskFlags.length > 0 ? (
                    call.riskFlags.map((f) => <Badge key={f} variant="high">{f}</Badge>)
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1 text-muted">Suggested department</p>
                <p className="font-medium text-text">
                  {call.triageLevel === 'HIGH' ? 'Emergency' : call.triageLevel === 'MED' ? 'Urgent Care' : 'General'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-muted">Confidence</p>
                <p className="font-medium tabular-nums text-text">
                  {call.triageLevel === 'HIGH' ? '94%' : call.triageLevel === 'MED' ? '82%' : '91%'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* ── Right sidebar ── */}
      <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface/30">
        <div className="flex flex-col gap-4 p-5">
          <Card title="Call meta">
            <div className="divide-y divide-border/50">
              <MetaRow label="Agent">{agent?.name ?? call.agentId}</MetaRow>
              <MetaRow label="Phone"><span className="font-mono">{call.callerPhone}</span></MetaRow>
              <MetaRow label="Time">{fmtDateTime(call.createdAt)}</MetaRow>
              <MetaRow label="Duration">
                {call.status === 'Live' ? (
                  <span className="inline-flex items-center gap-1.5 text-danger">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
                    </span>
                    In progress
                  </span>
                ) : (
                  <span className="tabular-nums">{fmtDuration(call.durationSec)}</span>
                )}
              </MetaRow>
              {call.status !== 'Live' && (
                <MetaRow label="Recording"><span className="text-muted">—</span></MetaRow>
              )}
            </div>
          </Card>

          {call.status !== 'Live' && (
            <Card title="Recommendation">
              {call.recommendation ? (
                <p className="text-[12px] leading-relaxed text-text-secondary">{call.recommendation}</p>
              ) : (
                <p className="text-[12px] text-muted italic">Not yet extracted.</p>
              )}
            </Card>
          )}

          {call.status === 'Live' ? (
            <div className="flex flex-col gap-2">
              <Button variant="danger" size="lg" className="w-full">
                <PhoneForwardIcon />
                <span className="ml-2">Redirect to nurse</span>
              </Button>
              <Button variant="secondary" size="lg" className="w-full">
                <PhoneForwardIcon />
                <span className="ml-2">Redirect to receptionist</span>
              </Button>
              <Button variant="ghost" size="lg" className="w-full">
                End call
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                variant="success"
                size="lg"
                className="w-full"
                onClick={handleMarkResolved}
                disabled={statusLoading || call.status === 'Resolved' || isMock}
              >
                {statusLoading ? 'Saving…' : call.status === 'Resolved' ? 'Resolved ✓' : 'Mark resolved'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handleExportTranscript}
                disabled={call.transcript.length === 0}
              >
                Export transcript
              </Button>
              {fieldsEmpty && !isMock && (
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  onClick={handleReanalyze}
                  disabled={analyzeLoading}
                >
                  <SparkleIcon />
                  <span className="ml-2">{analyzeLoading ? 'Analyzing…' : 'Re-analyze with AI'}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────── */

export default function CallPage() {
  const params = useParams<{ id: string }>();
  const [call, setCall] = useState<CallLog | null | undefined>(undefined);
  const [isMock, setIsMock] = useState(false);
  const { liveCalls } = useLiveCalls();

  // If this call is currently live, use the real-time version from SSE
  const liveCall = useMemo(
    () => liveCalls.find((c) => c.id === params.id) ?? null,
    [liveCalls, params.id],
  );

  const loadCall = useCallback(async (id: string) => {
    const mock =
      getCallById(id) ??
      getMockLiveCalls().find((c) => c.id === id) ??
      null;
    if (mock) { setCall(mock); setIsMock(true); return; }

    const res = await fetch(`/api/calls/${id}`).catch(() => null);
    const row = res?.ok ? await res.json() : null;
    setCall(row ? mapDbCall(row) : null);
    setIsMock(false);
  }, []);

  useEffect(() => { loadCall(params.id); }, [params.id, loadCall]);

  const handleStatusChange = useCallback(async (status: CallStatus) => {
    const res = await fetch(`/api/calls/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update status');
    const row = await res.json();
    setCall(mapDbCall(row));
  }, [params.id]);

  const handleReanalyze = useCallback(async () => {
    const res = await fetch(`/api/calls/${params.id}/analyze`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Analysis failed');
    }
    const row = await res.json();
    setCall(mapDbCall(row));
  }, [params.id]);

  // Live call takes precedence over the static fetched snapshot
  const displayCall = liveCall ?? call;

  if (displayCall === undefined) return null;
  if (displayCall === null) return <NotFound />;
  return (
    <CallDetail
      call={displayCall}
      isMock={isMock && !liveCall}
      onStatusChange={handleStatusChange}
      onReanalyze={handleReanalyze}
    />
  );
}
