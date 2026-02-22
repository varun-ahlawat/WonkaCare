import type { TestResult } from '@/lib/doctor-data';
import { Badge } from '@/components/ui/badge';
import { fmtDateTime } from '@/lib/format';

const statusVariants = {
  Pending: 'neutral' as const,
  Complete: 'info' as const,
  Abnormal: 'high' as const,
};

interface TestResultsTableProps {
  results: TestResult[];
  onViewDetails?: (result: TestResult) => void;
}

export function TestResultsTable({ results, onViewDetails }: TestResultsTableProps) {
  if (results.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-[12px] text-muted">No test results</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => (
        <button
          key={result.id}
          onClick={() => onViewDetails?.(result)}
          className="focus-ring flex w-full items-start gap-3 rounded-[var(--radius-sm)] border border-border bg-bg p-3 text-left transition-all duration-200 hover:border-border-strong hover:bg-surface-hover"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-medium text-text">{result.type}</p>
              <Badge variant={statusVariants[result.status]}>{result.status}</Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Ordered: {fmtDateTime(result.orderedDate)}
              {result.completedDate && (
                <>
                  <span className="mx-1 text-border-strong">·</span>
                  Completed: {fmtDateTime(result.completedDate)}
                </>
              )}
            </p>
            {result.results && result.results.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {result.results.slice(0, 3).map((r, i) => (
                  <span
                    key={i}
                    className={`text-[11px] ${r.flag ? 'font-medium text-danger' : 'text-text-secondary'}`}
                  >
                    {r.label}: {r.value}
                    {r.unit && ` ${r.unit}`}
                    {r.flag && ` (${r.flag})`}
                  </span>
                ))}
                {result.results.length > 3 && (
                  <span className="text-[11px] text-muted">
                    +{result.results.length - 3} more
                  </span>
                )}
              </div>
            )}
            {result.notes && (
              <p className="mt-1.5 text-[11px] italic text-text-secondary">
                {result.notes}
              </p>
            )}
          </div>
          {onViewDetails && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-muted"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
