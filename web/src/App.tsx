import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { InputPanel, type AppActions } from './components/InputPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { useI18n } from './i18n';
import { useOptimizer } from './lib/useOptimizer';
import {
  emptyCell,
  newGood,
  newLocation,
  toOptimizeInput,
  type AppState,
} from './lib/model';
import { loadState, saveState } from './lib/persist';
import { sampleState } from './lib/sampleData';

export function App() {
  const { t } = useI18n();
  const [state, setState] = useState<AppState>(() => loadState() ?? sampleState());

  // Persist on every change.
  useEffect(() => saveState(state), [state]);

  const actions = useMemo<AppActions>(
    () => ({
      setField: (patch) => setState((s) => ({ ...s, ...patch })),

      addGood: () => setState((s) => ({ ...s, goods: [...s.goods, newGood()] })),

      removeGood: (id) =>
        setState((s) => {
          const prices: AppState['prices'] = {};
          for (const [locId, row] of Object.entries(s.prices)) {
            const { [id]: _drop, ...rest } = row;
            prices[locId] = rest;
          }
          return { ...s, goods: s.goods.filter((g) => g.id !== id), prices };
        }),

      updateGood: (id, patch) =>
        setState((s) => ({
          ...s,
          goods: s.goods.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),

      addLocation: () => {
        // Create the loc up front so we can return its id and select it.
        const loc = newLocation();
        setState((s) => {
          const next = { ...s, locations: [...s.locations, loc] };
          if (!s.departureId) next.departureId = loc.id;
          if (!s.arrivalId) next.arrivalId = loc.id;
          return next;
        });
        return loc.id;
      },

      removeLocation: (id) =>
        setState((s) => {
          const locations = s.locations.filter((l) => l.id !== id);
          const { [id]: _drop, ...prices } = s.prices;
          const fallback = locations[0]?.id ?? '';
          return {
            ...s,
            locations,
            prices,
            departureId: s.departureId === id ? fallback : s.departureId,
            arrivalId: s.arrivalId === id ? fallback : s.arrivalId,
          };
        }),

      updateLocation: (id, patch) =>
        setState((s) => ({
          ...s,
          locations: s.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      setCell: (locId, goodId, patch) =>
        setState((s) => ({
          ...s,
          prices: {
            ...s.prices,
            [locId]: {
              ...s.prices[locId],
              [goodId]: { ...emptyCell(), ...s.prices[locId]?.[goodId], ...patch },
            },
          },
        })),

      reset: () => setState(sampleState()),
    }),
    [],
  );

  const input = useMemo(() => toOptimizeInput(state), [state]);
  const { plan, computing, error } = useOptimizer(input);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <InputPanel state={state} actions={actions} />
          <ResultsPanel
            plan={plan}
            computing={computing}
            error={error}
            budget={state.budget}
          />
        </div>
        <footer className="mx-auto mt-8 max-w-6xl text-center text-xs text-slate-400 dark:text-slate-600">
          {t('appTitle')} · bounded-knapsack solver in a Web Worker
        </footer>
      </main>
    </div>
  );
}
