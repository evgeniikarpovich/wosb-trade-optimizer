import { emptyCell, uid, type AppState, type Cell } from './model';
import seed from './seed.json';

interface Seed {
  capacity: number;
  budget: number | null;
  goods: { name: string; weight: number }[];
  locations: { name: string; cells: Record<string, Partial<Cell>> }[];
}

/**
 * Default workspace, built from `seed.json`: the full 20-good catalogue (with
 * measured weights where known) and two ports. Every good exists at every port;
 * unlisted buy/sell/stock default to 0 so the user fills them in case by case.
 */
export function sampleState(): AppState {
  const s = seed as Seed;

  const goods = s.goods.map((g) => ({
    id: uid('g'),
    name: g.name,
    weight: g.weight,
  }));
  const idByName = new Map(goods.map((g) => [g.name, g.id]));

  const locations = s.locations.map((l) => ({ id: uid('loc'), name: l.name }));

  const prices: AppState['prices'] = {};
  s.locations.forEach((l, i) => {
    const locId = locations[i]!.id;
    const row: Record<string, Cell> = {};
    for (const [goodName, cell] of Object.entries(l.cells)) {
      const gid = idByName.get(goodName);
      if (gid) row[gid] = { ...emptyCell(), ...cell };
    }
    prices[locId] = row;
  });

  return {
    goods,
    locations,
    prices,
    departureId: locations[0]?.id ?? '',
    arrivalId: locations[1]?.id ?? locations[0]?.id ?? '',
    capacity: s.capacity,
    budget: s.budget,
  };
}
