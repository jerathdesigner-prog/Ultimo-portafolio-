import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: 'output/playwright',
  testMatch: '**/*.e2e.ts',
  use: { baseURL: 'http://localhost:8787', screenshot: 'only-on-failure' },
  workers: 1,
});
