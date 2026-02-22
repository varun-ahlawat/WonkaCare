'use client';

import { Modal } from '@/components/ui/modal';
import { useTheme } from '@/lib/theme';

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

const sections = [
  {
    title: 'Preferences',
    description: 'Language, timezone, default triage view, notification sounds.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: 'Notifications',
    description: 'Alert thresholds, escalation pings, email digests.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    title: 'Triage Rules',
    description: 'Scoring weights, auto-escalation triggers, keyword watchlists.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M7 12h10M10 18h4" />
      </svg>
    ),
  },
  {
    title: 'Integrations',
    description: 'EHR connections, Slack webhooks, PagerDuty, Twilio.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, toggle } = useTheme();

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="flex flex-col gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="focus-ring flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg p-4 text-left transition-all duration-200 hover:border-border-strong hover:bg-surface-hover"
        >
          <span className="shrink-0 text-muted">
            {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-text">Appearance</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              {theme === 'dark' ? 'Dark mode' : 'Light mode'} — click to switch
            </p>
          </div>
          <div
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ${
              theme === 'light'
                ? 'border-info/30 bg-info/20'
                : 'border-border-strong bg-surface2'
            }`}
          >
            <div
              className={`absolute top-[3px] h-4 w-4 rounded-full bg-text shadow-sm transition-all duration-200 ${
                theme === 'light' ? 'left-[22px]' : 'left-[3px]'
              }`}
            />
          </div>
        </button>

        {/* Other sections */}
        {sections.map((s) => (
          <button
            key={s.title}
            className="focus-ring flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-bg p-4 text-left transition-all duration-200 hover:border-border-strong hover:bg-surface-hover"
          >
            <span className="mt-0.5 shrink-0 text-muted">{s.icon}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-text">{s.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                {s.description}
              </p>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-auto mt-0.5 shrink-0 text-muted/50"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </Modal>
  );
}
