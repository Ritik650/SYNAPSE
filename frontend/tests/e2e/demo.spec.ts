/**
 * Synapse Demo E2E — validates the 5-minute judge walkthrough.
 * Requires: backend running on :8000, frontend dev server on :5173.
 * Run: npx playwright test (or npm run test:e2e)
 */
import { test, expect } from '@playwright/test'

const DEMO_EMAIL = 'e2e@synapse.test'
const DEMO_PASS = 'synapse2025'

test.describe('Synapse demo flow', () => {

  // ── 1. Auth ───────────────────────────────────────────────────────────────

  test('redirects to /auth when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('can register and log in', async ({ page }) => {
    await page.goto('/auth')
    // Switch to register if needed
    const registerBtn = page.getByRole('button', { name: /sign up|register/i })
    if (await registerBtn.isVisible()) await registerBtn.click()

    await page.getByPlaceholder(/name/i).fill('E2E User')
    await page.getByPlaceholder(/email/i).fill(DEMO_EMAIL)
    await page.getByPlaceholder(/password/i).fill(DEMO_PASS)
    await page.getByRole('button', { name: /create|register|sign up/i }).click()

    await expect(page).toHaveURL('/', { timeout: 10_000 })
    await expect(page.locator('.card, [class*="card"]').first()).toBeVisible()
  })

  // ── 2. Dashboard ─────────────────────────────────────────────────────────

  test('dashboard loads with health score', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/health score|synapse/i).first()).toBeVisible({ timeout: 8_000 })
  })

  // ── 3. Seed demo data ────────────────────────────────────────────────────

  test('settings page can reset demo data', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText(/demo controls/i)).toBeVisible()
    const resetBtn = page.getByRole('button', { name: /reset to demo state/i })
    await expect(resetBtn).toBeVisible()
  })

  // ── 4. Time Machine ───────────────────────────────────────────────────────

  test('timeline page renders charts', async ({ page }) => {
    await page.goto('/timeline')
    await expect(page.getByText(/time machine/i)).toBeVisible()
    // Chart container should appear
    await expect(page.locator('.recharts-responsive-container, svg').first()).toBeVisible({ timeout: 8_000 })
  })

  // ── 5. Patterns ───────────────────────────────────────────────────────────

  test('patterns page loads', async ({ page }) => {
    await page.goto('/patterns')
    await expect(page.getByText(/patterns/i).first()).toBeVisible()
  })

  // ── 6. Whispers ───────────────────────────────────────────────────────────

  test('whispers page loads', async ({ page }) => {
    await page.goto('/whispers')
    await expect(page.getByText(/whispers/i).first()).toBeVisible()
  })

  // ── 7. Body Twin ─────────────────────────────────────────────────────────

  test('body twin page loads with score rings', async ({ page }) => {
    await page.goto('/body')
    await expect(page.getByText(/body twin/i)).toBeVisible()
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 8_000 })
  })

  // ── 8. Records pages ─────────────────────────────────────────────────────

  test('sleep lab renders', async ({ page }) => {
    await page.goto('/sleep')
    await expect(page.getByText(/sleep lab/i)).toBeVisible()
  })

  test('symptoms page shows log form', async ({ page }) => {
    await page.goto('/symptoms')
    await expect(page.getByText(/log symptom/i)).toBeVisible()
  })

  test('medications page shows add button', async ({ page }) => {
    await page.goto('/medications')
    await expect(page.getByRole('button', { name: /add medication/i })).toBeVisible()
  })

  test('labs page renders', async ({ page }) => {
    await page.goto('/labs')
    await expect(page.getByText(/labs/i).first()).toBeVisible()
  })

  // ── 9. Doctor Mode ────────────────────────────────────────────────────────

  test('doctor mode has report form', async ({ page }) => {
    await page.goto('/doctor')
    await expect(page.getByText(/doctor mode/i)).toBeVisible()
    await expect(page.getByText(/visit details/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /generate doctor brief/i })).toBeVisible()
  })

  // ── 10. Simulator ────────────────────────────────────────────────────────

  test('simulator shows sliders', async ({ page }) => {
    await page.goto('/simulate')
    await expect(page.getByText(/what-if simulator/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /run simulation/i })).toBeVisible()
  })

  // ── 11. Care Circle ───────────────────────────────────────────────────────

  test('care circle invite flow', async ({ page }) => {
    await page.goto('/care-circle')
    await expect(page.getByText(/care circle/i).first()).toBeVisible()
    await page.getByRole('button', { name: /invite someone/i }).click()
    await expect(page.getByPlaceholder(/name/i)).toBeVisible()
  })

  // ── 12. Settings ─────────────────────────────────────────────────────────

  test('settings page loads with profile', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText(/profile/i)).toBeVisible()
    await expect(page.getByText(/privacy/i)).toBeVisible()
    await expect(page.getByText(/demo controls/i)).toBeVisible()
  })

  // ── 13. Navigation completeness ───────────────────────────────────────────

  test('all sidebar links are navigable', async ({ page }) => {
    await page.goto('/')
    const routes = [
      '/timeline', '/patterns', '/whispers', '/body',
      '/sleep', '/recovery', '/mind', '/meals',
      '/symptoms', '/labs', '/medications',
      '/simulate', '/doctor', '/care-circle', '/settings',
    ]
    for (const route of routes) {
      await page.goto(route)
      await expect(page).toHaveURL(route, { timeout: 5_000 })
      // No crash — page should not show an error boundary
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    }
  })
})
