import { defineConfig, devices } from '@playwright/test';

const baseURL: string = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

export const config = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
  },
  // Reuse a running `ng serve`; start one only when nothing is listening.
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command: 'bun run start',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

export default config;
