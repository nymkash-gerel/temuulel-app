import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '..', '.auth', 'user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/login')

  // Fill login form (selectors verified against src/app/(auth)/login/page.tsx)
  await page.getByPlaceholder('example@email.com').fill(process.env.E2E_TEST_EMAIL!)
  await page.getByPlaceholder('••••••••').fill(process.env.E2E_TEST_PASSWORD!)
  await page.locator('button[type="submit"]').click()

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard**', { timeout: 15_000 })
  await expect(page.getByText('Сайн байна уу!')).toBeVisible({ timeout: 10_000 })

  // Save storage state (cookies + localStorage)
  await page.context().storageState({ path: authFile })
})
