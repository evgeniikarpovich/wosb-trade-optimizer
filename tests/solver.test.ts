import { describe, it, expect } from 'vitest';
import {
  optimize,
  solveExact,
  solveExactBudget,
  solveGreedy,
  buildTrades,
  fractionalUpperBound,
} from '../src/index.js';
import type { OptimizeInput, Trade } from '../src/index.js';

// --------------------------------------------------------------------------- //
// A dead-simple, obviously-correct brute force to validate the solvers against.
// Enumerates every quantity combination under weight AND (optional) budget.
// Only for tiny instances.
// --------------------------------------------------------------------------- //

function bruteForce(trades: Trade[], capacity: number, budget = Infinity): number {
  let best = 0;
  const rec = (i: number, weightLeft: number, moneyLeft: number, profit: number) => {
    if (i === trades.length) {
      if (profit > best) best = profit;
      return;
    }
    const t = trades[i]!;
    const maxByMoney =
      t.buyPrice > 0 ? Math.floor(moneyLeft / t.buyPrice) : t.available;
    const maxQty = Math.min(
      t.available,
      Math.floor(weightLeft / t.weight),
      maxByMoney,
    );
    for (let q = 0; q <= maxQty; q++) {
      rec(
        i + 1,
        weightLeft - q * t.weight,
        moneyLeft - q * t.buyPrice,
        profit + q * t.profit,
      );
    }
  };
  rec(0, capacity, budget, 0);
  return best;
}

function trade(
  name: string,
  buy: number,
  sell: number,
  weight: number,
  available: number,
): Trade {
  return {
    name,
    buyPrice: buy,
    sellPrice: sell,
    weight,
    available,
    profit: sell - buy,
    density: (sell - buy) / weight,
  };
}

// --------------------------------------------------------------------------- //

describe('buildTrades', () => {
  const input: OptimizeInput = {
    capacity: 100,
    goods: { rum: { weight: 5 }, sugar: { weight: 2 }, junk: { weight: 1 } },
    locations: {
      Tortuga: {
        rum: { buy: 10, available: 50 },
        sugar: { buy: 4, available: 200 },
        junk: { buy: 9, available: 10 },
      },
      Nassau: {
        rum: { sell: 25 },
        sugar: { sell: 7 },
        junk: { sell: 9 }, // zero profit -> dropped
      },
    },
    departure: 'Tortuga',
    arrival: 'Nassau',
  };

  it('keeps only profitable, buyable, sellable goods', () => {
    const trades = buildTrades(input);
    const names = trades.map((t) => t.name).sort();
    expect(names).toEqual(['rum', 'sugar']); // junk dropped (0 profit)
  });

  it('computes profit and density', () => {
    const rum = buildTrades(input).find((t) => t.name === 'rum')!;
    expect(rum.profit).toBe(15);
    expect(rum.density).toBe(3);
  });

  it('throws on unknown locations', () => {
    expect(() => buildTrades({ ...input, departure: 'Nowhere' })).toThrow();
  });
});

