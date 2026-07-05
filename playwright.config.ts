import { defineConfig, devices } from '@playwright/test';

// E2E target: set E2E_BASE_URL to test production (e.g. https://riopoly-billing.vercel.app),
// otherwise defaults to the local dev server (npm run dev on :3000).
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'public',
      testMatch: /public\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'authed',
      testMatch: /authed\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/user.json' },
    },
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/user.json' },
    },
  ],
});
