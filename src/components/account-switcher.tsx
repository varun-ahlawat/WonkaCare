'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Account } from '@/lib/accounts';

interface AccountSwitcherProps {
  accounts: Account[];
  current: Account;
  onSwitch: (account: Account) => void;
}

export function AccountSwitcher({
  accounts,
  current,
  onSwitch,
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);

  const close = useCallback(() => {
    setOpen(false);
    setFocusIdx(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setFocusIdx(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % accounts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => (i - 1 + accounts.length) % accounts.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusIdx >= 0) {
        onSwitch(accounts[focusIdx]);
        close();
      }
    }
  }

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left transition-all duration-200 hover:bg-surface-hover"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface2 text-[11px] font-semibold text-text-secondary">
          {current.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight text-text">
            {current.name}
          </p>
          <p className="truncate text-[11px] leading-tight text-muted">
            {current.roleLabel}
          </p>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Switch account"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-md)]"
        >
          {accounts.map((acc, i) => (
            <button
              key={acc.id}
              role="option"
              aria-selected={acc.id === current.id}
              onClick={() => {
                onSwitch(acc);
                close();
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all duration-150 ${
                focusIdx === i
                  ? 'bg-surface-hover'
                  : acc.id === current.id
                    ? 'bg-surface2'
                    : 'hover:bg-surface-hover'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface2 text-[11px] font-semibold text-text-secondary">
                {acc.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-text">
                  {acc.name}
                </p>
                <p className="truncate text-[11px] text-muted">{acc.roleLabel}</p>
              </div>
              {acc.id === current.id && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-success"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
