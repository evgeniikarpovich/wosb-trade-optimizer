import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts (which sets `root: 'web'` for the app) so
// the solver-core suite runs from the repo root, in a Node environment.
export default defineConfig({
  test: {
    root: '.',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
