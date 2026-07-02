/**
 * Bounded-knapsack solver for the WoSB trade problem.
 *
 *   maximize    sum_i  profit_i * q_i
 *   subject to  sum_i  weight_i * q_i <= capacity
 *               0 <= q_i <= available_i          (q_i integer)
 *
 * Two strategies:
 *
 *   - solveExact:  binary-decomposition 0/1 knapsack DP. Weights are integer
 *                  game values, so capacity indexes the DP directly with no
 *                  scaling. O(capacity * sum_i log(available_i)). For this
 *                  game's bounds (capacity <= ~200k, <= 20 goods) this is a
 *                  few tens of milliseconds worst case — instant in practice.
 *
 *   - solveGreedy: sort by profit-per-weight and fill. This is the LP-optimal
 *                  ordering, an excellent heuristic, and also yields a provable
 *                  upper bound (the fractional optimum) we report as `gap`.
 *
 * A `budget` (money-on-hand) constraint is only modelled by the greedy solver,
 * so supplying one routes through greedy.
 */

import type {
  OptimizeInput,
  Plan,
  PlanLine,
  SolveMethod,
  Trade,
} from './types.js';

/** Largest DP cell count (chunks * (capacity+1)) we will allocate. */
const MAX_STATES = 300_000_000;

// --------------------------------------------------------------------------- //
// Build the route's trade list from the raw per-location data.
// --------------------------------------------------------------------------- //

export function buildTrades(input: OptimizeInput): Trade[] {
  const { goods, locations, departure, arrival } = input;

  const dep = locations[departure];
  if (!dep) throw new Error(`Unknown departure location: ${departure}`);
  const arr = locations[arrival];
  if (!arr) throw new Error(`Unknown arrival location: ${arrival}`);

  const trades: Trade[] = [];
  for (const [name, spec] of Object.entries(goods)) {
    const weight = spec.weight;
    if (!(weight > 0)) throw new Error(`Good ${name} must have positive weight`);

    const buy = dep[name]?.buy;
    const available = dep[name]?.available ?? 0;
    const sell = arr[name]?.sell;

    // Must be buyable at departure and sellable at arrival.
    if (buy == null || sell == null || available <= 0) continue;

    const profit = sell - buy;
    if (profit <= 0) continue; // never worth carrying

    trades.push({
      name,
      buyPrice: buy,
      sellPrice: sell,
      weight,
      available: Math.floor(available),
      profit,
      density: profit / weight,
    });
  }
  return trades;
}

// --------------------------------------------------------------------------- //
// Shared helpers
// --------------------------------------------------------------------------- //

/**
 * LP relaxation (fractional knapsack): fill by density, allowing a fractional
 * last unit. A valid upper bound on the integer optimum.
 */
export function fractionalUpperBound(trades: Trade[], capacity: number): number {
  let remaining = capacity;
  let bound = 0;
  for (const t of [...trades].sort((a, b) => b.density - a.density)) {
    if (remaining <= 0) break;
    const maxWeight = t.available * t.weight;
    const takeWeight = Math.min(maxWeight, remaining);
    bound += t.density * takeWeight;
    remaining -= takeWeight;
  }
  return bound;
}

/**
 * Assemble a Plan (lines, totals) from a chosen quantity map.
 *
 * `upperBoundOverride` lets a solver supply a tighter valid bound than the
 * weight-only LP relaxation (e.g. the budget-aware bound from B&B).
 */
function makePlan(
  quantities: Record<string, number>,
  trades: Trade[],
  capacity: number,
  method: Plan['method'],
  optimal: boolean,
  upperBoundOverride?: number,
): Plan {
  const byName = new Map(trades.map((t) => [t.name, t]));
  const lines: PlanLine[] = [];
  let profit = 0;
  let cost = 0;
  let revenue = 0;
  let weightUsed = 0;

  for (const [name, qty] of Object.entries(quantities)) {
    if (qty <= 0) continue;
    const t = byName.get(name);
    if (!t) continue;
    const lineProfit = t.profit * qty;
    const lineCost = t.buyPrice * qty;
    lines.push({
      name,
      quantity: qty,
      unitProfit: t.profit,
      weight: t.weight * qty,
      cost: lineCost,
      profit: lineProfit,
    });
    profit += lineProfit;
    cost += lineCost;
    revenue += t.sellPrice * qty;
    weightUsed += t.weight * qty;
  }

  lines.sort((a, b) => b.profit - a.profit);

  const cleaned: Record<string, number> = {};
  for (const line of lines) cleaned[line.name] = line.quantity;

  let upperBound = fractionalUpperBound(trades, capacity);
  if (upperBoundOverride != null) {
    upperBound = Math.min(upperBound, upperBoundOverride);
  }
  return {
    quantities: cleaned,
    lines,
    profit,
    cost,
    revenue,
    weightUsed,
    capacity,
    method,
    optimal,
    upperBound,
    // When the plan is provably optimal the gap is exactly zero, regardless of
    // how loose the LP relaxation happens to be. Otherwise it's the distance to
    // the best valid bound we have.
    gap: optimal ? 0 : Math.max(0, upperBound - profit),
  };
}

