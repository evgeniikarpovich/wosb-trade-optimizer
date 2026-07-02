/**
 * Runs the (pure, framework-free) solver off the main thread. The compute is
 * only tens of milliseconds even in the worst case, but a worker guarantees the
 * UI never janks and keeps the door open for much larger inputs.
 */
import { optimize } from '@core';
import type { OptimizeInput, Plan } from '@core';

export interface SolveRequest {
  id: number;
  input: OptimizeInput;
}

export type SolveResponse =
  | { id: number; ok: true; plan: Plan }
  | { id: number; ok: false; error: string };

// Minimal worker-scope view — avoids pulling the `webworker` lib into a DOM
// tsconfig (which would clash on shared globals like `self`).
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<SolveRequest>) => void) | null;
  postMessage: (msg: SolveResponse) => void;
};

ctx.onmessage = (e) => {
  const { id, input } = e.data;
  try {
    ctx.postMessage({ id, ok: true, plan: optimize(input) });
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
