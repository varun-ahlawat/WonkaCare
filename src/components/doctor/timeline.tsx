'use client';

import { useState } from 'react';
import type { TimelineEvent, TestResult } from '@/lib/doctor-data';
import { mockTestResults } from '@/lib/doctor-data';
import { Badge } from '@/components/ui/badge';
import { fmtDateTime } from '@/lib/format';

const eventIcons: Record<TimelineEvent['type'], React.ReactElement> = {
  call: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  visit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  medication: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="6" x="3" y="4" rx="2" />
      <path d="M12 4v16" />
    </svg>
  ),
  note: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  escalation: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  test: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7M7 16h10" />
    </svg>
  ),
};

const eventColors: Record<TimelineEvent['type'], string> = {
  call: 'text-info',
  visit: 'text-text-secondary',
  medication: 'text-warning',
  note: 'text-muted',
  escalation: 'text-danger',
  test: 'text-success',
};

interface TimelineProps {
  events: TimelineEvent[];
  patientId: string;
}

function TimelineEventItem({
  event,
  isLast,
  patientId,
}: {
  event: TimelineEvent;
  isLast: boolean;
  patientId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTest = event.type === 'test';

  // Find associated test result if this is a test event
  const testResult = isTest
    ? mockTestResults.find(
        (t) =>
          t.patientId === patientId &&
          event.title.toLowerCase().includes(t.type.toLowerCase()),
      )
    : null;

  const isExpandable = isTest && testResult;

  return (
    <div
      className={`relative flex gap-3 pb-4 ${!isLast ? 'border-l-2 border-border' : ''} pl-4`}
    >
      <div
        className={`absolute -left-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-border bg-surface ${eventColors[event.type]}`}
      >
        {eventIcons[event.type]}
      </div>
      <div className="min-w-0 flex-1 pt-[-2px]">
        <button
          onClick={() => isExpandable && setExpanded(!expanded)}
          className={`w-full text-left ${isExpandable ? 'cursor-pointer' : 'cursor-default'}`}
          disabled={!isExpandable}
        >
          <div className="flex items-baseline gap-2">
            <p className="text-[12px] font-medium text-text">{event.title}</p>
            {event.metadata?.triageLevel && (
              <Badge
                variant={
                  event.metadata.triageLevel === 'HIGH'
                    ? 'high'
                    : event.metadata.triageLevel === 'MED'
                      ? 'med'
                      : 'low'
                }
              >
                {event.metadata.triageLevel}
              </Badge>
            )}
            {isExpandable && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`ml-auto shrink-0 text-muted transition-transform duration-200 ${
                  expanded ? 'rotate-90' : ''
                }`}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">
            {event.description}
          </p>
          <p className="mt-1 text-[10px] text-muted">{fmtDateTime(event.timestamp)}</p>
        </button>

        {/* Expanded test details */}
        {expanded && testResult && (
          <div className="mt-3 rounded-[var(--radius-sm)] border border-border bg-bg p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant={
                  testResult.status === 'Abnormal'
                    ? 'high'
                    : testResult.status === 'Complete'
                      ? 'info'
                      : 'neutral'
                }
              >
                {testResult.status}
              </Badge>
            </div>

            {testResult.results && testResult.results.length > 0 && (
              <div className="space-y-1.5">
                {testResult.results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between text-[11px]"
                  >
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
            )}

            {testResult.notes && (
              <p className="mt-2 border-t border-border pt-2 text-[11px] italic text-text-secondary">
                {testResult.notes}
              </p>
            )}

            {testResult.completedDate && (
              <p className="mt-2 text-[10px] text-muted">
                Completed: {fmtDateTime(testResult.completedDate)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Timeline({ events, patientId }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-[12px] text-muted">No timeline events</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => (
        <TimelineEventItem
          key={event.id}
          event={event}
          isLast={idx === events.length - 1}
          patientId={patientId}
        />
      ))}
    </div>
  );
}
