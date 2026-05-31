import { defineConfig } from '@playwright/test'
import { cfg } from './config'

// Playwright config for the /verify browser checks. The SPA (cfg.appUrl) is the
// default baseURL; the public-site checks navigate to cfg.publicUrl explicitly.
// Screenshots land in verify/evidence/ (written by the specs) so a reviewer can
// replay what was seen.
export default defineConfig({
  testDir: './checks',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: cfg.appUrl,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
})
