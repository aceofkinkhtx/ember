import { defineConfig } from 'vitest/config';

// Privacy rule tests against the ember-tests Supabase project (fictional data).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false
  }
});
