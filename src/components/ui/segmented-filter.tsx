interface SegmentedFilterProps<T extends string> {
  options: { value: T; label: string; dot?: 'live' }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
}: SegmentedFilterProps<T>) {
  return (
    <div
      role="radiogroup"
      className="inline-flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface p-[3px]"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1 text-[12px] font-medium transition-all duration-200 focus-ring ${
              active
                ? 'bg-surface2 text-text shadow-[var(--shadow-sm)]'
                : 'text-muted hover:text-text-secondary hover:bg-surface-hover/50'
            }`}
          >
            {opt.dot === 'live' && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
              </span>
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
