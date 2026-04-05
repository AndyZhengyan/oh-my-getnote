import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./web/vitest.setup.ts'],
    include: ['./web/stores/**/*.test.ts', './web/tools/**/*.test.ts'],
    exclude: [
      '**/e2e/**',
      '**/node_modules/**',
    ],
  },
});
