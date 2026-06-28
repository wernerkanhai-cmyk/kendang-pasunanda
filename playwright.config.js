import { defineConfig, devices } from '@playwright/test';

// Standaard tegen de live Vercel-site; overschrijf met E2E_BASE_URL (bv. http://localhost:5174).
const BASE_URL = process.env.E2E_BASE_URL || 'https://kendang-pasunanda1.vercel.app';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: [['line']],
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
