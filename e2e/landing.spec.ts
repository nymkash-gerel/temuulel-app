import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('renders hero section with branding', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('TEMUULEL').first()).toBeVisible()
    await expect(page.getByText('Цахим худалдааны')).toBeVisible()
    await expect(page.getByText('ухаалаг туслах').first()).toBeVisible()
  })

  test('login link navigates to /login', async ({ page }) => {
    await page.goto('/')

    const loginLink = page.getByRole('link', { name: 'Нэвтрэх' })
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL('/login')
  })

  test('signup link navigates to /signup', async ({ page }) => {
    await page.goto('/')

    const signupLink = page.getByRole('link', { name: 'Бүртгүүлэх' }).first()
    await expect(signupLink).toBeVisible()
    await signupLink.click()
    await expect(page).toHaveURL('/signup')
  })

  test('pricing section shows plans', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Free').first()).toBeVisible()
    await expect(page.getByText('Basic').first()).toBeVisible()
    await expect(page.getByText('Pro').first()).toBeVisible()
  })
})
