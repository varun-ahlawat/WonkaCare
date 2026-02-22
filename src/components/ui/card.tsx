interface CardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-inset)] ${className}`}
    >
      {title && (
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
