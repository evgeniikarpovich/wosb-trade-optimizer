import type { Plan } from '@core';
import { useI18n } from '../i18n';
import { colorFor } from '../lib/model';
import { fmtInt } from '../lib/format';
import { Card } from './ui';
import { CargoComposition, ProfitBars, UtilizationBar } from './charts';

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xl font-bold tabular-nums ${accent ?? 'text-slate-800 dark:text-slate-100'}`}
      >
        {value}
      </div>
    </div>
  );
}

function SolverBadge({ plan }: { plan: Plan }) {
  const { t } = useI18n();
  const exact = plan.method === 'exact';
  const optimal = plan.optimal;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={
          'rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
          (exact
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300')
        }
      >
        {t('solver')}: {exact ? t('exact') : t('greedy')}
      </span>
      {optimal && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          ✓ {t('optimal')}
        </span>
      )}
    </div>
  );
}

function ShoppingList({ plan }: { plan: Plan }) {
  const { t, locale } = useI18n();
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[380px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
            <th className="py-1.5 pr-2 font-medium">{t('good')}</th>
            <th className="py-1.5 px-2 text-right font-medium">{t('quantity')}</th>
            <th className="py-1.5 px-2 text-right font-medium">{t('weight')}</th>
            <th className="py-1.5 px-2 text-right font-medium">{t('lineCost')}</th>
            <th className="py-1.5 pl-2 text-right font-medium">{t('lineProfit')}</th>
          </tr>
        </thead>
        <tbody>
          {plan.lines.map((l) => (
            <tr
              key={l.name}
              className="border-b border-slate-100 last:border-0 dark:border-slate-800"
            >
              <td className="py-1.5 pr-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colorFor(l.name) }}
                  />
                  {l.name}
                </span>
              </td>
              <td className="py-1.5 px-2 text-right font-semibold tabular-nums">
                {fmtInt(l.quantity, locale)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                {fmtInt(l.weight, locale)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                {fmtInt(l.cost, locale)}
              </td>
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{fmtInt(l.profit, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  plan: Plan | null;
  computing: boolean;
  error: string | null;
  budget: number | null;
}

export function ResultsPanel({ plan, computing, error, budget }: Props) {
  const { t, locale } = useI18n();

  const hasPlan = plan && plan.lines.length > 0;

  return (
    <div className="space-y-4">
      <Card
        title={t('resultsSection')}
        action={plan && hasPlan ? <SolverBadge plan={plan} /> : null}
      >
        {error ? (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        ) : !hasPlan ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            {computing ? t('computing') : t('noTrade')}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <StatTile
                label={t('totalProfit')}
                value={`+${fmtInt(plan.profit, locale)}`}
                accent="text-emerald-600 dark:text-emerald-400"
              />
              <StatTile label={t('spend')} value={fmtInt(plan.cost, locale)} />
              <StatTile label={t('earn')} value={fmtInt(plan.revenue, locale)} />
            </div>

            <div className="space-y-2.5">
              <UtilizationBar
                label={t('holdUsed')}
                used={plan.weightUsed}
                total={plan.capacity}
                color="#3b82f6"
              />
              {budget != null && (
                <UtilizationBar
                  label={t('budgetUsed')}
                  used={plan.cost}
                  total={budget}
                  color="#f59e0b"
                />
              )}
            </div>

            {!plan.optimal && plan.gap > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('gap')}: {fmtInt(plan.gap, locale)}
              </p>
            )}
          </div>
        )}
      </Card>

      {hasPlan && (
        <>
          <Card title={t('chartProfit')}>
            <ProfitBars lines={plan.lines} />
          </Card>
          <Card title={t('chartCargo')}>
            <CargoComposition
              lines={plan.lines}
              capacity={plan.capacity}
              weightUsed={plan.weightUsed}
            />
          </Card>
          <Card title={t('shoppingList')}>
            <ShoppingList plan={plan} />
          </Card>
        </>
      )}
    </div>
  );
}
