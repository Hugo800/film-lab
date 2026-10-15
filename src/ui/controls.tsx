import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement>;

const join = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/** Runder Knopf mit 44-px-Trefferfläche; `label` ist Pflicht (aria-label). */
export function IconButton({ label, className, children, ...rest }: BtnProps & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={join(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg transition-colors hover:bg-raised active:bg-line disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = 'secondary',
  className,
  children,
  ...rest
}: BtnProps & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const look =
    variant === 'primary'
      ? 'bg-accent text-accent-fg font-semibold hover:brightness-110'
      : variant === 'secondary'
        ? 'bg-raised text-fg hover:bg-line'
        : 'text-dim hover:text-fg hover:bg-raised';
  return (
    <button
      type="button"
      {...rest}
      className={join(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] transition disabled:opacity-40',
        look,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={join('inline-block size-5 animate-spin rounded-full border-2 border-dim border-t-transparent', className)}
    />
  );
}

export function Message({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 text-center">
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {children && <p className="text-sm leading-relaxed text-dim">{children}</p>}
      {action}
    </div>
  );
}
