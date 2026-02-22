import type { TriageLevel, CallStatus } from '@/lib/mock-call-logs';

const variants = {
  high:           'bg-danger-muted text-danger border-danger/12',
  med:            'bg-warning-muted text-warning border-warning/10',
  low:            'bg-success-muted text-success border-success/10',
  escalated:      'bg-danger-muted text-danger border-transparent',
  resolved:       'bg-success-muted text-success border-transparent',
  'needs-review': 'bg-info-muted text-info border-transparent',
  live:           'bg-danger-muted text-danger border-danger/12',
  info:           'bg-info-muted text-info border-info/10',
  neutral:        'bg-surface2 text-text-secondary border-border',
} as const;

export type BadgeVariant = keyof typeof variants;

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  pill?: boolean;
  className?: string;
}

export function Badge({
  variant,
  children,
  pill = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center border font-medium leading-none transition-colors ${
        pill ? 'rounded-sm px-2 py-[3px]' : 'rounded-sm px-1.5 py-[3px]'
      } text-[11px] tracking-wide ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Convenience wrappers ── */

const triageMap: Record<TriageLevel, BadgeVariant> = {
  HIGH: 'high',
  MED: 'med',
  LOW: 'low',
};

export function TriageBadge({ level }: { level: TriageLevel }) {
  return (
    <Badge variant={triageMap[level]} className="font-semibold">
      {level}
    </Badge>
  );
}

const statusMap: Record<CallStatus, BadgeVariant> = {
  Escalated: 'escalated',
  Resolved: 'resolved',
  'Needs review': 'needs-review',
  Live: 'live',
};

export function StatusBadge({ status }: { status: CallStatus }) {
  if (status === 'Live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-danger-muted px-2 py-[3px] text-[11px] font-medium leading-none text-danger">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
        </span>
        Live
      </span>
    );
  }
  return (
    <Badge variant={statusMap[status]} pill>
      {status}
    </Badge>
  );
}
