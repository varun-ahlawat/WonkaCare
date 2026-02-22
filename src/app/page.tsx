'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  mockAgents,
  mockCallLogs,
  getCallsForAgent,
  getMockLiveCalls,
  type CallLog,
  type TriageLevel,
} from '@/lib/mock-call-logs';
import { mockAccounts, type Account } from '@/lib/accounts';
import { useLiveCalls } from '@/hooks/use-live-calls';
import { fmtTime, fmtDuration } from '@/lib/format';
import { TriageBadge, StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedFilter } from '@/components/ui/segmented-filter';
import { SettingsModal } from '@/components/settings-modal';

type FilterValue = 'ALL' | TriageLevel | 'LIVE';

const filterOptions: { value: FilterValue; label: string; dot?: 'live' }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'LIVE', label: 'Live', dot: 'live' },
  { value: 'HIGH', label: 'High' },
  { value: 'MED', label: 'Med' },
  { value: 'LOW', label: 'Low' },
];

/* ── Icons ──────────────────────────────────────────── */

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function SidebarToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}

/* ── Call row ───────────────────────────────────────── */

function CallRow({
  call,
  selected,
  onSelect,
  onOpen,
}: {
  call: CallLog;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const isLive = call.status === 'Live';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`focus-ring group flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-3.5 text-left transition-all duration-200 ${
        isLive
          ? selected
            ? 'bg-danger/8 border border-danger/20 shadow-[var(--shadow-sm)]'
            : 'bg-danger/4 border border-danger/10 hover:bg-danger/8'
          : selected
            ? 'bg-surface2 shadow-[var(--shadow-sm)]'
            : 'hover:bg-surface-hover'
      }`}
    >
      {isLive ? (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
        </span>
      ) : (
        <TriageBadge level={call.triageLevel} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-medium leading-snug text-text">
            {call.reasonShort}
          </p>
          {isLive && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-danger">
              Live
            </span>
          )}
        </div>
        <p className="mt-[2px] text-[11px] leading-snug text-muted">
          {call.callerPhone}
          <span className="mx-1 text-border-strong">·</span>
          {fmtTime(call.createdAt)}
          {!isLive && (
            <>
              <span className="mx-1 text-border-strong">·</span>
              {fmtDuration(call.durationSec)}
            </>
          )}
        </p>
      </div>

      {!isLive && <StatusBadge status={call.status} />}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition-all duration-150 hover:border-border-strong hover:bg-surface2 hover:text-text"
      >
        Open
      </button>
    </div>
  );
}

/* ── Icons for redirect ────────────────────────────── */

function PhoneForwardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2l4 4-4 4" />
      <path d="M14 6h8" />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/* ── Call preview (right panel) ─────────────────────── */

