import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const storeId = request.nextUrl.searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'Missing store_id' }, { status: 400 })
  }

  // Verify user owns this store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!appId || !appUrl) {
    return NextResponse.json(
      { error: 'Facebook App ID not configured' },
      { status: 500 }
    )
  }

  const redirectUri = `${appUrl}/api/auth/facebook/callback`

  // Channel: 'messenger' (default) or 'instagram'
  const channel = request.nextUrl.searchParams.get('channel') || 'messenger'

  // Encode store_id + channel + nonce in state for CSRF protection
  const state = Buffer.from(
    JSON.stringify({ store_id: storeId, channel, nonce: crypto.randomUUID() })
  ).toString('base64url')

  // Instagram DMs require additional scope
  // pages_show_list is required to list ALL pages the user manages
  // business_management is required to list pages from Business Manager
  const scopes = [
    'pages_show_list',
    'pages_messaging',
    'pages_read_engagement',
    'pages_manage_metadata',
    'business_management',
  ]
  if (channel === 'instagram') {
    scopes.push('instagram_manage_messages', 'instagram_basic')
  }

  const fbOAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
  fbOAuthUrl.searchParams.set('client_id', appId)
  fbOAuthUrl.searchParams.set('redirect_uri', redirectUri)
  fbOAuthUrl.searchParams.set('scope', scopes.join(','))
  fbOAuthUrl.searchParams.set('state', state)
  fbOAuthUrl.searchParams.set('response_type', 'code')

  return NextResponse.redirect(fbOAuthUrl.toString())
}
