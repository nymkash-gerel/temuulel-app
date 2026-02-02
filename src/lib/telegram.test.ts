import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Set env before imports
vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot-token')
vi.stubEnv('TELEGRAM_BOT_USERNAME', 'temuulel_bot')

import {
  sendTelegramMessage,
  sendTelegramInlineKeyboard,
  answerCallbackQuery,
  editMessageText,
  getTelegramBotLink,
} from './telegram'

describe('telegram', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: {} }),
    })
  })

  describe('sendTelegramMessage', () => {
    it('sends a text message to a chat', async () => {
      const result = await sendTelegramMessage('12345', 'Hello!')
      expect(result.ok).toBe(true)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chat_id: '12345',
            text: 'Hello!',
            parse_mode: 'HTML',
          }),
        })
      )
    })
  })

  describe('sendTelegramInlineKeyboard', () => {
    it('sends a message with inline buttons', async () => {
      const buttons = [
        { text: 'Confirm', callback_data: 'confirm_123' },
        { text: 'Reject', callback_data: 'reject_123' },
      ]

      await sendTelegramInlineKeyboard('12345', 'New appointment', buttons)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          body: JSON.stringify({
            chat_id: '12345',
            text: 'New appointment',
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: 'Confirm', callback_data: 'confirm_123' },
                { text: 'Reject', callback_data: 'reject_123' },
              ]],
            },
          }),
        })
      )
    })
  })

  describe('answerCallbackQuery', () => {
    it('answers a callback query', async () => {
      await answerCallbackQuery('query-id', 'Done!')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/answerCallbackQuery',
        expect.objectContaining({
          body: JSON.stringify({
            callback_query_id: 'query-id',
            text: 'Done!',
          }),
        })
      )
    })
  })

  describe('editMessageText', () => {
    it('edits an existing message', async () => {
      await editMessageText('12345', 99, 'Updated text')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/editMessageText',
        expect.objectContaining({
          body: JSON.stringify({
            chat_id: '12345',
            message_id: 99,
            text: 'Updated text',
            parse_mode: 'HTML',
          }),
        })
      )
    })
  })

  describe('getTelegramBotLink', () => {
    it('generates a deep link with staff ID', () => {
      const link = getTelegramBotLink('staff-uuid-123')
      expect(link).toBe('https://t.me/temuulel_bot?start=staff-uuid-123')
    })
  })
})
