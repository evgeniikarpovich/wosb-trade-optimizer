/**
 * Public entry point for the WoSB trade optimizer core.
 *
 * Framework-free and JSON-in/JSON-out: import `optimize` from a React
 * component, a Web Worker, or a future Lambda handler.
 */

export type {
  GoodSpec,
  LocationGood,
  OptimizeInput,
  Trade,
  PlanLine,
  Plan,
  SolveMethod,
} from './types.js';

export {
  optimize,
  buildTrades,
  solveExact,
  solveExactBudget,
  solveGreedy,
  fractionalUpperBound,
  type OptimizeOptions,
} from './solver.js';
