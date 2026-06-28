import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for correos-webapp E2E tests.
 *
 * The tests run against Docker Compose services:
 * - meteor-app: http://localhost:9090 (Meteor 3.x)
 * - demonio-python: ws://localhost:8000 (WebSocket), http://localhost:8001 (HTTP)
 * - mongo: mongodb://localhost:27017
 */
export default defineConfig({
  testDir: './e2e',

  /* Maximum time a test can run */
  timeout: 60_000,

  /* Maximum time expect() calls can take */
  expect: {
    timeout: 10_000,
  },

  /* Run tests sequentially in CI for stability */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests for CI stability */
  retries: process.env.CI ? 2 : 0,

  /* Reporter */
  reporter: process.env.CI ? 'dot' : 'list',

  /* Shared settings for all projects */
  use: {
    baseURL: 'http://localhost:9090',

    /* Collect trace on first retry */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Browser projects */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
