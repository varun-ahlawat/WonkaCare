'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import {
  getPatientById,
  mockMedicalHistory,
  getEncountersForPatient,
  getTestResultsForPatient,
  getTimelineForPatient,
  getNotesForPatient,
  type Patient,
  type MedicalHistory,
  type Encounter,
  type TimelineEvent,
  type DoctorNote,
  type TestResult,
} from '@/lib/doctor-data';
import { PatientHeader } from '@/components/doctor/patient-header';
import { Timeline } from '@/components/doctor/timeline';
import { TestResultsTable } from '@/components/doctor/test-results';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { fmtDateTime } from '@/lib/format';

function ArrowLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function NotFound() {
  const router = useRouter();
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="text-center">
        <p className="text-[15px] font-semibold text-text">Patient not found</p>
        <p className="mt-1 text-[13px] text-muted">
          The patient you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.push('/doctor')}
          className="mt-5"
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

function TestResultModal({
  result,
  onClose,
}: {
  result: TestResult;
  onClose: () => void;
}) {
  return (
    <Modal open={true} onClose={onClose} title={result.type}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              result.status === 'Abnormal'
                ? 'high'
                : result.status === 'Complete'
                  ? 'info'
                  : 'neutral'
            }
          >
            {result.status}
          </Badge>
        </div>

        <div className="space-y-2 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted">Ordered</span>
            <span className="text-text">{fmtDateTime(result.orderedDate)}</span>
          </div>
          {result.completedDate && (
            <div className="flex justify-between">
              <span className="text-muted">Completed</span>
              <span className="text-text">{fmtDateTime(result.completedDate)}</span>
            </div>
          )}
        </div>

        {result.results && result.results.length > 0 && (
          <Card title="Results">
            <div className="space-y-2">
              {result.results.map((r, i) => (
                <div key={i} className="flex items-baseline justify-between text-[12px]">
                  <span className="text-text-secondary">{r.label}</span>
                  <span
                    className={`font-medium ${r.flag ? 'text-danger' : 'text-text'}`}
                  >
                    {r.value} {r.unit}
                    {r.flag && ` (${r.flag})`}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {result.notes && (
          <Card title="Notes">
            <p className="text-[12px] leading-relaxed text-text-secondary">
              {result.notes}
            </p>
          </Card>
        )}
      </div>
    </Modal>
  );
}

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [selectedTest, setSelectedTest] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbPatient, setDbPatient] = useState<Patient | null>(null);
  const [dbEncounters, setDbEncounters] = useState<Encounter[]>([]);
  const [dbTimeline, setDbTimeline] = useState<TimelineEvent[]>([]);
  const [dbNotes, setDbNotes] = useState<DoctorNote[]>([]);
  const [dbMedicalHistory, setDbMedicalHistory] = useState<MedicalHistory | null>(null);

  useEffect(() => {
    fetch(`/api/patients/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setLoading(false); return; }

        // Map DB patient row → Patient interface
        const p = data.patient;
        setDbPatient({
          id: p.id,
          mrn: p.mrn ?? 'MRN-UNKNOWN',
          name: p.name ?? 'Unknown Patient',
          age: p.age ?? 0,
          sex: (p.sex as 'M' | 'F') ?? 'M',
          phone: p.phone ?? '***-***-****',
          primaryDoctor: p.primary_doctor ?? 'Unassigned',
          allergies: p.allergies ?? [],
          riskLevel: p.risk_level ?? 'MED',
          status: p.status ?? 'Active',
          lastContact: p.last_contact ?? new Date().toISOString(),
          lastUpdated: p.last_updated ?? new Date().toISOString(),
        });

        // Medical history from denormalized patient columns
        setDbMedicalHistory({
          conditions: p.conditions ?? [],
          medications: p.medications ?? [],
          priorEpisodes: p.prior_episodes ?? [],
        });

        // Encounters
        setDbEncounters((data.encounters ?? []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          patientId: e.patient_id as string,
          type: (e.type as 'call' | 'visit' | 'message') ?? 'call',
          timestamp: e.timestamp as string,
          chiefComplaint: (e.chief_complaint as string) ?? '',
          symptoms: (e.symptoms as Encounter['symptoms']) ?? [],
          triageLevel: (e.triage_level as Encounter['triageLevel']) ?? 'MED',
          outcome: (e.outcome as string) ?? '',
          callId: e.call_id as string | undefined,
        })));

        // Timeline
        setDbTimeline((data.timeline ?? []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          patientId: e.patient_id as string,
          type: e.type as TimelineEvent['type'],
          timestamp: e.timestamp as string,
          title: e.title as string,
          description: (e.description as string) ?? '',
          metadata: (e.metadata as Record<string, unknown>) ?? {},
        })));

        // Notes
        setDbNotes((data.notes ?? []).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          patientId: n.patient_id as string,
          authorId: (n.author_id as string) ?? '',
          authorName: (n.author_name as string) ?? 'Unknown',
          createdAt: n.created_at as string,
          content: (n.content as string) ?? '',
        })));

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  // Resolve patient: prefer DB, fall back to mock
  const patient = dbPatient ?? getPatientById(params.id) ?? null;

  const encounters = useMemo(() => {
    if (!patient) return [];
    return dbEncounters.length > 0 ? dbEncounters : getEncountersForPatient(patient.id);
  }, [patient, dbEncounters]);

  const medicalHistory = useMemo(() => {
    if (!patient) return null;
    return dbMedicalHistory ?? mockMedicalHistory[patient.id] ?? null;
  }, [patient, dbMedicalHistory]);

  const timeline = useMemo(() => {
    if (!patient) return [];
    return dbTimeline.length > 0 ? dbTimeline : getTimelineForPatient(patient.id);
  }, [patient, dbTimeline]);

  const testResults = useMemo(() => {
    if (!patient) return [];
    return getTestResultsForPatient(patient.id);
  }, [patient]);

  const notes = useMemo(() => {
    if (!patient) return [];
    return dbNotes.length > 0 ? dbNotes : getNotesForPatient(patient.id);
  }, [patient, dbNotes]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p className="text-[13px] text-muted">Loading patient…</p>
      </div>
    );
  }

  if (!patient) return <NotFound />;

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-bg font-sans animate-page-enter">
        {/* ── Main area ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* Header */}
          <header className="shrink-0 border-b border-border px-6 py-5">
            <button
              onClick={() => router.push('/doctor')}
              className="focus-ring mb-4 flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12px] text-muted transition-colors duration-200 hover:text-text"
            >
              <ArrowLeft />
              Back to dashboard
            </button>

            <PatientHeader patient={patient} />
          </header>

          {/* Body */}
          <div className="flex flex-col gap-4 p-6">
            {/* Current symptoms */}
            {encounters.length > 0 && (
              <Card title="Current & recent symptoms">
                <div className="space-y-4">
                  {encounters.slice(0, 3).map((encounter) => (
                    <div key={encounter.id} className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[12px] font-medium text-text">
                          {encounter.chiefComplaint}
                        </p>
                        <Badge
                          variant={
                            encounter.triageLevel === 'HIGH'
                              ? 'high'
                              : encounter.triageLevel === 'MED'
                                ? 'med'
                                : 'low'
                          }
                        >
                          {encounter.triageLevel}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted">
                        {fmtDateTime(encounter.timestamp)}
                      </p>
                      <div className="space-y-1">
                        {encounter.symptoms.map((symptom, i) => (
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
                      <p className="text-[11px] italic text-text-secondary">
                        {encounter.outcome}
                      </p>
                    </div>
                  ))}
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
                      <div className="space-y-1.5">
                        {medicalHistory.conditions.map((condition, i) => (
                          <div key={i} className="text-[12px]">
                            <div className="flex items-baseline justify-between">
                              <span className="font-medium text-text">
                                {condition.name}
                              </span>
                              <Badge
                                variant={
                                  condition.status === 'Active' ? 'med' : 'neutral'
                                }
                              >
                                {condition.status}
                              </Badge>
                            </div>
                            <p className="text-muted">
                              Diagnosed: {condition.diagnosedDate}
                            </p>
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
                      <div className="space-y-1.5">
                        {medicalHistory.medications.map((med, i) => (
                          <div key={i} className="text-[12px]">
                            <div className="flex items-baseline justify-between">
                              <span className="font-medium text-text">
                                {med.name} {med.dosage}
                              </span>
                              <span className="text-muted">{med.frequency}</span>
                            </div>
                            <p className="text-muted">Started: {med.startedDate}</p>
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

            {/* Tests & Results */}
            <Card title="Tests & Results">
              <TestResultsTable
                results={testResults}
                onViewDetails={setSelectedTest}
              />
            </Card>

            {/* Timeline */}
            <Card title="Timeline">
              <Timeline events={timeline} patientId={patient.id} />
            </Card>

            {/* Doctor notes */}
            {notes.length > 0 && (
              <Card title="Doctor notes">
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-[var(--radius-sm)] border border-border bg-bg p-3"
                    >
                      <div className="mb-2 flex items-baseline justify-between">
                        <p className="text-[12px] font-medium text-text">
                          {note.authorName}
                        </p>
                        <p className="text-[10px] text-muted">
                          {fmtDateTime(note.createdAt)}
                        </p>
                      </div>
                      <p className="text-[12px] leading-relaxed text-text-secondary">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </main>

        {/* ── Right sidebar ── */}
        <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface/30">
          <div className="flex flex-col gap-4 p-5">
            <Card title="Quick info">
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted">Status</span>
                  <Badge
                    variant={
                      patient.status === 'Critical'
                        ? 'high'
                        : patient.status === 'Follow-up needed'
                          ? 'med'
                          : 'info'
                    }
                  >
                    {patient.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Risk level</span>
                  <Badge
                    variant={
                      patient.riskLevel === 'HIGH'
                        ? 'high'
                        : patient.riskLevel === 'MED'
                          ? 'med'
                          : 'low'
                    }
                  >
                    {patient.riskLevel}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Last contact</span>
                  <span className="text-text">{fmtDateTime(patient.lastContact)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Phone</span>
                  <span className="font-mono text-text">{patient.phone}</span>
                </div>
              </div>
            </Card>

            <div className="flex flex-col gap-2">
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
        </aside>
      </div>

      {/* Test result modal */}
      {selectedTest && (
        <TestResultModal result={selectedTest} onClose={() => setSelectedTest(null)} />
      )}
    </>
  );
}