function CallPreview({ call }: { call: CallLog | null }) {
  if (!call) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="rounded-[var(--radius-lg)] bg-surface p-6 text-center">
          <p className="text-[13px] font-medium text-text-secondary">
            No call selected
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Click a row to preview details
          </p>
        </div>
      </div>
    );
  }

  const isLive = call.status === 'Live';

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="shrink-0 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <TriageBadge level={call.triageLevel} />
          <StatusBadge status={call.status} />
        </div>
        <h3 className="mt-3 text-[14px] font-semibold leading-snug text-text">
          {call.reasonShort}
        </h3>
        <p className="mt-1 text-[11px] text-muted">
          {call.callerPhone}
          <span className="mx-1 text-border-strong">·</span>
          {fmtTime(call.createdAt)}
          {!isLive && (
            <>
              <span className="mx-1 text-border-strong">·</span>
              {fmtDuration(call.durationSec)}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
        {/* Live transcript */}
        {isLive && (
          <Card title={
            <span className="flex items-center gap-2">
              Live transcript
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
              </span>
            </span>
          }>
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {call.transcript.map((line, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    line.speaker === 'Agent' ? 'items-start' : 'items-end'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      line.speaker === 'Agent' ? 'text-info' : 'text-muted'
                    }`}>
                      {line.speaker === 'Agent' ? 'Meredith' : 'Caller'}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted/60">
                      {line.timestamp}
                    </span>
                  </div>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    line.speaker === 'Agent'
                      ? 'bg-info/10 text-text'
                      : 'bg-surface2 text-text'
                  }`}>
                    {line.text}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
                </span>
                <span className="text-[11px] text-muted">Listening…</span>
              </div>
            </div>
          </Card>
        )}

        {/* AI-extracted patient info for live calls */}
        {isLive && (call.patientName || call.age || call.sex) && (
          <Card title={
            <span className="flex items-center gap-2">
              Patient
              <span className="text-[9px] font-medium uppercase tracking-wider text-info/70">AI</span>
            </span>
          }>
            <div className="space-y-0.5 text-[12px]">
              {call.patientName && (
                <p className="font-medium text-text">{call.patientName}</p>
              )}
              <p className="text-text-secondary">
                {[
                  call.age && `${call.age}y`,
                  call.sex === 'M' ? 'Male' : call.sex === 'F' ? 'Female' : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </Card>
        )}

        {/* AI-extracted signals for live calls */}
        {isLive && (call.symptoms.length > 0 || call.riskFlags.length > 0) && (
          <Card title={
            <span className="flex items-center gap-2">
              Detected signals
              <span className="text-[9px] font-medium uppercase tracking-wider text-info/70">AI</span>
            </span>
          }>
            {call.symptoms.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                  Symptoms
                </p>
                <div className="flex flex-wrap gap-1">
                  {call.symptoms.map((s) => (
                    <Badge key={s} variant="neutral">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {call.riskFlags.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                  Risk flags
                </p>
                <div className="flex flex-wrap gap-1">
                  {call.riskFlags.map((f) => (
                    <Badge key={f} variant="high">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* AI summary + recommendation for live calls */}
        {isLive && call.summary && call.summary !== 'Call in progress — AI triage ongoing.' && (
          <Card title={
            <span className="flex items-center gap-2">
              AI Summary
              <span className="text-[9px] font-medium uppercase tracking-wider text-info/70">Live</span>
            </span>
          }>
            <p className="text-[12px] leading-relaxed text-text-secondary">
              {call.summary}
            </p>
            {call.recommendation && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                  Recommendation
                </p>
                <p className="text-[12px] leading-relaxed text-text-secondary">
                  {call.recommendation}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Standard preview for completed calls */}
        {!isLive && (
          <>
            <Card title="Summary">
              <p className="text-[12px] leading-relaxed text-text-secondary">
                {call.summary}
              </p>
            </Card>

            {(call.patientName || call.age || call.sex) && (
              <Card title="Patient">
                <div className="space-y-0.5 text-[12px]">
                  {call.patientName && (
                    <p className="font-medium text-text">{call.patientName}</p>
                  )}
                  <p className="text-text-secondary">
                    {[
                      call.age && `${call.age}y`,
                      call.sex === 'M' ? 'Male' : call.sex === 'F' ? 'Female' : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Card>
            )}

            <Card title="Recommendation">
              <p className="text-[12px] leading-relaxed text-text-secondary">
                {call.recommendation}
              </p>
            </Card>
          </>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          {isLive ? (
            <>
              <Button variant="danger" size="lg" className="w-full">
                <PhoneForwardIcon />
                <span className="ml-2">Redirect to nurse</span>
              </Button>
              <Button variant="secondary" size="lg" className="w-full">
                <PhoneForwardIcon />
                <span className="ml-2">Redirect to receptionist</span>
              </Button>
              <Button variant="ghost" size="lg" className="w-full">
                Open full transcript
              </Button>
            </>
          ) : (
            <>
              <Button variant="success" size="lg" className="w-full">
                Mark resolved
              </Button>
              <Button variant="secondary" size="lg" className="w-full">
                Call back
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ──────────────────────────────────────── */

export default function Dashboard() {
  const router = useRouter();
  const { liveCalls } = useLiveCalls();

  const triageAccounts = useMemo(
    () => mockAccounts.filter((a) => a.role === 'triage'),
    [],
  );
  const [currentAccount, setCurrentAccount] = useState<Account>(triageAccounts[0]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dbCalls, setDbCalls] = useState<CallLog[]>([]);

  // Fetch real call history from Supabase
  useEffect(() => {
    fetch('/api/calls/history')
      .then((r) => r.json())
      .then((rows: Array<Record<string, unknown>>) => {
        const mapped: CallLog[] = rows.map((c) => ({
          id: c.id as string,
          agentId: 'a1',
          createdAt: c.created_at as string,
          durationSec: (c.duration_sec as number) ?? 0,
          callerPhone: (c.caller_phone as string) ?? '***-***-****',
          patientName: (c.patient_name as string | undefined) ?? undefined,
          age: (c.patient_age as number | undefined) ?? undefined,
          sex: (c.patient_sex as 'M' | 'F' | undefined) ?? undefined,
          triageLevel: (c.triage_level as TriageLevel) ?? 'MED',
          reasonShort: (c.reason_short as string) ?? 'Call completed',
          chiefComplaint: (c.chief_complaint as string) ?? '',
          symptoms: (c.symptoms as string[]) ?? [],
          riskFlags: (c.risk_flags as string[]) ?? [],
          summary: (c.summary as string) ?? '',
          recommendation: (c.recommendation as string) ?? '',
          status: c.status as CallLog['status'],
          transcript: (c.transcript as CallLog['transcript']) ?? [],
        }));
        setDbCalls(mapped);
      })
      .catch(() => {});
  }, []);

  const [selectedAgentId, setSelectedAgentId] = useState(
    currentAccount.agentIds?.[0] ?? mockAgents[0].id,
  );
  const [selectedCallId, setSelectedCallId] = useState<string | null>(() => {
    const calls = getCallsForAgent(currentAccount.agentIds?.[0] ?? mockAgents[0].id);
    return calls[0]?.id ?? null;
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('ALL');

  // Deduplicate by id — Supabase calls take precedence over mock calls with same id
  const agentCalls = useMemo(() => {
    const dbIds = new Set(dbCalls.map((c) => c.id));
    const mockCalls = getCallsForAgent(selectedAgentId).filter((c) => !dbIds.has(c.id));
    return [...liveCalls, ...getMockLiveCalls(), ...dbCalls, ...mockCalls];
  }, [selectedAgentId, liveCalls, dbCalls]);

  const filteredCalls = useMemo(() => {
    let result = agentCalls;
    if (filter === 'LIVE') {
      result = result.filter((c) => c.status === 'Live');
    } else if (filter !== 'ALL') {
      result = result.filter((c) => c.triageLevel === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.reasonShort.toLowerCase().includes(q) ||
          c.callerPhone.includes(q) ||
          c.patientName?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [agentCalls, filter, search]);

  const activeCalls = useMemo(
    () => filteredCalls.filter((c) => c.status !== 'Resolved'),
    [filteredCalls],
  );

  const resolvedCalls = useMemo(
    () => filteredCalls.filter((c) => c.status === 'Resolved'),
    [filteredCalls],
  );

  const [resolvedOpen, setResolvedOpen] = useState(true);

  const selectedCall = useMemo(
    () =>
      liveCalls.find((c) => c.id === selectedCallId) ??
      getMockLiveCalls().find((c) => c.id === selectedCallId) ??
      dbCalls.find((c) => c.id === selectedCallId) ??
      mockCallLogs.find((c) => c.id === selectedCallId) ??
      null,
    [selectedCallId, liveCalls, dbCalls],
  );

  const workerCalls = useMemo(() => {
    if (!currentAccount.agentIds) return mockCallLogs;
    return mockCallLogs.filter((c) => currentAccount.agentIds!.includes(c.agentId));
  }, [currentAccount]);

  function handleSelectAgent(id: string) {
    setSelectedAgentId(id);
    const calls = getCallsForAgent(id);
    setSelectedCallId(calls[0]?.id ?? null);
    setSearch('');
    setFilter('ALL');
  }

  function handleSwitchAccount(account: Account) {
    // If switching to doctor role, navigate to doctor dashboard
    if (account.role === 'doctor') {
      router.push('/doctor');
      return;
    }
    
    // Otherwise update current triage account
    setCurrentAccount(account);
    const firstAgentId = account.agentIds?.[0] ?? mockAgents[0].id;
    setSelectedAgentId(firstAgentId);
    const calls = getCallsForAgent(firstAgentId);
    setSelectedCallId(calls[0]?.id ?? null);
    setSearch('');
    setFilter('ALL');
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-bg font-sans animate-page-enter">
        {/* ── Left icon rail ── */}
        <aside
          className={`flex shrink-0 flex-col items-center border-r border-border bg-surface/40 py-3 transition-all duration-200 ${
            sidebarOpen ? 'w-14' : 'w-0 overflow-hidden border-r-0'
          }`}
        >
          {/* Toggle at top */}
          <button
            onClick={() => setSidebarOpen(false)}
            title="Hide sidebar"
            className="focus-ring mb-1 flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text"
          >
            <SidebarToggleIcon open={true} />
          </button>

          <div className="flex-1" />

          {/* Icon buttons stacked at bottom */}
          <div className="flex flex-col items-center gap-1.5">
            {/* Account switcher */}
            <div className="relative">
              <button
                onClick={() => setAccountDropdownOpen((v) => !v)}
                title={currentAccount.name}
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2 text-[10px] font-semibold text-text-secondary">
                  {currentAccount.initials}
                </span>
              </button>
              {accountDropdownOpen && (
                <div className="absolute bottom-0 left-full z-40 ml-2 w-56 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-md)]">
                  {mockAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        handleSwitchAccount(acc);
                        setAccountDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all duration-150 ${
                        acc.id === currentAccount.id
                          ? 'bg-surface2'
                          : 'hover:bg-surface-hover'
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface2 text-[9px] font-semibold text-text-secondary">
                        {acc.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-text">{acc.name}</p>
                        <p className="truncate text-[10px] text-muted">{acc.roleLabel}</p>
                      </div>
                      {acc.id === currentAccount.id && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-success">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Analytics */}
            <button
              onClick={() => router.push('/analytics')}
              title="Analytics"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text"
            >
              <ChartIcon />
            </button>

            {/* Settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text"
            >
              <SettingsIcon />
            </button>
          </div>
        </aside>

        {/* ── Center panel ── */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 px-4 pt-5 pb-4">
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  title="Show sidebar"
                  className="focus-ring -ml-1 mr-1 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text"
                >
                  <SidebarToggleIcon open={false} />
                </button>
              )}
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-text">Meredith</h2>
              <span className="text-[13px] text-muted">/</span>
              <h2 className="text-[13px] font-medium text-text-secondary">Call logs</h2>
            </div>
            <SearchInput
              placeholder="Search calls…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <SegmentedFilter
                options={filterOptions}
                value={filter}
                onChange={setFilter}
              />
              <span className="ml-auto text-[11px] tabular-nums text-muted">
                {activeCalls.length} active
                {resolvedCalls.length > 0 && (
                  <span className="text-muted/60">
                    {' · '}{resolvedCalls.length} resolved
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {filteredCalls.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <p className="text-[13px] text-muted">No calls found</p>
              </div>
            ) : (
              <>
                {/* Active calls */}
                {activeCalls.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {activeCalls.map((call) => (
                      <CallRow
                        key={call.id}
                        call={call}
                        selected={call.id === selectedCallId}
                        onSelect={() => setSelectedCallId(call.id)}
                        onOpen={() => router.push(`/calls/${call.id}`)}
                      />
                    ))}
                  </div>
                )}

                {/* Resolved section */}
                {resolvedCalls.length > 0 && (
                  <div className={activeCalls.length > 0 ? 'mt-4' : ''}>
                    <button
                      onClick={() => setResolvedOpen((v) => !v)}
                      className="focus-ring mb-1 flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors duration-200 hover:bg-surface-hover"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`shrink-0 text-muted transition-transform duration-200 ${
                          resolvedOpen ? 'rotate-90' : ''
                        }`}
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Resolved
                      </span>
                      <span className="text-[11px] tabular-nums text-muted/60">
                        {resolvedCalls.length}
                      </span>
                    </button>
                    {resolvedOpen && (
                      <div className="flex flex-col gap-1.5">
                        {resolvedCalls.map((call) => (
                          <CallRow
                            key={call.id}
                            call={call}
                            selected={call.id === selectedCallId}
                            onSelect={() => setSelectedCallId(call.id)}
                            onOpen={() => router.push(`/calls/${call.id}`)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* ── Right panel ── */}
        <aside className="w-[360px] shrink-0 border-l border-border bg-surface/30">
          <CallPreview call={selectedCall} />
        </aside>
      </div>

      {/* ── Modals ── */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
