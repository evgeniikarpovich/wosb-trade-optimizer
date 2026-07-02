import type { AppState } from './model';

// Bump when the default seed / schema changes so stale saves don't mask it.
const KEY = 'wosb-state-v4';

/** Load persisted app state, or null if absent / malformed. */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AppState>;
    if (
      !p ||
      !Array.isArray(p.goods) ||
      !Array.isArray(p.locations) ||
      typeof p.prices !== 'object' ||
      p.prices === null
    ) {
      return null;
    }
    return p as AppState;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
}
