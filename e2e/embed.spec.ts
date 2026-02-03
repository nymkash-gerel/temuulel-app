import { test, expect } from '@playwright/test'

test.describe('Embed Widget', () => {
  test('embed page loads for valid store', async ({ page }) => {
    const storeId = process.env.E2E_TEST_STORE_ID
    if (!storeId) {
      test.skip()
      return
    }

    await page.goto(`/embed/${storeId}`)

    // Verify the page loaded without a Next.js not-found error
    await expect(page.locator('body')).not.toContainText('This page could not be found')
  })

  test('embed page returns not-found for invalid store', async ({ page }) => {
    await page.goto('/embed/nonexistent-store-id-00000')

    // The embed page calls notFound() for invalid store IDs
    await expect(page.getByText('This page could not be found')).toBeVisible({
      timeout: 10_000,
    })
  })
})
