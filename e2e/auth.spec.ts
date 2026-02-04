import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('example@email.com').fill(process.env.E2E_TEST_EMAIL!)
    await page.getByPlaceholder('••••••••').fill(process.env.E2E_TEST_PASSWORD!)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/dashboard**', { timeout: 15_000 })
    await expect(page.getByText('Сайн байна уу!')).toBeVisible({ timeout: 10_000 })
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('example@email.com').fill('invalid@test.com')
    await page.getByPlaceholder('••••••••').fill('WrongPassword123!')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Имэйл эсвэл нууц үг буруу байна')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('unauthenticated user is redirected from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login/)
  })

  test('login page has signup link', async ({ page }) => {
    await page.goto('/login')

    const signupLink = page.getByRole('link', { name: 'Бүртгүүлэх' })
    await expect(signupLink).toBeVisible()
  })
})
