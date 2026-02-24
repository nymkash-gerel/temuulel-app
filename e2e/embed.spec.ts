import { test, expect, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_STORE_ID = process.env.E2E_TEST_STORE_ID || '12dc33c9-36c9-45cd-bd90-3f498bd739ed'
const WIDGET_URL = `/embed/${TEST_STORE_ID}`

/** Mock all three chat API endpoints with sensible defaults. */
async function mockChatAPIs(
  page: Page,
  opts: {
    /** Messages to return from GET /api/chat (simulates saved history) */
    savedMessages?: Array<{ role: 'user' | 'assistant'; content: string; is_ai_response?: boolean }>
    /** Responses returned by POST /api/chat/widget in order */
    botReplies?: string[]
  } = {}
) {
  const { savedMessages = [], botReplies = ['Сайн байна уу! Танд юугаар туслах вэ?'] } = opts
  const replyQueue = [...botReplies]

  // GET /api/chat — session lookup (conversation_id + message history)
  await page.route('**/api/chat*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversation_id: 'e2e-conv-001',
          messages: savedMessages.map((m, i) => ({
            ...m,
            created_at: new Date(Date.now() - (savedMessages.length - i) * 60_000).toISOString(),
            is_ai_response: m.is_ai_response ?? m.role === 'assistant',
          })),
        }),
      })
    } else {
      // POST /api/chat — save customer message
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversation_id: 'e2e-conv-001' }),
      })
    }
  })

  // POST /api/chat/widget — AI response
  await page.route('**/api/chat/widget', async (route) => {
    const reply = replyQueue.shift() ?? 'Сайн байна уу! Танд юугаар туслах вэ?'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: reply }),
    })
  })
}

