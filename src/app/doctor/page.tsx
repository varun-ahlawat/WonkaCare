'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  mockPatients,
  mockMedicalHistory,
  mockEncounters,
  mockTimelineEvents,
  getEncountersForPatient,
  getTestResultsForPatient,
  getTimelineForPatient,
  getPatientsForDoctor,
  type Patient,
} from '@/lib/doctor-data';
import { mockAccounts, type Account } from '@/lib/accounts';
import { PatientList } from '@/components/doctor/patient-list';
import { PatientHeader } from '@/components/doctor/patient-header';
import { Timeline } from '@/components/doctor/timeline';
import { Card } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedFilter } from '@/components/ui/segmented-filter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SettingsModal } from '@/components/settings-modal';

type FilterValue = 'ALL' | 'APPOINTMENTS' | 'CALLS';

const filterOptions: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'APPOINTMENTS', label: 'Appointments' },
  { value: 'CALLS', label: 'Calls' },
];

export default function DoctorDashboard() {
  const router = useRouter();
  const doctorAccounts = useMemo(
    () => mockAccounts.filter((a) => a.role === 'doctor'),
    [],
  );
  const [currentAccount, setCurrentAccount] = useState<Account>(doctorAccounts[0]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [dbPatients, setDbPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Fetch patients from Supabase; fall back to mock data if empty
  useEffect(() => {
    fetch('/api/patients')
      .then((r) => r.json())
      .then((rows: Array<Record<string, unknown>>) => {
        const mapped: Patient[] = rows.map((p) => ({
          id: p.id as string,
          mrn: (p.mrn as string) ?? 'MRN-UNKNOWN',
          name: (p.name as string) ?? 'Unknown Patient',
          age: (p.age as number) ?? 0,
          sex: (p.sex as 'M' | 'F') ?? 'M',
          phone: (p.phone as string) ?? '***-***-****',
          primaryDoctor: (p.primary_doctor as string) ?? 'Unassigned',
          allergies: (p.allergies as string[]) ?? [],
          riskLevel: (p.risk_level as Patient['riskLevel']) ?? 'MED',
          status: (p.status as Patient['status']) ?? 'Active',
          lastContact: (p.last_contact as string) ?? new Date().toISOString(),
          lastUpdated: (p.last_updated as string) ?? new Date().toISOString(),
        }));
        setDbPatients(mapped);
        if (mapped.length > 0) setSelectedPatientId(mapped[0].id);
      })
      .catch(() => {
        setSelectedPatientId(mockPatients[0]?.id ?? null);
      });
  }, []);

  const allPatients = useMemo(() => {
    // Use Supabase patients when available, fall back to mock
    const base = dbPatients.length > 0 ? dbPatients : mockPatients;
    if (currentAccount.doctorName) {
      return base.filter((p) => p.primaryDoctor === currentAccount.doctorName);
    }
    return base;
  }, [dbPatients, currentAccount]);

  const patientIdsWithAppointments = useMemo(() => {
    const ids = new Set<string>();
    mockTimelineEvents
      .filter((e) => e.type === 'visit')
      .forEach((e) => ids.add(e.patientId));
    mockEncounters
      .filter((e) => e.type === 'visit')
      .forEach((e) => ids.add(e.patientId));
    return ids;
  }, []);

  const patientIdsWithCalls = useMemo(() => {
    const ids = new Set<string>();
    mockTimelineEvents
      .filter((e) => e.type === 'call')
      .forEach((e) => ids.add(e.patientId));
    mockEncounters
      .filter((e) => e.type === 'call')
      .forEach((e) => ids.add(e.patientId));
    return ids;
  }, []);

  const filteredPatients = useMemo(() => {
    let result = allPatients;

    if (filter === 'APPOINTMENTS') {
      result = result.filter((p) => patientIdsWithAppointments.has(p.id));
    } else if (filter === 'CALLS') {
      result = result.filter((p) => patientIdsWithCalls.has(p.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.mrn.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allPatients, filter, search, patientIdsWithAppointments, patientIdsWithCalls]);

  function handleSwitchAccount(account: Account) {
    // If switching to triage role, navigate to triage dashboard
    if (account.role === 'triage') {
      router.push('/');
      return;
    }
    
    // Otherwise update current doctor account
    setCurrentAccount(account);
    setSelectedPatientId(null);
  }

  const selectedPatient = useMemo(
    () => allPatients.find((p) => p.id === selectedPatientId) ?? null,
    [selectedPatientId, allPatients],
  );

  const currentEncounter = useMemo(() => {
    if (!selectedPatient) return null;
    // Mock patients (p001, p002, …) use in-memory encounters; DB patients use those too since we seeded them
    const encounters = getEncountersForPatient(selectedPatient.id);
    return encounters[0] ?? null;
  }, [selectedPatient]);

  const medicalHistory = useMemo(() => {
    if (!selectedPatient) return null;
    // Try mock medical history (covers both seeded mock IDs and any p00x IDs from Supabase seed)
    return mockMedicalHistory[selectedPatient.id] ?? null;
  }, [selectedPatient]);

  const timeline = useMemo(() => {
    if (!selectedPatient) return [];
    return getTimelineForPatient(selectedPatient.id).slice(0, 10);
  }, [selectedPatient]);

  const testResults = useMemo(() => {
    if (!selectedPatient) return [];
    return getTestResultsForPatient(selectedPatient.id);
  }, [selectedPatient]);

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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            <path d="m14 9 3 3-3 3" />
          </svg>
        </button>

        <div className="flex-1" />

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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Patient list column ── */}
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-surface/40">
        <div className="shrink-0 space-y-3 px-4 pt-5 pb-4">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Show sidebar"
                className="focus-ring -ml-1 mr-1 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-all duration-200 hover:bg-surface-hover hover:text-text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m14 9 3 3-3 3" />
                </svg>
              </button>
            )}
            <h2 className="text-[13px] font-semibold text-text">Patients</h2>
          </div>
          <SearchInput
            placeholder="Search patients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <SegmentedFilter
              options={filterOptions}
              value={filter}
              onChange={setFilter}
            />
          </div>
          <p className="text-[11px] tabular-nums text-muted">
            {filteredPatients.length} patient{filteredPatients.length !== 1 && 's'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <PatientList
            patients={filteredPatients}
            selectedId={selectedPatientId}
            onSelect={setSelectedPatientId}
          />
        </div>
      </aside>

      {/* ── Middle column: Patient overview ── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {selectedPatient ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <PatientHeader patient={selectedPatient} />
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push(`/doctor/patients/${selectedPatient.id}`)}
              >
                View full profile
              </Button>
            </div>

            {/* Current symptoms */}
            {currentEncounter && (
              <Card title="Current symptoms">
                <div className="space-y-3">
                  <p className="text-[12px] font-medium text-text">
                    {currentEncounter.chiefComplaint}
                  </p>
                  <div className="space-y-2">
                    {currentEncounter.symptoms.map((symptom, i) => (
                      <div
                        key={i}
                        className="flex items-baseline justify-between gap-4 text-[12px]"
                      >
                        <span className="text-text-secondary">{symptom.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              symptom.severity === 'Severe'
                                ? 'high'
                                : symptom.severity === 'Moderate'
                                  ? 'med'
                                  : 'low'
                            }
                          >
                            {symptom.severity}
                          </Badge>
                          <span className="text-muted">{symptom.onset}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Medical history */}
            {medicalHistory && (
              <Card title="Medical history">
                <div className="space-y-4">
                  {medicalHistory.conditions.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                        Conditions
                      </p>
                      <div className="space-y-1">
                        {medicalHistory.conditions.map((condition, i) => (
                          <div
                            key={i}
                            className="flex items-baseline justify-between text-[12px]"
                          >
                            <span className="text-text-secondary">{condition.name}</span>
                            <span className="text-muted">{condition.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {medicalHistory.medications.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                        Medications
                      </p>
                      <div className="space-y-1">
                        {medicalHistory.medications.map((med, i) => (
                          <div
                            key={i}
                            className="flex items-baseline justify-between text-[12px]"
                          >
                            <span className="text-text-secondary">
                              {med.name} {med.dosage}
                            </span>
                            <span className="text-muted">{med.frequency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {medicalHistory.priorEpisodes.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                        Prior episodes
                      </p>
                      <ul className="space-y-1 text-[12px] text-text-secondary">
                        {medicalHistory.priorEpisodes.map((episode, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-muted" />
                            {episode}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-muted">No patient selected</p>
          </div>
        )}
      </main>

      {/* ── Right column: Timeline + Tests ── */}
      <aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface/30 p-5">
        {selectedPatient ? (
          <div className="flex flex-col gap-4">
            <Card title="Timeline">
              <Timeline events={timeline} patientId={selectedPatient.id} />
            </Card>

            <div className="mt-auto flex flex-col gap-2 pt-4">
              <Button variant="secondary" size="lg" className="w-full">
                Add note
              </Button>
              <Button variant="secondary" size="lg" className="w-full">
                Order test
              </Button>
              <Button variant="secondary" size="lg" className="w-full">
                Message patient
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-muted">No patient selected</p>
          </div>
        )}
      </aside>
    </div>

    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </>
  );
}
