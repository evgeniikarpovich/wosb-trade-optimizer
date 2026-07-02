import { useState } from 'react';
import { useI18n } from '../i18n';
import {
  colorFor,
  getCell,
  type AppState,
  type Cell,
  type GoodDef,
  type LocationDef,
} from '../lib/model';
import { Card, Field, NumberInput, SelectInput, TextInput } from './ui';

export interface AppActions {
  setField: (patch: Partial<AppState>) => void;
  addGood: () => void;
  removeGood: (id: string) => void;
  updateGood: (id: string, patch: Partial<GoodDef>) => void;
  addLocation: () => string;
  removeLocation: (id: string) => void;
  updateLocation: (id: string, patch: Partial<LocationDef>) => void;
  setCell: (locId: string, goodId: string, patch: Partial<Cell>) => void;
  reset: () => void;
}

const iconButton = (extra = '') =>
  'grid h-7 w-7 place-items-center rounded-md text-slate-400 transition ' +
  'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 ' +
  extra;

function RouteCard({ state, actions }: { state: AppState; actions: AppActions }) {
  const { t } = useI18n();
  const sameLoc =
    state.departureId === state.arrivalId && state.locations.length > 0;

  const options = state.locations.map((l) => (
    <option key={l.id} value={l.id}>
      {l.name.trim() || t('port')}
    </option>
  ));

  return (
    <Card title={t('routeSection')}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('capacity')}>
          <NumberInput
            value={state.capacity}
            onValue={(n) => actions.setField({ capacity: n })}
          />
        </Field>
        <Field label={t('budget')} hint={t('budgetHint')}>
          <TextInput
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t('unlimited')}
            value={state.budget ?? ''}
            onChange={(e) =>
              actions.setField({
                budget: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Field label={t('departure')}>
          <SelectInput
            value={state.departureId}
            onChange={(e) => actions.setField({ departureId: e.target.value })}
          >
            {options}
          </SelectInput>
        </Field>
        <button
          type="button"
          onClick={() =>
            actions.setField({
              departureId: state.arrivalId,
              arrivalId: state.departureId,
            })
          }
          title={t('swap')}
          aria-label={t('swap')}
          className="mb-0.5 grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          ⇄
        </button>
        <Field label={t('arrival')}>
          <SelectInput
            value={state.arrivalId}
            onChange={(e) => actions.setField({ arrivalId: e.target.value })}
          >
            {options}
          </SelectInput>
        </Field>
      </div>

      {sameLoc && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {t('sameLocation')}
        </p>
      )}
    </Card>
  );
}

function PricesCard({ state, actions }: { state: AppState; actions: AppActions }) {
  const { t } = useI18n();
  const [active, setActive] = useState<string>(state.departureId);

  // Clamp to an existing port (handles removals / persisted ids).
  const activeId = state.locations.some((l) => l.id === active)
    ? active
    : (state.locations[0]?.id ?? '');
  const activeLoc = state.locations.find((l) => l.id === activeId);

  return (
    <Card
      title={t('pricesSection')}
      action={
        <button
          type="button"
          onClick={() => setActive(actions.addLocation())}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          + {t('addPort')}
        </button>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <SelectInput
          value={activeId}
          onChange={(e) => setActive(e.target.value)}
          className="max-w-[9rem]"
        >
          {state.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name.trim() || t('port')}
            </option>
          ))}
        </SelectInput>
        {activeLoc && (
          <>
            <TextInput
              value={activeLoc.name}
              placeholder={t('portName')}
              onChange={(e) =>
                actions.updateLocation(activeLoc.id, { name: e.target.value })
              }
            />
            <button
              type="button"
              onClick={() => actions.removeLocation(activeLoc.id)}
              disabled={state.locations.length <= 1}
              aria-label={t('removePort')}
              title={t('removePort')}
              className={iconButton('disabled:cursor-not-allowed disabled:opacity-30')}
            >
              🗑
            </button>
          </>
        )}
      </div>

      {activeLoc && (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[300px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="px-1 pb-1 font-medium">{t('good')}</th>
                <th className="px-1 pb-1 text-right font-medium">{t('price')}</th>
                <th className="px-1 pb-1 text-right font-medium">{t('available')}</th>
              </tr>
            </thead>
            <tbody>
              {state.goods.map((g) => {
                const c = getCell(state, activeLoc.id, g.id);
                return (
                  <tr key={g.id}>
                    <td className="px-1 py-0.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: colorFor(g.name.trim()) }}
                        />
                        <span className="truncate">
                          {g.name.trim() || (
                            <em className="text-slate-400">{t('namePlaceholder')}</em>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-1 py-0.5">
                      <NumberInput
                        value={c.price}
                        onValue={(n) => actions.setCell(activeLoc.id, g.id, { price: n })}
                        className="w-24 text-right"
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <NumberInput
                        value={c.available}
                        onValue={(n) =>
                          actions.setCell(activeLoc.id, g.id, { available: n })
                        }
                        className="w-24 text-right"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Collapsed by default: the catalogue + (mostly static) weights, at the end. */
function CatalogueCard({
  state,
  actions,
}: {
  state: AppState;
  actions: AppActions;
}) {
  const { t } = useI18n();
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 sm:p-5">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('catalogue')}
        </span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              actions.reset();
            }}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t('loadSample')}
          </button>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4 text-slate-400 transition group-open:rotate-180"
            aria-hidden="true"
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>

      <div className="border-t border-slate-100 p-4 dark:border-slate-800 sm:p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="px-1 pb-1 font-medium">{t('good')}</th>
              <th className="px-1 pb-1 text-right font-medium">{t('weight')}</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {state.goods.map((g) => (
              <tr key={g.id}>
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(g.name.trim()) }}
                    />
                    <TextInput
                      value={g.name}
                      placeholder={t('namePlaceholder')}
                      onChange={(e) => actions.updateGood(g.id, { name: e.target.value })}
                    />
                  </div>
                </td>
                <td className="px-1 py-0.5">
                  <NumberInput
                    value={g.weight}
                    min={1}
                    onValue={(n) => actions.updateGood(g.id, { weight: n })}
                    className="w-24 text-right"
                  />
                </td>
                <td className="px-1 py-0.5 text-right">
                  <button
                    type="button"
                    onClick={() => actions.removeGood(g.id)}
                    aria-label={t('removeGood')}
                    title={t('removeGood')}
                    className={iconButton()}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={actions.addGood}
          className="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          + {t('addGood')}
        </button>
      </div>
    </details>
  );
}

export function InputPanel({
  state,
  actions,
}: {
  state: AppState;
  actions: AppActions;
}) {
  return (
    <div className="space-y-4">
      <RouteCard state={state} actions={actions} />
      <PricesCard state={state} actions={actions} />
      <CatalogueCard state={state} actions={actions} />
    </div>
  );
}