// --------------------------------------------------------------------------- //
// Greedy solver (also handles the optional budget constraint)
// --------------------------------------------------------------------------- //

export function solveGreedy(
  trades: Trade[],
  capacity: number,
  budget?: number | null,
): Plan {
  let remainingWeight = capacity;
  let remainingMoney = budget == null ? Infinity : budget;
  const quantities: Record<string, number> = {};

  for (const t of [...trades].sort((a, b) => b.density - a.density)) {
    if (remainingWeight <= 0 || remainingMoney <= 0) break;
    const byWeight = Math.floor(remainingWeight / t.weight);
    const byMoney =
      t.buyPrice > 0 ? Math.floor(remainingMoney / t.buyPrice) : t.available;
    const qty = Math.min(t.available, byWeight, byMoney);
    if (qty <= 0) continue;
    quantities[t.name] = qty;
    remainingWeight -= t.weight * qty;
    remainingMoney -= t.buyPrice * qty;
  }

  // Exact only when no budget constraint bound the result.
  const optimal = false;
  return makePlan(quantities, trades, capacity, 'greedy', optimal);
}

// --------------------------------------------------------------------------- //
// Exact bounded-knapsack DP
// --------------------------------------------------------------------------- //

interface Chunk {
  weight: number;
  value: number;
  name: string;
  qty: number;
}

/** Split each good's bounded count into 1,2,4,... power-of-two chunks. */
function decompose(trades: Trade[], capacity: number): Chunk[] {
  const chunks: Chunk[] = [];
  for (const t of trades) {
    const w = t.weight;
    if (w <= 0 || w > capacity) continue;
    // Never useful to keep more units than physically fit.
    let count = Math.min(t.available, Math.floor(capacity / w));
    let k = 1;
    while (count > 0) {
      const take = Math.min(k, count);
      chunks.push({
        weight: w * take,
        value: t.profit * take,
        name: t.name,
        qty: take,
      });
      count -= take;
      k *= 2;
    }
  }
  return chunks;
}

/**
 * Exact solve. Returns null when the DP table would exceed MAX_STATES (never
 * happens for this game's bounds, but keeps us safe) so the caller can fall
 * back to greedy.
 */
export function solveExact(trades: Trade[], capacity: number): Plan | null {
  const W = Math.floor(capacity);
  if (W <= 0 || trades.length === 0) {
    return makePlan({}, trades, capacity, trades.length ? 'exact' : 'none', true);
  }

  const chunks = decompose(trades, W);
  const rows = chunks.length;
  const cols = W + 1;
  if (rows * cols > MAX_STATES) return null;

  const dp = new Float64Array(cols); // dp[w] = best profit using weight <= w
  // keep is a bitset: bit (i*cols + w) == 1 means chunk i was taken at cell w.
  const keep = new Uint8Array(Math.ceil((rows * cols) / 8));

  for (let i = 0; i < rows; i++) {
    const c = chunks[i]!;
    const cw = c.weight;
    const cv = c.value;
    const base = i * cols;
    for (let w = W; w >= cw; w--) {
      const cand = dp[w - cw] + cv;
      if (cand > dp[w]) {
        dp[w] = cand;
        const bit = base + w;
        keep[bit >>> 3] |= 1 << (bit & 7);
      }
    }
  }

  // Backtrack from full capacity (dp is monotone non-decreasing, so dp[W] is
  // the optimum).
  const quantities: Record<string, number> = {};
  let w = W;
  for (let i = rows - 1; i >= 0; i--) {
    const bit = i * cols + w;
    if (keep[bit >>> 3] & (1 << (bit & 7))) {
      const c = chunks[i]!;
      quantities[c.name] = (quantities[c.name] ?? 0) + c.qty;
      w -= c.weight;
    }
  }

  return makePlan(quantities, trades, capacity, 'exact', true);
}