describe('exact vs brute force (correctness)', () => {
  it('matches brute force on a hand-built instance', () => {
    const trades = [
      trade('a', 0, 10, 3, 5), // density 3.33
      trade('b', 0, 6, 2, 5), // density 3.0
      trade('c', 0, 5, 1, 5), // density 5.0  <- best density
    ];
    const capacity = 12;
    const plan = solveExact(trades, capacity)!;
    expect(plan.profit).toBe(bruteForce(trades, capacity));
    expect(plan.optimal).toBe(true);
    // Reported profit must equal the sum implied by the quantities.
    const recomputed = plan.lines.reduce((s, l) => s + l.profit, 0);
    expect(recomputed).toBe(plan.profit);
  });

  it('respects capacity and availability in the returned plan', () => {
    const trades = [trade('a', 0, 10, 4, 3)];
    const plan = solveExact(trades, 10)!; // only 2 fit (weight 4 each)
    expect(plan.quantities['a']).toBe(2);
    expect(plan.weightUsed).toBeLessThanOrEqual(10);
  });

  it('randomized: exact == brute force, and bounds hold', () => {
    let seed = 12345;
    const rnd = (n: number) => {
      // deterministic LCG so failures are reproducible
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    for (let iter = 0; iter < 300; iter++) {
      const n = 1 + rnd(4); // 1..4 goods (brute force must stay tiny)
      const trades: Trade[] = [];
      for (let i = 0; i < n; i++) {
        const buy = rnd(20);
        const sell = buy + 1 + rnd(20); // always positive profit
        const weight = 1 + rnd(6);
        const available = 1 + rnd(6);
        trades.push(trade(`g${i}`, buy, sell, weight, available));
      }
      const capacity = 1 + rnd(40);

      const exact = solveExact(trades, capacity)!;
      const greedy = solveGreedy(trades, capacity);
      const truth = bruteForce(trades, capacity);
      const ub = fractionalUpperBound(trades, capacity);

      expect(exact.profit).toBe(truth); // DP is exact
      expect(exact.profit).toBeGreaterThanOrEqual(greedy.profit); // exact >= greedy
      expect(exact.profit).toBeLessThanOrEqual(ub + 1e-9); // <= LP bound
      expect(greedy.profit).toBeLessThanOrEqual(ub + 1e-9);
      // Feasibility of the exact plan.
      expect(exact.weightUsed).toBeLessThanOrEqual(capacity);
      for (const l of exact.lines) {
        const t = trades.find((x) => x.name === l.name)!;
        expect(l.quantity).toBeLessThanOrEqual(t.available);
      }
    }
  });
});

describe('exact budget (branch & bound) vs brute force', () => {
  it('matches brute force when the budget is the binding constraint', () => {
    // Weight allows 10 units, but money only buys a few; the mix matters.
    const trades = [
      trade('gold', 90, 130, 1, 10), // profit 40, pricey
      trade('iron', 10, 22, 1, 10), // profit 12, cheap
    ];
    const capacity = 10;
    const budget = 100;
    const plan = solveExactBudget(trades, capacity, budget);
    expect(plan.optimal).toBe(true);
    expect(plan.profit).toBe(bruteForce(trades, capacity, budget));
    expect(plan.cost).toBeLessThanOrEqual(budget);
    expect(plan.weightUsed).toBeLessThanOrEqual(capacity);
  });

  it('beats the greedy heuristic when greedy is suboptimal under budget', () => {
    const trades = [
      trade('gold', 90, 130, 1, 10), // highest density, but eats the budget
      trade('iron', 10, 22, 1, 10),
    ];
    const capacity = 100; // weight non-binding
    const budget = 100;
    const exact = solveExactBudget(trades, capacity, budget);
    const greedy = solveGreedy(trades, capacity, budget);
    expect(exact.profit).toBeGreaterThanOrEqual(greedy.profit);
    expect(exact.profit).toBe(bruteForce(trades, capacity, budget));
  });

  it('randomized: exact budget == brute force, always feasible', () => {
    let seed = 987654321;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    for (let iter = 0; iter < 400; iter++) {
      const n = 1 + rnd(4);
      const trades: Trade[] = [];
      for (let i = 0; i < n; i++) {
        const buy = rnd(30);
        const sell = buy + 1 + rnd(25);
        const weight = 1 + rnd(6);
        const available = 1 + rnd(8);
        trades.push(trade(`g${i}`, buy, sell, weight, available));
      }
      const capacity = 1 + rnd(40);
      // Mix of tight and loose budgets so the constraint sometimes binds.
      const maxSpend = trades.reduce((s, t) => s + t.buyPrice * t.available, 0);
      const budget = 1 + rnd(Math.max(2, maxSpend + 5));

      const exact = solveExactBudget(trades, capacity, budget);
      const truth = bruteForce(trades, capacity, budget);
      const greedy = solveGreedy(trades, capacity, budget);

      expect(exact.optimal).toBe(true);
      expect(exact.profit).toBe(truth);
      expect(exact.profit).toBeGreaterThanOrEqual(greedy.profit);
      // Both constraints honored.
      expect(exact.weightUsed).toBeLessThanOrEqual(capacity);
      expect(exact.cost).toBeLessThanOrEqual(budget);
      for (const l of exact.lines) {
        const t = trades.find((x) => x.name === l.name)!;
        expect(l.quantity).toBeLessThanOrEqual(t.available);
      }
    }
  });

  it('stays fast on a game-sized budgeted instance', () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 20; i++) {
      trades.push(trade(`g${i}`, 5 + i, 5 + i + 1 + (i % 5), 1 + (i % 7), 5000));
    }
    const t0 = performance.now();
    const plan = solveExactBudget(trades, 200_000, 500_000);
    const ms = performance.now() - t0;
    expect(plan.optimal).toBe(true);
    expect(plan.cost).toBeLessThanOrEqual(500_000);
    expect(ms).toBeLessThan(2000);
  });
});

