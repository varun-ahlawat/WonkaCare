import { forwardRef, type InputHTMLAttributes } from 'react';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = '', ...props }, ref) => (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        ref={ref}
        type="text"
        className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface pl-9 pr-3 text-[13px] text-text placeholder:text-muted/80 shadow-[var(--shadow-inset)] transition-all duration-200 focus:border-border-strong focus:bg-surface2 focus:outline-none focus-ring"
        {...props}
      />
    </div>
  ),
);

SearchInput.displayName = 'SearchInput';
