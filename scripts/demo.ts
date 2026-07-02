/**
 * CLI demo: read a problem JSON and print the optimal shopping list.
 *
 *   npm run demo            # uses example.json
 *   npm run demo path.json  # uses your own file
 *
 * This is a thin wrapper over the pure `optimize` core — the same function a
 * React component or Lambda handler would call.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { optimize } from '../src/index.js';
import type { OptimizeInput } from '../src/index.js';

const file = resolve(process.argv[2] ?? 'example.json');
const input = JSON.parse(readFileSync(file, 'utf8')) as OptimizeInput;

const t0 = performance.now();
const plan = optimize(input);
const ms = performance.now() - t0;

const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

console.log(`\nRoute: ${input.departure} -> ${input.arrival}`);
console.log(`Cargo hold: ${money(input.capacity)}  |  solver: ${plan.method}` +
  `${plan.optimal ? ' (optimal)' : ''}  |  ${ms.toFixed(1)} ms\n`);

if (plan.lines.length === 0) {
  console.log('No profitable trade on this route.\n');
  process.exit(0);
}

const rows = plan.lines.map((l) => ({
  good: l.name,
  qty: l.quantity,
  'unit profit': l.unitProfit,
  weight: l.weight,
  cost: money(l.cost),
  profit: money(l.profit),
}));
console.table(rows);

console.log(
  `\nTotal:  spend ${money(plan.cost)}  ->  earn ${money(plan.revenue)}  ` +
    `=  profit ${money(plan.profit)}`,
);
console.log(
  `Hold used: ${money(plan.weightUsed)} / ${money(plan.capacity)} ` +
    `(${((100 * plan.weightUsed) / plan.capacity).toFixed(1)}%)`,
);
if (!plan.optimal) {
  console.log(
    `Upper bound: ${money(plan.upperBound)}  (gap to proven optimum: ` +
      `${money(plan.gap)})`,
  );
}
console.log();