describe('greedy', () => {
  it('is optimal when goods are perfectly divisible by capacity', () => {
    // All weight 1 -> greedy by density is exactly optimal.
    const trades = [
      trade('a', 0, 5, 1, 3),
      trade('b', 0, 9, 1, 3),
      trade('c', 0, 1, 1, 100),
    ];
    const capacity = 5;
    expect(solveGreedy(trades, capacity).profit).toBe(
      solveExact(trades, capacity)!.profit,
    );
  });

  it('honors the budget constraint', () => {
    const trades = [trade('a', 10, 30, 1, 100)]; // huge profit but pricey
    // Capacity allows 100 units, but budget only buys 3.
    const plan = solveGreedy(trades, 100, 35);
    expect(plan.quantities['a']).toBe(3); // floor(35/10)
    expect(plan.cost).toBeLessThanOrEqual(35);
  });
});

describe('optimize (top level)', () => {
  const input: OptimizeInput = {
    capacity: 30,
    goods: { rum: { weight: 5 }, sugar: { weight: 2 } },
    locations: {
      A: { rum: { buy: 10, available: 4 }, sugar: { buy: 4, available: 20 } },
      B: { rum: { sell: 25 }, sugar: { sell: 7 } },
    },
    departure: 'A',
    arrival: 'B',
  };

  it('returns an exact optimal plan by default', () => {
    const plan = optimize(input);
    expect(plan.method).toBe('exact');
    expect(plan.optimal).toBe(true);
    expect(plan.gap).toBeCloseTo(0, 6);
    expect(plan.weightUsed).toBeLessThanOrEqual(30);
  });

  it('solves exactly under a budget constraint', () => {
    const plan = optimize({ ...input, budget: 25 });
    expect(plan.method).toBe('exact');
    expect(plan.optimal).toBe(true);
    expect(plan.cost).toBeLessThanOrEqual(25);
  });

  it('forces greedy when asked, even with a budget', () => {
    const plan = optimize({ ...input, budget: 25 }, { method: 'greedy' });
    expect(plan.method).toBe('greedy');
    expect(plan.cost).toBeLessThanOrEqual(25);
  });

  it('handles the empty / no-profit case', () => {
    const plan = optimize({
      ...input,
      locations: {
        A: { rum: { buy: 10, available: 4 } },
        B: { rum: { sell: 5 } }, // loss -> dropped
      },
    });
    expect(plan.method).toBe('none');
    expect(plan.profit).toBe(0);
    expect(plan.lines).toEqual([]);
  });

  it('scales to game-sized bounds quickly', () => {
    const goods: OptimizeInput['goods'] = {};
    const a: Record<string, { buy: number; available: number }> = {};
    const b: Record<string, { sell: number }> = {};
    for (let i = 0; i < 20; i++) {
      goods[`g${i}`] = { weight: 1 + (i % 7) };
      a[`g${i}`] = { buy: 5 + i, available: 5000 };
      b[`g${i}`] = { sell: 5 + i + 1 + (i % 5) };
    }
    const t0 = performance.now();
    const plan = optimize({
      capacity: 200_000,
      goods,
      locations: { A: a, B: b },
      departure: 'A',
      arrival: 'B',
    });
    const ms = performance.now() - t0;
    expect(plan.method).toBe('exact');
    expect(plan.optimal).toBe(true);
    expect(ms).toBeLessThan(2000); // comfortably fast even worst-ish case
  });
});
