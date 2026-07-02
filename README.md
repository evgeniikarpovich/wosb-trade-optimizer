# WoSB Trade Optimizer

Given the prices, weights and stock at a **departure** port, what should you buy
to make the most profit selling at an **arrival** port — without overfilling the
cargo hold?

This repo has two parts:

1. A **solver core** — a small, dependency-free TypeScript module (`src/`) with a
   thorough test suite. It's framework- and DOM-free (plain JSON in, plain JSON
   out) so the same function runs in the browser, a Web Worker, or a future AWS
   Lambda handler.
2. A **web app** — React 19 + Tailwind v4 (`web/`) that drives the solver from a
   Web Worker, with EN/RU languages, light/dark themes, and live charts.

```
optimize(input) -> { quantities, profit, lines, ... }
```

## The problem is a bounded knapsack

For a fixed route each good has a per-unit **profit** (`sell - buy`), a
**weight**, and a limited **available** quantity. Maximize profit under the
cargo-weight limit:

```
maximize    Σ  profit_i · q_i
subject to  Σ  weight_i · q_i  ≤  capacity
            0 ≤ q_i ≤ available_i,   q_i integer
```

This is the **bounded knapsack problem** — NP-hard in general, but with a fast
*pseudo-polynomial* exact algorithm when the capacity is a modest integer, which
is exactly our situation.

### Why exact is trivially affordable here

Real WoSB numbers are small:

| Quantity | Range | Consequence |
| --- | --- | --- |
| Cargo hold | few-thousand … ~200,000 | size of the DP array |
| Goods per port | 3–5 (≤ 20 to be safe) | number of items |
| Weights | integers ≥ 1 | index the DP directly, **no scaling** |
| Prices | mostly ≤ 100 | irrelevant to complexity |

The exact DP costs `O(capacity · Σ log₂(available_i))`. Worst case here is
~200,000 × ~360 ≈ **72M simple integer ops — tens of milliseconds**, and usually
sub-millisecond. That is *smaller than one network round-trip*, which is why the
solver runs **in the browser** and there is **no backend** (see "Architecture").

## Strategy & algorithms

Two solvers, plus a provable bound so the answer is always trustworthy:

1. **Exact — binary-decomposition 0/1 knapsack DP** (`solveExact`).
   A good with `available = 100` is split into power-of-two "chunks"
   (1, 2, 4, 8, …, remainder ≈ 7 items). Those chunks feed a standard 0/1
   knapsack DP over integer weights. `dp[w]` = best profit using weight ≤ `w`;
   iterating capacity **descending** enforces 0/1 semantics. A compact **bitset**
   records each take decision so the chosen quantities can be reconstructed by
   backtracking. This is the default and returns a **provably optimal** plan.

2. **Exact with a budget — 2-D branch & bound** (`solveExactBudget`).
   A money-on-hand limit turns this into a **two-constraint** (weight × money)
   knapsack. A full 2-D DP is infeasible when money is large, but with ≤ 20
   distinct goods **branch-and-bound** solves it exactly and fast:
   - *Bound*: the minimum of two single-resource LP relaxations (fractional fill
     by `profit/weight` and by `profit/price`). Each relaxes one constraint, so
     their minimum is a valid, tighter upper bound.
   - *Branch*: split the domain of the fractionally-filled ("critical") good.
   - *Incumbent*: seeded and refreshed with a both-constraints greedy fill (best
     of the two density orders), giving a strong lower bound for aggressive
     pruning. A node cap guarantees termination, with a greedy fallback + valid
     gap if it's ever hit (it isn't at these sizes).

3. **Greedy — fractional-knapsack ordering** (`solveGreedy`).
   Sort by **profit density** (`profit / weight`) and fill. The LP-optimal
   *ordering* and a fast heuristic; available via `{ method: 'greedy' }` and used
   as the safety fallback.

4. **Upper bound / optimality gap.**
   The fractional (LP-relaxation) optimum is a valid **upper bound** on any
   integer solution. Every `Plan` reports `upperBound` and `gap`; when the exact
   solver runs, `gap == 0` and `optimal == true`. If a plan ever comes from the
   greedy path (budget set, or a hypothetical oversized input), the gap tells you
   exactly how far it *could* be from optimal.

### Optimization practices used
- **Model first, then solve** — reduce raw per-location data to the minimal
  `Trade` list; drop goods that are unbuyable, unsellable, or unprofitable.
- **Exact when tractable, heuristic otherwise** — a hard `MAX_STATES` guard makes
  `solveExact` return `null` (→ greedy fallback) rather than exhaust memory.
- **Always bound the answer** — LP relaxation gives a certificate of quality.
- **Binary decomposition** turns bounded knapsack into 0/1 in `O(log)` items.
- **Typed arrays + bitset** keep the hot loop cache-friendly and memory-light.
- **Validated by brute force** — 300 randomized instances are checked against an
  exhaustive reference in the test suite.

## Architecture

The compute is far smaller than a network hop, so:

- **Solver runs client-side** (TypeScript, optionally in a Web Worker so even the
  worst case never blocks the UI). Deploy the eventual UI as a static site.
- **No Lambda needed for compute.** A backend only becomes useful for *data*
  (accounts, saved routes, crowd-sourced prices) — and even then the solver stays
  in the browser. The core is written JSON-in/JSON-out precisely so it can also be
  wrapped in a Lambda handler later without changes.

