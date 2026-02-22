import { forwardRef, type ButtonHTMLAttributes } from 'react';

const base =
  'inline-flex items-center justify-center gap-1.5 font-medium cursor-pointer transition-all duration-150 focus-ring select-none disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]';

const sizes = {
  sm: 'h-7 rounded-md px-2.5 text-[12px]',
  md: 'h-8 rounded-[var(--radius-sm)] px-3 text-[12px]',
  lg: 'h-9 rounded-[var(--radius-sm)] px-4 text-[13px]',
} as const;

const variants = {
  primary:
    'bg-text text-bg shadow-[var(--shadow-sm)] hover:brightness-90 active:brightness-80',
  secondary:
    'border border-border bg-surface text-text-secondary shadow-[var(--shadow-sm),var(--shadow-inset)] hover:bg-surface2 hover:text-text hover:border-border-strong',
  danger:
    'border border-danger/12 bg-danger-muted text-danger hover:border-danger/20 hover:bg-danger/20',
  success:
    'border border-success/12 bg-success-muted text-success hover:border-success/20 hover:bg-success/20',
  ghost:
    'text-text-secondary hover:bg-surface-hover hover:text-text',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
