import { test, expect } from '@playwright/test'

// These tests use the storageState from auth.setup.ts
// so the user is already logged in.

test.describe('Dashboard', () => {
  test('dashboard loads with welcome message', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByText('Сайн байна уу!')).toBeVisible({ timeout: 10_000 })
  })

  test('sidebar navigation is visible', async ({ page }) => {
    await page.goto('/dashboard')

    const sidebar = page.getByRole('navigation', { name: 'Үндсэн цэс' })
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText('Тойм')).toBeVisible()
  })

  test('header shows sign-out button', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('button', { name: 'Гарах' })).toBeVisible()
  })

  test('navigating to products page works', async ({ page }) => {
    await page.goto('/dashboard')

    const sidebar = page.getByRole('navigation', { name: 'Үндсэн цэс' })
    await sidebar.getByText('Бүтээгдэхүүн').click()

    await expect(page).toHaveURL(/\/dashboard\/products/)
  })

  test('navigating to orders page works', async ({ page }) => {
    await page.goto('/dashboard')

    const sidebar = page.getByRole('navigation', { name: 'Үндсэн цэс' })
    await sidebar.getByText('Захиалга').click()

    await expect(page).toHaveURL(/\/dashboard\/orders/)
  })
})
