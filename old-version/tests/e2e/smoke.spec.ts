import { test, expect } from './fixtures';

/**
 * Smoke test to validate the Playwright E2E setup works correctly.
 *
 * This test verifies that:
 * 1. Docker services can be started via the fixture
 * 2. The meteor-app is reachable at http://localhost:9090
 * 3. The page loads and contains some content
 *
 * Prerequisites: Docker must be available and docker-compose.yml must be valid.
 */

test.describe('E2E Smoke Test', () => {
  test('the app loads successfully at baseURL', async ({ page, dockerServices }) => {
    // Navigate to the application root
    const response = await page.goto('/');

    // Verify the page loaded (HTTP 200)
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    // Verify the page has some content (not blank)
    const body = await page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});
