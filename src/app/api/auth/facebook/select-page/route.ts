import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const GRAPH_API = 'https://graph.facebook.com/v18.0'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createAdminClient(url, key)
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per 60 seconds
  const rl = await rateLimit(getClientIp(request), { limit: 5, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    console.log('[select-page] User:', user?.id)

    if (!user) {
      console.log('[select-page] Unauthorized - no user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { store_id, page_id, page_name, page_access_token, channel, instagram_account_id } = body

    console.log('[select-page] Request:', { store_id, page_id, page_name, channel, hasToken: !!page_access_token })

    if (!store_id || !page_id || !page_access_token) {
      console.log('[select-page] Missing fields:', { store_id: !!store_id, page_id: !!page_id, hasToken: !!page_access_token })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const isInstagram = channel === 'instagram'
    if (isInstagram && !instagram_account_id) {
      console.log('[select-page] Missing instagram_account_id for Instagram channel')
      return NextResponse.json({ error: 'Missing instagram_account_id' }, { status: 400 })
    }

    // Verify user owns this store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', store_id)
      .eq('owner_id', user.id)
      .single()

    console.log('[select-page] Store lookup:', { found: !!store, error: storeError?.message })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Subscribe page to webhook messaging events (including feed for comment auto-reply)
    try {
      const res = await fetch(
        `${GRAPH_API}/${page_id}/subscribed_apps`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: page_access_token,
            subscribed_fields: 'messages,messaging_postbacks,messaging_optins,feed',
          }),
        }
      )
      if (!res.ok) {
        console.error('Failed to subscribe page:', await res.text())
      }
    } catch (err) {
      console.error('Page subscription error:', err)
    }

    // Use admin client to bypass RLS
    const adminSupabase = getAdminSupabase()

    try {
      if (isInstagram) {
        console.log('[select-page] Updating Instagram connection')
        const { error: updateError } = await adminSupabase
          .from('stores')
          .update({
            instagram_business_account_id: instagram_account_id,
            instagram_page_name: page_name || null,
            instagram_connected_at: new Date().toISOString(),
            facebook_page_id: page_id,
            facebook_page_access_token: page_access_token,
          })
          .eq('id', store_id)

        if (updateError) throw updateError
      } else {
        console.log('[select-page] Updating Facebook connection')
        const { error: updateError } = await adminSupabase
          .from('stores')
          .update({
            facebook_page_id: page_id,
            facebook_page_access_token: page_access_token,
            facebook_page_name: page_name || null,
            facebook_connected_at: new Date().toISOString(),
          })
          .eq('id', store_id)

        if (updateError) throw updateError
      }
    } catch (dbError) {
      console.error('[select-page] Database error:', dbError)
      return NextResponse.json({
        error: `Failed to save: ${dbError instanceof Error ? dbError.message : 'Unknown DB error'}`,
      }, { status: 500 })
    }

    console.log('[select-page] Success!')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[select-page] Unhandled error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
