import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['./stores/**/*.test.ts', './tools/**/*.test.ts'],
    exclude: [
      '**/e2e/**',
      '**/node_modules/**',
    ],
  },
});
