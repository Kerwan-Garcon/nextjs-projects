import type { CSSProperties, ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * Interface primitives.
 *
 * Deliberately few and deliberately plain: a panel, a rule, a label, a meter, a
 * badge. Information density comes from typography and alignment, not from
 * nested cards and shadows.
 */

export function Panel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={cn('border border-line bg-panel', className)}>{children}</Tag>;
}

export function PanelHeader({
  title,
  meta,
  action,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-4 border-b border-line px-4 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="label">{title}</span>
        {meta ? <span className="mono truncate text-[11px] text-ink-dim">{meta}</span> : null}
      </div>
      {action}
    </header>
  );
}

export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="section-head mb-4 mt-10 first:mt-0">
      <span className="label text-ink-muted">{children}</span>
    </h2>
  );
}

/**
 * Segmented meter. Reads as ███████░░░ at a glance and gives the number for
 * anyone who needs it - the brief's bar idiom, drawn rather than typed.
 */
export function Meter({
  value,
  max = 10,
  tone = 'neutral',
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: 'neutral' | 'warn' | 'alert' | 'signal';
  label?: string;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  const toneClass = {
    neutral: 'bg-ink-muted',
    warn: 'bg-warn',
    alert: 'bg-alert',
    signal: 'bg-signal',
  }[tone];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label ? <span className="label w-[72px] shrink-0">{label}</span> : null}
      <div
        className="flex gap-[2px]"
        role="img"
        aria-label={`${label ?? 'level'} ${filled} of ${max}`}
      >
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={cn('h-[9px] w-[5px]', index < filled ? toneClass : 'bg-line-strong')}
          />
        ))}
      </div>
      <span className="mono text-[11px] text-ink-dim">{filled}</span>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  style,
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'signal' | 'warn' | 'alert' | 'ok' | 'outline';
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const tones = {
    neutral: 'border-line-strong text-ink-muted',
    signal: 'border-signal/40 text-signal',
    warn: 'border-warn/40 text-warn',
    alert: 'border-alert/40 text-alert',
    ok: 'border-ok/40 text-ok',
    outline: 'border-line text-ink-dim',
  }[tone];

  return (
    <span
      title={title}
      style={style}
      className={cn(
        'mono inline-flex items-center gap-1 border px-1.5 py-[1px] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap',
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="label">{label}</div>
      <div className="mono mt-1 text-[22px] leading-none text-ink">{value}</div>
      {hint ? <div className="mono mt-1.5 text-[11px] text-ink-dim">{hint}</div> : null}
    </div>
  );
}

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="label pt-[3px]">{k}</dt>
      <dd className="min-w-0 text-[13px] text-ink-muted">{v}</dd>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-line px-4 py-6 text-center">
      <p className="mono text-[12px] uppercase tracking-[0.1em] text-ink-dim">{title}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-[12px] text-ink-dim">{hint}</p> : null}
    </div>
  );
}

export function Button({
  children,
  variant = 'default',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  const variants = {
    default: 'border-line-strong bg-panel-raised text-ink hover:border-ink-dim',
    primary: 'border-signal/50 bg-signal/10 text-signal hover:bg-signal/20',
    ghost: 'border-transparent text-ink-muted hover:text-ink hover:border-line',
    danger: 'border-alert/40 bg-alert/10 text-alert hover:bg-alert/20',
  }[variant];

  const sizes = { sm: 'px-2 py-1 text-[11px]', md: 'px-3 py-1.5 text-[12px]' }[size];

  return (
    <button
      {...props}
      className={cn(
        'mono inline-flex items-center justify-center gap-1.5 border uppercase tracking-[0.08em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        variants,
        sizes,
        className,
      )}
    >
      {children}
    </button>
  );
}
