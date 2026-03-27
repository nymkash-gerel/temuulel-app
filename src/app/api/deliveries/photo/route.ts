import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/deliveries/photo?file_id=xxx&bot=driver
 *
 * Proxies a Telegram photo by file_id. Used when Supabase Storage upload
 * failed but we still have the Telegram file_id.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const fileId = searchParams.get('file_id')
  const bot = searchParams.get('bot') || 'driver'

  if (!fileId) {
    return NextResponse.json({ error: 'file_id required' }, { status: 400 })
  }

  // Auth check — must be logged in
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  // Verify user is authenticated via cookie
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_KEY
  if (!anonKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const cookieHeader = request.headers.get('cookie') || ''
  // Extract access token from Supabase auth cookie
  const tokenMatch = cookieHeader.match(/sb-[^-]+-auth-token[^=]*=([^;]+)/)
  if (!tokenMatch) {
    // Try getting from authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const botToken = bot === 'store'
    ? process.env.TELEGRAM_BOT_TOKEN
    : process.env.DRIVER_TELEGRAM_BOT_TOKEN

  if (!botToken) {
    return NextResponse.json({ error: `${bot} bot token not configured` }, { status: 500 })
  }

  try {
    // Get file path from Telegram
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
    )
    const getFileData = await getFileRes.json() as { ok: boolean; result?: { file_path: string } }

    if (!getFileData.ok || !getFileData.result?.file_path) {
      return NextResponse.json({ error: 'File not found on Telegram' }, { status: 404 })
    }

    // Download the photo
    const photoUrl = `https://api.telegram.org/file/bot${botToken}/${getFileData.result.file_path}`
    const photoRes = await fetch(photoUrl)

    if (!photoRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 502 })
    }

    const contentType = photoRes.headers.get('content-type') || 'image/jpeg'
    const photoBuffer = await photoRes.arrayBuffer()

    // Also try to upload to Supabase Storage for future requests
    const supabase = createClient(url, key)
    const ext = getFileData.result.file_path.split('.').pop() || 'jpg'
    const storagePath = `telegram-proxy/${fileId.slice(0, 20)}_${Date.now()}.${ext}`
    supabase.storage
      .from('delivery-proofs')
      .upload(storagePath, Buffer.from(photoBuffer), { contentType, upsert: true })
      .then(({ error: uploadErr, data: uploadData }) => {
        if (!uploadErr && uploadData) {
          console.log('[PhotoProxy] Cached to storage:', storagePath)
        } else if (uploadErr) {
          console.error('[PhotoProxy] Cache upload failed:', uploadErr.message)
        }
      })
      .catch(err => console.error("[silent-catch]", err))

    return new NextResponse(photoBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[PhotoProxy] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
