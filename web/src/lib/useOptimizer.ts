import { useEffect, useRef, useState } from 'react';
import type { OptimizeInput, Plan } from '@core';
import type { SolveRequest, SolveResponse } from './solver.worker';

interface OptimizerState {
  plan: Plan | null;
  error: string | null;
  computing: boolean;
}

/**
 * Debounced solve in a Web Worker. Re-solves whenever `input` changes; stale
 * responses (an older request id) are ignored so only the latest wins.
 */
export function useOptimizer(input: OptimizeInput, debounceMs = 120): OptimizerState {
  const [state, setState] = useState<OptimizerState>({
    plan: null,
    error: null,
    computing: true,
  });

  const workerRef = useRef<Worker | null>(null);
  const latestId = useRef(0);

  // Create the worker once.
  useEffect(() => {
    const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<SolveResponse>) => {
      const msg = e.data;
      if (msg.id !== latestId.current) return; // stale
      if (msg.ok) {
        setState({ plan: msg.plan, error: null, computing: false });
      } else {
        setState({ plan: null, error: msg.error, computing: false });
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Debounced re-solve on input change.
  useEffect(() => {
    setState((s) => ({ ...s, computing: true }));
    const handle = setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) return;
      const id = ++latestId.current;
      const req: SolveRequest = { id, input };
      worker.postMessage(req);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [input, debounceMs]);

  return state;
}
