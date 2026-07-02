import type { PlanLine } from '@core';
import { useI18n } from '../i18n';
import { colorFor } from '../lib/model';
import { fmtInt, fmtPct } from '../lib/format';

/** Horizontal bars of profit contribution per good. */
export function ProfitBars({ lines }: { lines: PlanLine[] }) {
  const { locale } = useI18n();
  const max = Math.max(...lines.map((l) => l.profit), 1);

  return (
    <div className="space-y-2">
      {lines.map((l) => (
        <div key={l.name} className="flex items-center gap-3">
          <div className="w-20 shrink-0 truncate text-right text-xs font-medium text-slate-600 dark:text-slate-300">
            {l.name}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${(l.profit / max) * 100}%`,
                backgroundColor: colorFor(l.name),
              }}
            />
          </div>
          <div className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-700 dark:text-slate-200">
            {fmtInt(l.profit, locale)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A single stacked bar showing how each good fills the cargo hold by weight. */
export function CargoComposition({
  lines,
  capacity,
  weightUsed,
}: {
  lines: PlanLine[];
  capacity: number;
  weightUsed: number;
}) {
  const { t, locale } = useI18n();
  const free = Math.max(0, capacity - weightUsed);

  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        {lines.map((l) => (
          <div
            key={l.name}
            className="h-full first:rounded-l-lg"
            style={{
              width: `${(l.weight / capacity) * 100}%`,
              backgroundColor: colorFor(l.name),
            }}
            title={`${l.name}: ${fmtInt(l.weight, locale)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {lines.map((l) => (
          <span key={l.name} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colorFor(l.name) }}
            />
            {l.name}
            <span className="tabular-nums">
              {fmtPct(l.weight / capacity, locale)}
            </span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          {t('chartFree')}
          <span className="tabular-nums">{fmtPct(free / capacity, locale)}</span>
        </span>
      </div>
    </div>
  );
}

/** Labeled progress bar (hold / budget usage). */
export function UtilizationBar({
  label,
  used,
  total,
  color,
}: {
  label: string;
  used: number;
  total: number;
  color: string;
}) {
  const { locale } = useI18n();
  const frac = total > 0 ? Math.min(1, used / total) : 0;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">
          {fmtInt(used, locale)} / {fmtInt(total, locale)} ·{' '}
          <span className="font-semibold">{fmtPct(frac, locale)}</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${frac * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
