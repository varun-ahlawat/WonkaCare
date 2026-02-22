import type { Patient } from '@/lib/doctor-data';
import { TriageBadge } from '@/components/ui/badge';
import { fmtTime } from '@/lib/format';

interface PatientRowProps {
  patient: Patient;
  selected: boolean;
  onClick: () => void;
}

function PatientRow({ patient, selected, onClick }: PatientRowProps) {
  const statusColors = {
    Critical: 'bg-danger',
    Active: 'bg-warning',
    Stable: 'bg-success',
    'Follow-up needed': 'bg-info',
  };

  return (
    <button
      onClick={onClick}
      className={`focus-ring flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition-all duration-200 ${
        selected
          ? 'bg-surface2 shadow-[var(--shadow-sm)]'
          : 'hover:bg-surface-hover'
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        <TriageBadge level={patient.riskLevel} />
        <span
          className={`h-1.5 w-1.5 rounded-full ${statusColors[patient.status]}`}
          title={patient.status}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-snug text-text">
          {patient.name}
        </p>
        <p className="mt-[2px] text-[11px] leading-snug text-muted">
          {patient.age}y {patient.sex === 'M' ? 'Male' : 'Female'}
          <span className="mx-1 text-border-strong">·</span>
          {fmtTime(patient.lastContact)}
        </p>
      </div>
    </button>
  );
}

interface PatientListProps {
  patients: Patient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PatientList({ patients, selectedId, onSelect }: PatientListProps) {
  if (patients.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-[13px] text-muted">No patients found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-px">
      {patients.map((patient) => (
        <PatientRow
          key={patient.id}
          patient={patient}
          selected={patient.id === selectedId}
          onClick={() => onSelect(patient.id)}
        />
      ))}
    </div>
  );
}
