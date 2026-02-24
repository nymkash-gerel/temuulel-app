/**
 * GET /api/telegram/driver/photo?file_id=<id>
 *
 * Proxies a Telegram photo download using the driver bot token.
 * Returns a redirect to the Telegram CDN URL — valid for a short time.
 *
 * Usage (dashboard):
 *   <img src="/api/telegram/driver/photo?file_id=AgACAgI..." />
 *   or window.open('/api/telegram/driver/photo?file_id=...')
 */

import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.DRIVER_TELEGRAM_BOT_TOKEN

export async function GET(req: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
  }

  const fileId = req.nextUrl.searchParams.get('file_id')
  if (!fileId) {
    return NextResponse.json({ error: 'Missing file_id' }, { status: 400 })
  }

  try {
    // Step 1: resolve file_id → file path
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
    )
    const getFileData = await getFileRes.json() as {
      ok: boolean
      result?: { file_path: string }
      description?: string
    }

    if (!getFileData.ok || !getFileData.result?.file_path) {
      return NextResponse.json(
        { error: getFileData.description ?? 'File not found' },
        { status: 404 }
      )
    }

    // Step 2: redirect to Telegram CDN
    const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${getFileData.result.file_path}`
    return NextResponse.redirect(photoUrl)

  } catch (err) {
    console.error('[DriverPhoto] fetch failed:', err)
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 500 })
  }
}
