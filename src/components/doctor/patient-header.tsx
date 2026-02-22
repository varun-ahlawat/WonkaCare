import type { Patient } from '@/lib/doctor-data';
import { Badge } from '@/components/ui/badge';

interface PatientHeaderProps {
  patient: Patient;
}

export function PatientHeader({ patient }: PatientHeaderProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text">
          {patient.name}
        </h2>
        <p className="mt-1 text-[12px] text-text-secondary">
          {patient.age}y {patient.sex === 'M' ? 'Male' : 'Female'}
          <span className="mx-1.5 text-border-strong">·</span>
          MRN: <span className="font-mono">{patient.mrn}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[11px] text-muted">
          <span className="font-medium text-text-secondary">Primary:</span>{' '}
          {patient.primaryDoctor}
        </div>
      </div>

      {patient.allergies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
            Allergies
          </span>
          {patient.allergies.map((allergy) => (
            <Badge key={allergy} variant="high">
              {allergy}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