// --------------------------------------------------------------------------- //
// Exact solver WITH a budget: 2-D (weight x money) bounded knapsack.
//
// A full 2-D DP is infeasible when money is large, but with <= ~20 distinct
// goods this is small enough for branch-and-bound to solve exactly and fast.
//
//   * Bound: min of two single-resource LP relaxations (fractional fill by
//     profit/weight, and by profit/price). Each relaxes one constraint, so the
//     minimum is a valid — and tighter — upper bound on the node's optimum.
//   * Branch: split the domain of the "critical" (fractionally filled) good.
//   * Incumbent: seeded and refreshed with a both-constraints greedy fill, so
//     we always hold a feasible lower bound for pruning.
//
// A node cap guarantees termination; if it's ever hit (never for this game's
// sizes) we return the best feasible plan found, flagged non-optimal with a
// valid gap.
// --------------------------------------------------------------------------- //

/** Safety cap on B&B nodes. Game-sized instances use a tiny fraction of this. */
const MAX_BNB_NODES = 2_000_000;

export function solveExactBudget(
  trades: Trade[],
  capacity: number,
  budget: number,
): Plan {
  const n = trades.length;
  const W = Math.floor(capacity);
  const B = budget;
  if (n === 0 || W <= 0 || B <= 0) {
    return makePlan({}, trades, capacity, trades.length ? 'exact' : 'none', true);
  }

  const weight = trades.map((t) => t.weight);
  const price = trades.map((t) => t.buyPrice);
  const profit = trades.map((t) => t.profit);
  const avail = trades.map((t) => t.available);

  // Fixed orderings (densities don't change with the search box).
  const byWeight = [...Array(n).keys()].sort(
    (a, b) => profit[b]! / weight[b]! - profit[a]! / weight[a]!,
  );
  const byPrice = [...Array(n).keys()].sort((a, b) => {
    const da = price[a]! > 0 ? profit[a]! / price[a]! : Infinity;
    const db = price[b]! > 0 ? profit[b]! / price[b]! : Infinity;
    return db - da;
  });

  const EPS = 1e-9;

  /**
   * Continuous (LP) fill of one resource over the box [lo,hi], respecting the
   * committed lower bounds. Returns the bound, and the single good (if any)
   * that ended up fractional — the branch candidate.
   */
  const fill = (
    order: number[],
    res: number[],
    cap: number,
    lo: Int32Array,
    hi: Int32Array,
  ): { bound: number; fracItem: number; fracValue: number } => {
    let remaining = cap;
    let value = 0;
    for (let i = 0; i < n; i++) {
      remaining -= res[i]! * lo[i]!;
      value += profit[i]! * lo[i]!;
    }
    if (remaining < -EPS) return { bound: -Infinity, fracItem: -1, fracValue: 0 };

    for (const i of order) {
      const addable = hi[i]! - lo[i]!;
      if (addable <= 0) continue;
      const r = res[i]!;
      const maxByRes = r > 0 ? remaining / r : Infinity;
      if (maxByRes >= addable) {
        value += profit[i]! * addable;
        remaining -= r * addable;
      } else {
        value += profit[i]! * maxByRes;
        return { bound: value, fracItem: i, fracValue: lo[i]! + maxByRes };
      }
    }
    return { bound: value, fracItem: -1, fracValue: 0 };
  };

  /** Feasible integer fill honoring BOTH constraints — an incumbent source. */
  const greedyBoth = (lo: Int32Array, hi: Int32Array, order: number[]) => {
    const qty = Int32Array.from(lo);
    let remW = W;
    let remB = B;
    let value = 0;
    for (let i = 0; i < n; i++) {
      remW -= weight[i]! * lo[i]!;
      remB -= price[i]! * lo[i]!;
      value += profit[i]! * lo[i]!;
    }
    if (remW < 0 || remB < 0) return { value: -Infinity, qty };
    for (const i of order) {
      const addable = hi[i]! - qty[i]!;
      if (addable <= 0) continue;
      const byW = Math.floor(remW / weight[i]!);
      const byB = price[i]! > 0 ? Math.floor(remB / price[i]!) : addable;
      const take = Math.min(addable, byW, byB);
      if (take <= 0) continue;
      qty[i]! += take;
      remW -= weight[i]! * take;
      remB -= price[i]! * take;
      value += profit[i]! * take;
    }
    return { value, qty };
  };

  /** Best feasible fill trying both density orderings — a stronger incumbent. */
  const bestGreedy = (lo: Int32Array, hi: Int32Array) => {
    const a = greedyBoth(lo, hi, byWeight);
    const b = greedyBoth(lo, hi, byPrice);
    return b.value > a.value ? b : a;
  };

  // Root box: 0 .. available.
  const rootLo = new Int32Array(n);
  const rootHi = Int32Array.from(avail);

  const seed = bestGreedy(rootLo, rootHi);
  let bestValue = seed.value;
  let bestQty = seed.qty;

  const rootUb = Math.min(
    fill(byWeight, weight, W, rootLo, rootHi).bound,
    fill(byPrice, price, B, rootLo, rootHi).bound,
  );

  const stack: Array<{ lo: Int32Array; hi: Int32Array }> = [
    { lo: rootLo, hi: rootHi },
  ];
  let nodes = 0;
  let aborted = false;

  while (stack.length > 0) {
    if (nodes++ >= MAX_BNB_NODES) {
      aborted = true;
      break;
    }
    const { lo, hi } = stack.pop()!;

    const fw = fill(byWeight, weight, W, lo, hi);
    if (fw.bound === -Infinity) continue;
    const fb = fill(byPrice, price, B, lo, hi);
    if (fb.bound === -Infinity) continue;
    const ub = Math.min(fw.bound, fb.bound);
    if (ub <= bestValue + EPS) continue; // prune

    const cand = bestGreedy(lo, hi);
    if (cand.value > bestValue) {
      bestValue = cand.value;
      bestQty = cand.qty;
    }
    if (ub <= bestValue + EPS) continue;

    // Choose a good to branch on: prefer a fractionally-filled one.
    let bi = fw.fracItem >= 0 ? fw.fracItem : fb.fracItem;
    let t: number;
    if (bi >= 0) {
      const fracVal = fw.fracItem >= 0 ? fw.fracValue : fb.fracValue;
      t = Math.floor(fracVal);
    } else {
      // Both relaxations integral: bisect the widest-domain, densest good.
      bi = -1;
      for (const i of byWeight) {
        if (hi[i]! > lo[i]!) {
          bi = i;
          break;
        }
      }
      if (bi < 0) continue; // fully fixed leaf
      t = (lo[bi]! + hi[bi]!) >> 1;
    }

    // child A: q_bi <= t
    if (t >= lo[bi]!) {
      const hiA = Int32Array.from(hi);
      hiA[bi] = t;
      stack.push({ lo: Int32Array.from(lo), hi: hiA });
    }
    // child B: q_bi >= t + 1
    if (t + 1 <= hi[bi]!) {
      const loB = Int32Array.from(lo);
      loB[bi] = t + 1;
      stack.push({ lo: loB, hi: Int32Array.from(hi) });
    }
  }

  const quantities: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    if (bestQty[i]! > 0) quantities[trades[i]!.name] = bestQty[i]!;
  }
  return makePlan(quantities, trades, capacity, 'exact', !aborted, rootUb);
}

// --------------------------------------------------------------------------- //
// Top-level entry point
// --------------------------------------------------------------------------- //

export interface OptimizeOptions {
  method?: SolveMethod;
}

/**
 * Solve a raw problem. Returns a provably optimal plan by default:
 *   - no budget  -> 1-D bounded-knapsack DP (`solveExact`)
 *   - budget set -> 2-D branch-and-bound (`solveExactBudget`)
 * `method: 'greedy'` forces the fast heuristic in either case.
 */
export function optimize(input: OptimizeInput, opts: OptimizeOptions = {}): Plan {
  const method = opts.method ?? 'auto';
  const trades = buildTrades(input);
  const capacity = Math.floor(input.capacity);
  const budget = input.budget;

  if (trades.length === 0) {
    return makePlan({}, trades, capacity, 'none', true);
  }

  if (method === 'greedy') {
    return solveGreedy(trades, capacity, budget);
  }

  if (budget != null) {
    return solveExactBudget(trades, capacity, budget);
  }

  // method === 'auto' | 'exact', no budget
  const exact = solveExact(trades, capacity);
  if (exact) return exact;
  return solveGreedy(trades, capacity, budget); // oversized fallback
}
