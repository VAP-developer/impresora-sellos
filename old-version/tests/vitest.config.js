import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test_*.js', 'test_*.ts', '**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'vue/**'],
    testTimeout: 120000,
  },
});
