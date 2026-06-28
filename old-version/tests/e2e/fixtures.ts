import { test as base, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Custom Playwright fixtures that manage Docker Compose lifecycle.
 *
 * Before all tests: starts Docker Compose services (meteor-app, demonio-python, mongo)
 * After all tests: tears down Docker Compose services
 *
 * The fixture uses `docker compose up -d --wait` which relies on the healthchecks
 * defined in docker-compose.yml to determine when services are ready.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root of the project (where docker-compose.yml lives) */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** Maximum time to wait for Docker services to become healthy (ms) */
const DOCKER_STARTUP_TIMEOUT = 120_000;

/**
 * Execute a command in the project root directory.
 * Throws on non-zero exit code.
 */
function execInProject(command: string, timeoutMs = DOCKER_STARTUP_TIMEOUT): string {
  return execSync(command, {
    cwd: PROJECT_ROOT,
    timeout: timeoutMs,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Check if Docker Compose services are already running and healthy.
 */
function areServicesHealthy(): boolean {
  try {
    const output = execInProject('docker compose ps --format json', 30_000);
    if (!output.trim()) return false;

    // docker compose ps --format json outputs one JSON object per line
    const lines = output.trim().split('\n');
    const services = lines.map(line => JSON.parse(line));

    // We need at least the 3 core services running
    const requiredServices = ['meteor-app', 'demonio-python', 'mongo'];
    for (const name of requiredServices) {
      const svc = services.find((s: { Name?: string; Service?: string }) =>
        s.Name?.includes(name) || s.Service === name
      );
      if (!svc || svc.State !== 'running') return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Start Docker Compose services and wait for healthchecks to pass.
 */
function startServices(): void {
  console.log('[fixtures] Starting Docker Compose services...');
  execInProject('docker compose up -d --wait');
  console.log('[fixtures] All services are healthy and ready.');
}

/**
 * Stop and remove Docker Compose services.
 */
function stopServices(): void {
  console.log('[fixtures] Stopping Docker Compose services...');
  execInProject('docker compose down', 60_000);
  console.log('[fixtures] Services stopped.');
}

// ─────────────────────────────────────────────
// Extended test fixtures
// ─────────────────────────────────────────────

export type DockerFixtures = {
  /** Ensures Docker services are running before the test */
  dockerServices: void;
};

/**
 * Extended `test` object with Docker Compose fixture.
 *
 * Usage:
 *   import { test, expect } from './fixtures';
 *
 *   test('my e2e test', async ({ page, dockerServices }) => {
 *     await page.goto('/');
 *     // ...
 *   });
 */
export const test = base.extend<DockerFixtures>({
  // eslint-disable-next-line no-empty-pattern
  dockerServices: [async ({}, use) => {
    // Setup: ensure Docker services are running
    if (!areServicesHealthy()) {
      startServices();
    }

    // Provide the fixture to the test
    await use();

    // Teardown: stop services after all tests complete
    // Note: We don't stop here by default to allow running multiple test files
    // without restart overhead. Use `docker compose down` manually or in CI cleanup.
  }, { scope: 'worker' }],
});

export { expect };