/** Open the widget by clicking the chat bubble. */
async function openWidget(page: Page) {
  await page.getByRole('button', { name: 'Чат нээх' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

// ---------------------------------------------------------------------------
// Suite 1: Page loading
// ---------------------------------------------------------------------------

test.describe('Embed page loading', () => {
  test('loads for valid store', async ({ page }) => {
    await page.goto(WIDGET_URL)
    await expect(page.locator('body')).not.toContainText('Хуудас олдсонгүй')
    // Chat bubble should be present
    await expect(page.getByRole('button', { name: 'Чат нээх' })).toBeVisible()
  })

  test('returns not-found for invalid store', async ({ page }) => {
    await page.goto('/embed/00000000-0000-0000-0000-000000000000')
    await expect(
      page.getByRole('heading', { name: 'Хуудас олдсонгүй' })
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Suite 2: Fresh widget — no stale history shown
// ---------------------------------------------------------------------------

test.describe('Fresh widget open', () => {
  test('shows empty state when no prior messages', async ({ page }) => {
    await mockChatAPIs(page, { savedMessages: [] })
    await page.goto(WIDGET_URL)
    await openWidget(page)

    // Empty state greeting should be visible
    await expect(page.getByText('Сайн байна уу!')).toBeVisible()
    // No message bubbles yet
    const bubbles = page.locator('[aria-label="Мессежүүд"] .rounded-2xl')
    await expect(bubbles).toHaveCount(0)
  })

  test('does NOT show old messages when history exists in DB', async ({ page }) => {
    // This is the bug we fixed: widget used to load & display history on open.
    // Even if the server has old messages (incl. an order flow), the widget
    // should start visually clean.
    await mockChatAPIs(page, {
      savedMessages: [
        { role: 'user', content: 'Зурагтын тавиур авмаар байна' },
        {
          role: 'assistant',
          content:
            '📦 Гэрийн чимэглэл (Зурагтын тавиур) (Том/Хар) — 55,000₮\nЗахиалга үүсгэхийн тулд дараах мэдээлэл хэрэгтэй:\n• утасны дугаар (8 оронтой)\nБичнэ үү:',
          is_ai_response: true,
        },
      ],
    })

    await page.goto(WIDGET_URL)
    await openWidget(page)

    // Must NOT show the old order-flow message
    await expect(page.getByText('утасны дугаар')).not.toBeVisible()
    await expect(page.getByText('Зурагтын тавиур')).not.toBeVisible()
  })

  test('greeting response does not start with the store name', async ({ page }) => {
    // The store name is already shown in the widget header — the AI should not
    // open with "Кето Монгол-д тавтай морил!" which causes a visual double-name.
    await mockChatAPIs(page, {
      savedMessages: [],
      botReplies: ['Сайн байна уу! Танд юугаар туслах вэ?'],
    })

    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.getByPlaceholder('Мессеж бичих...').fill('hi')
    await page.getByRole('button', { name: 'Илгээх' }).click()

    const botReply = page.getByText('Сайн байна уу! Танд юугаар туслах вэ?')
    await expect(botReply).toBeVisible({ timeout: 5_000 })

    // The message bubble text should NOT start with the store name
    // (store name already appears in the widget header above)
    const replyText = await botReply.textContent() ?? ''
    const headerText = await page.getByRole('dialog').locator('p.font-medium').first().textContent() ?? ''
    expect(replyText.trimStart()).not.toMatch(new RegExp(`^${headerText.trim()}`))
  })
})

// ---------------------------------------------------------------------------
// Suite 3: Sending messages
// ---------------------------------------------------------------------------

test.describe('Chat interaction', () => {
  test('greeting "hi" → bot replies with greeting, no product card', async ({ page }) => {
    await mockChatAPIs(page, {
      botReplies: ['Сайн байна уу! Танд юугаар туслах вэ?'],
    })

    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.getByPlaceholder('Мессеж бичих...').fill('hi')
    await page.getByRole('button', { name: 'Илгээх' }).click()

    // Customer message shown
    await expect(page.getByText('hi')).toBeVisible()

    // Bot replies with greeting
    await expect(
      page.getByText('Сайн байна уу! Танд юугаар туслах вэ?')
    ).toBeVisible({ timeout: 5_000 })

    // NO phone number request in the greeting
    await expect(page.getByText('утасны дугаар')).not.toBeVisible()
    await expect(page.getByText('Захиалга үүсгэхийн тулд')).not.toBeVisible()
  })

  test('product order flow response is shown correctly', async ({ page }) => {
    await mockChatAPIs(page, {
      botReplies: [
        '📦 Зурагтын тавиур (Том/Хар) — 55,000₮\nЗахиалга үүсгэхийн тулд дараах мэдээлэл хэрэгтэй:\n• утасны дугаар (8 оронтой)\nБичнэ үү:',
      ],
    })

    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.getByPlaceholder('Мессеж бичих...').fill('1')
    await page.getByRole('button', { name: 'Илгээх' }).click()

    await expect(page.getByText('утасны дугаар')).toBeVisible({ timeout: 5_000 })
  })

  test('Enter key sends message', async ({ page }) => {
    await mockChatAPIs(page)

    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.getByPlaceholder('Мессеж бичих...').fill('сайн уу')
    await page.keyboard.press('Enter')

    await expect(page.getByText('сайн уу')).toBeVisible()
    await expect(
      page.getByText('Сайн байна уу! Танд юугаар туслах вэ?')
    ).toBeVisible({ timeout: 5_000 })
  })

  test('send button disabled while request is in flight', async ({ page }) => {
    // Slow down the widget API to catch the in-flight state
    await page.route('**/api/chat*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, body: JSON.stringify({ conversation_id: 'e2e-conv-001', messages: [] }) })
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ conversation_id: 'e2e-conv-001' }) })
      }
    })
    await page.route('**/api/chat/widget', async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      await route.fulfill({ status: 200, body: JSON.stringify({ response: 'Сайн!' }) })
    })

    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.getByPlaceholder('Мессеж бичих...').fill('hi')
    await page.getByRole('button', { name: 'Илгээх' }).click()

    // During in-flight: send button should be disabled + loading indicator visible
    await expect(page.getByRole('button', { name: 'Илгээх' })).toBeDisabled()
    await expect(page.getByRole('status')).toBeVisible() // loading dots

    // After response: loading indicator gone
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 5_000 })
  })

  test('API error shows user-visible error message', async ({ page }) => {
    await page.route('**/api/chat*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, body: JSON.stringify({ conversation_id: null, messages: [] }) })
      } else {
        await route.fulfill({ status: 500 })
      }
    })
    await page.route('**/api/chat/widget', async (route) => {
      await route.fulfill({ status: 500 })
    })

    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.getByPlaceholder('Мессеж бичих...').fill('hi')
    await page.getByRole('button', { name: 'Илгээх' }).click()

    await expect(page.getByText('Уучлаарай, алдаа гарлаа')).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Suite 4: Widget open/close lifecycle
// ---------------------------------------------------------------------------

test.describe('Widget lifecycle', () => {
  test('widget opens and closes', async ({ page }) => {
    await mockChatAPIs(page)
    await page.goto(WIDGET_URL)

    await openWidget(page)
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: 'Чат хаах' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('ESC key closes the widget', async ({ page }) => {
    await mockChatAPIs(page)
    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('in-session close/reopen preserves current conversation', async ({ page }) => {
    // Within the same page session, close → reopen should keep messages visible.
    // (The bug we fixed was about loading PREVIOUS sessions from DB, not in-memory state.)
    await mockChatAPIs(page, {
      savedMessages: [],
      botReplies: ['Сайн байна уу! Танд юугаар туслах вэ?'],
    })

    await page.goto(WIDGET_URL)
    await openWidget(page)

    await page.getByPlaceholder('Мессеж бичих...').fill('hi')
    await page.getByRole('button', { name: 'Илгээх' }).click()
    await expect(page.getByText('Сайн байна уу! Танд юугаар туслах вэ?')).toBeVisible({ timeout: 5_000 })

    // Close and reopen
    await page.getByRole('button', { name: 'Чат хаах' }).click()
    await openWidget(page)

    // Current session messages should still be there
    await expect(page.getByText('Сайн байна уу! Танд юугаар туслах вэ?')).toBeVisible()
  })

  test('fresh page load does NOT show previous session DB history', async ({ page }) => {
    // This is the exact bug that was reported: widget used to load old messages
    // (incl. stale order flow) from the database on every open, even across sessions.
    await mockChatAPIs(page, {
      savedMessages: [
        { role: 'user', content: 'Зурагтын тавиур авмаар байна' },
        {
          role: 'assistant',
          content: '📦 Зурагтын тавиур — 55,000₮\nЗахиалга үүсгэхийн тулд:\n• утасны дугаар\nБичнэ үү:',
          is_ai_response: true,
        },
      ],
    })

    // Navigate fresh (simulates returning visitor with DB history)
    await page.goto(WIDGET_URL)
    await openWidget(page)

    // DB history must NOT be displayed
    await expect(page.getByText('утасны дугаар')).not.toBeVisible()
    await expect(page.getByText('Зурагтын тавиур авмаар байна')).not.toBeVisible()
  })
})