## Data model

```jsonc
{
  "capacity": 5000,          // ship cargo hold (total weight)
  "budget": null,            // optional money-on-hand; null = unlimited
  "goods":   { "rum": { "weight": 8 } },
  "locations": {
    "Tortuga": { "rum": { "buy": 12, "available": 300 } },  // departure: buy + stock
    "Nassau":  { "rum": { "sell": 34 } }                    // arrival: sell price
  },
  "departure": "Tortuga",
  "arrival": "Nassau"
}
```

Buy price + availability are read from the **departure** port; sell price from the
**arrival** port. See [`example.json`](./example.json).

## Web app

React 19 + Tailwind v4 (Vite). The solver runs in a **Web Worker** (`optimize`
off the main thread, debounced) so the UI stays smooth and results update live as
you edit prices, weights, stock, capacity, or budget.

Features:
- **Ports & prices** — each port has a **single market price + stock** per good;
  that price is the buy price when the port is the departure and the sell price
  when it's the arrival, so profit is the price gap between ports. Pick
  **departure** / **arrival** (with a swap button). Goods and their (mostly
  static) **weights** live in a collapsed "Goods & weights" section at the
  bottom. The whole workspace is **saved to `localStorage`** and restored on
  reload; defaults come from `web/src/lib/seed.json`.
- **Two languages** — English / Russian, with locale-aware number formatting;
  choice persists in `localStorage`.
- **Light / dark themes** — class-based, no flash on load, remembered.
- **Visualizations** (custom SVG/CSS, no chart dependency, fully themeable):
  - profit-by-good horizontal bars,
  - cargo-hold composition (stacked by weight, with a free-space remainder),
  - hold and budget utilization gauges.
- **Solver badge** — shows whether the plan is `exact`/`greedy` and `optimal`,
  and the gap when it isn't.

```bash
docker compose up web        # dev server  -> http://localhost:5173
docker compose up web-prod   # built + nginx -> http://localhost:8080
```

### Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the app and publishes it on every push to
`main`. One-time setup: **Settings → Pages → Build and deployment → Source =
GitHub Actions**. The workflow sets Vite's `base` to `/<repo>/` for the project
site; for a custom domain, change `VITE_BASE` to `/` in the workflow.

## License compliance

Third-party licenses are scanned automatically. `.github/workflows/license-scan.yml`
runs on every push and PR and **fails if any dependency uses a license outside
the allowlist** (so copyleft licenses like GPL/AGPL/LGPL/SSPL block the build);
it also uploads a full third-party report as a build artifact.

```bash
docker compose run --rm license      # check against the allowlist
docker run --rm ... npm run license:report   # write THIRD-PARTY-LICENSES.json
```

The allowlist lives in `package.json` → `license:check`. The current tree is all
permissive plus weak-copyleft MPL-2.0 (unmodified native build binaries, not
shipped): MIT, ISC, Apache-2.0, BlueOak-1.0.0, BSD-2/3-Clause, MPL-2.0, CC0-1.0,
CC-BY-3.0/4.0. Update the allowlist in that script when policy changes.

## Usage (containerized)

No local Node needed — everything runs in Docker (Node 24 LTS).

```bash
# Build the dev image
docker build --target dev -t wosb-trade-optimizer:dev .

# Solver test suite (default command)
docker run --rm wosb-trade-optimizer:dev

# Or via docker compose
docker compose run --rm test
docker compose run --rm typecheck                # tsc: core + web
docker compose run --rm demo                     # solves example.json
docker compose run --rm demo npm run demo my.json
```

If you *do* have Node locally: `npm install`, then `npm test`, `npm run dev`.

### API

```ts
import { optimize } from './src/index.js';

const plan = optimize(input);          // exact & optimal by default
// plan.quantities -> { rum: 300, cannons: 19, ... }
// plan.profit, plan.cost, plan.revenue, plan.weightUsed
// plan.optimal (true), plan.upperBound, plan.gap
// plan.lines -> sorted per-good breakdown

optimize(input, { method: 'greedy' }); // force the heuristic
optimize({ ...input, budget: 5000 });  // money limit -> exact 2-D branch & bound
```

## Layout

```
src/                     solver core (framework-free)
  types.ts               public JSON data model
  solver.ts              buildTrades, solveExact, solveExactBudget, solveGreedy, optimize
  index.ts               public exports
tests/                   vitest suite (brute-force + randomized property tests)
scripts/demo.ts          CLI: JSON file -> printed shopping list
web/                     React + Tailwind app
  src/App.tsx            state (goods/ports/prices) + actions
  src/i18n.tsx           EN/RU dictionaries + provider
  src/theme.tsx          light/dark provider
  src/lib/model.ts       AppState, toOptimizeInput, per-port price cells
  src/lib/persist.ts     localStorage load/save
  src/lib/solver.worker.ts   runs optimize() off the main thread
  src/lib/useOptimizer.ts    debounced worker hook
  src/components/        Header, InputPanel, ResultsPanel, charts, ui
vite.config.ts           app build (root: web, @core alias -> src)
vitest.config.ts         core test config (repo root, node env)
Dockerfile               dev + web-build + nginx `web` stages
compose.yaml             test / typecheck / demo / web / web-prod shortcuts
```

## Roadmap
- Optional serverless data layer (saved routes, shared prices) — not compute.
- Multi-hop routes (buy/sell across a chain of ports).
```
