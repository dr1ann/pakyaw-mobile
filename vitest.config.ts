import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pakyaw/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'packages/shared/src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks',
  },
});
