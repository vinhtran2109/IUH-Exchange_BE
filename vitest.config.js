import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.js', 'frontend/src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['packages/*/src/**/*.js'],
      exclude: ['**/*.test.js', '**/node_modules/**'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
