import type { OptimizeInput } from '@core';

/** A good is global: it has a name and a per-unit cargo weight. */
export interface GoodDef {
  id: string;
  name: string;
  weight: number;
}

/** A port. */
export interface LocationDef {
  id: string;
  name: string;
}

/**
 * Market data for one good at one location. A single `price` per port doubles as
 * the buy price (when the port is the departure) and the sell price (when it's
 * the arrival); profit on a route is the price difference between ports.
 */
export interface Cell {
  price: number;
  available: number;
}

export interface AppState {
  goods: GoodDef[];
  locations: LocationDef[];
  /** prices[locationId][goodId] */
  prices: Record<string, Record<string, Cell>>;
  departureId: string;
  arrivalId: string;
  capacity: number;
  budget: number | null;
}

export const emptyCell = (): Cell => ({ price: 0, available: 0 });

/** Collision-resistant id (stable across reloads / persisted state). */
export function uid(prefix = 'id'): string {
  const c = globalThis.crypto;
  const rand =
    c && 'randomUUID' in c
      ? c.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function newGood(): GoodDef {
  return { id: uid('g'), name: '', weight: 1 };
}

export function newLocation(name = ''): LocationDef {
  return { id: uid('loc'), name };
}

export function getCell(state: AppState, locId: string, goodId: string): Cell {
  return state.prices[locId]?.[goodId] ?? emptyCell();
}

/**
 * Fold the location/price state into the solver's `OptimizeInput`. Buy price and
 * stock are read from the selected **departure** port; sell price from the
 * selected **arrival** port. Goods with a blank name or non-positive weight are
 * skipped. If departure and arrival happen to share a name, their cells merge.
 */
export function toOptimizeInput(state: AppState): OptimizeInput {
  const depLoc = state.locations.find((l) => l.id === state.departureId);
  const arrLoc = state.locations.find((l) => l.id === state.arrivalId);
  const depName = depLoc?.name.trim() || 'Departure';
  const arrName = arrLoc?.name.trim() || 'Arrival';

  const goods: OptimizeInput['goods'] = {};
  const locations: OptimizeInput['locations'] = {};
  const dep = (locations[depName] ??= {});
  const arr = (locations[arrName] ??= {});

  for (const g of state.goods) {
    const name = g.name.trim();
    if (!name || !(g.weight > 0)) continue;
    goods[name] = { weight: g.weight };

    if (depLoc) {
      const c = getCell(state, depLoc.id, g.id);
      dep[name] = {
        ...dep[name],
        buy: c.price,
        available: Math.max(0, Math.floor(c.available)),
      };
    }
    if (arrLoc) {
      const c = getCell(state, arrLoc.id, g.id);
      arr[name] = { ...arr[name], sell: c.price };
    }
  }

  return {
    capacity: Math.max(0, Math.floor(state.capacity)),
    budget: state.budget,
    goods,
    locations,
    departure: depName,
    arrival: arrName,
  };
}

/** Deterministic, theme-friendly color per good (used across list + charts). */
const PALETTE = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ef4444', // red
  '#14b8a6', // teal
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
