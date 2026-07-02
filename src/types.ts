/**
 * Public data model for the trade optimizer.
 *
 * Everything here is plain JSON — no classes, no DOM, no Node APIs — so the
 * same module runs unchanged in the browser, in a Web Worker, or later inside
 * an AWS Lambda handler.
 */

/** Static description of a good: how heavy one unit is. */
export interface GoodSpec {
  /** Cargo weight of a single unit. Integer >= 1 in practice. */
  weight: number;
}

/** What one good looks like at one location. All fields optional. */
export interface LocationGood {
  /** Price to buy one unit here (relevant at the departure port). */
  buy?: number;
  /** Price to sell one unit here (relevant at the arrival port). */
  sell?: number;
  /** Units offered for sale here (relevant at the departure port). */
  available?: number;
}

/** The raw problem, as a user would enter it in the UI. */
export interface OptimizeInput {
  /** Ship cargo hold capacity (total weight it can carry). Integer. */
  capacity: number;
  /** Optional money-on-hand limit. Omit/null for "unlimited". */
  budget?: number | null;
  /** name -> spec */
  goods: Record<string, GoodSpec>;
  /** location -> (good -> prices/availability) */
  locations: Record<string, Record<string, LocationGood>>;
  /** Where you buy. */
  departure: string;
  /** Where you sell. */
  arrival: string;
}

/** A good reduced to just what the solver needs on a fixed route. */
export interface Trade {
  name: string;
  buyPrice: number;
  sellPrice: number;
  weight: number;
  available: number;
  /** sellPrice - buyPrice, per unit. */
  profit: number;
  /** profit / weight — the greedy ordering key. */
  density: number;
}

/** One line of the resulting shopping list. */
export interface PlanLine {
  name: string;
  quantity: number;
  unitProfit: number;
  weight: number;      // total weight this line occupies
  cost: number;        // total buy cost of this line
  profit: number;      // total profit of this line
}

export type SolveMethod = 'exact' | 'greedy' | 'auto';

/** The answer. */
export interface Plan {
  /** good name -> units to buy (only positive quantities). */
  quantities: Record<string, number>;
  /** Detailed, sorted breakdown (most profitable line first). */
  lines: PlanLine[];
  profit: number;
  cost: number;
  revenue: number;
  weightUsed: number;
  capacity: number;
  /** Which algorithm produced this plan. */
  method: 'exact' | 'greedy' | 'none';
  /** True when `profit` is provably the maximum. */
  optimal: boolean;
  /** LP-relaxation (fractional) upper bound on profit. */
  upperBound: number;
  /** upperBound - profit (0 => optimal). */
  gap: number;
}
