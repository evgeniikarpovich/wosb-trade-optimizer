import type { ReactNode } from 'react';

export function Card({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const inputBase =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function SelectInput(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return <select {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

/** Numeric input that reports a clean number (empty -> 0) via onValue. */
export function NumberInput({
  value,
  onValue,
  min = 0,
  className,
  ...rest
}: {
  value: number;
  onValue: (n: number) => void;
  min?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => {
        const v = e.target.value === '' ? 0 : Number(e.target.value);
        onValue(Number.isFinite(v) ? v : 0);
      }}
      className={`${inputBase} tabular-nums ${className ?? ''}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}
