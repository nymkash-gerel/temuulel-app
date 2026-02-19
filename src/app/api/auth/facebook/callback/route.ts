import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const GRAPH_API = 'https://graph.facebook.com/v18.0'

interface FacebookPage {
  id: string
  name: string
  access_token: string
  instagram_business_account?: { id: string }
}

// Fetch all items with pagination support
async function fetchAllPaginated<T>(initialUrl: string): Promise<T[]> {
  const allItems: T[] = []
  let nextUrl: string | null = initialUrl

  while (nextUrl) {
    const res: Response = await fetch(nextUrl)
    if (!res.ok) {
      console.error('Pagination fetch failed:', await res.text())
      break
    }
    const data = await res.json()
    allItems.push(...(data.data || []))
    nextUrl = data.paging?.next || null
  }

  return allItems
}

// Fetch pages from Business Manager accounts
async function fetchBusinessPages(
  userToken: string,
  fields: string
): Promise<FacebookPage[]> {
  const businessPages: FacebookPage[] = []

  try {
    // Get all businesses the user has access to
    const businessesUrl = new URL(`${GRAPH_API}/me/businesses`)
    businessesUrl.searchParams.set('access_token', userToken)
    businessesUrl.searchParams.set('fields', 'id,name')
    businessesUrl.searchParams.set('limit', '100')

    const businesses = await fetchAllPaginated<{ id: string; name: string }>(businessesUrl.toString())
    console.log(`[FB OAuth] Found ${businesses.length} businesses`)

    // For each business, get owned pages
    for (const business of businesses) {
      const ownedPagesUrl = new URL(`${GRAPH_API}/${business.id}/owned_pages`)
      ownedPagesUrl.searchParams.set('access_token', userToken)
      ownedPagesUrl.searchParams.set('fields', fields)
      ownedPagesUrl.searchParams.set('limit', '100')

      const pages = await fetchAllPaginated<FacebookPage>(ownedPagesUrl.toString())
      console.log(`[FB OAuth] Business "${business.name}" has ${pages.length} owned pages`)
      businessPages.push(...pages)

      // Also check client pages (pages the business manages for clients)
      const clientPagesUrl = new URL(`${GRAPH_API}/${business.id}/client_pages`)
      clientPagesUrl.searchParams.set('access_token', userToken)
      clientPagesUrl.searchParams.set('fields', fields)
      clientPagesUrl.searchParams.set('limit', '100')

      const clientPages = await fetchAllPaginated<FacebookPage>(clientPagesUrl.toString())
      console.log(`[FB OAuth] Business "${business.name}" has ${clientPages.length} client pages`)
      businessPages.push(...clientPages)
    }
  } catch (err) {
    console.error('[FB OAuth] Error fetching business pages:', err)
  }

  return businessPages
}

export async function GET(request: NextRequest) {
  // Rate limit: 5 requests per 60 seconds
  const rl = await rateLimit(getClientIp(request), { limit: 5, windowSeconds: 60 })
  if (!rl.success) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings/integrations?fb_error=rate_limited`
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const appId = process.env.FACEBOOK_APP_ID!
  const appSecret = process.env.FACEBOOK_APP_SECRET!
  const redirectUri = `${appUrl}/api/auth/facebook/callback`
  const integrationsUrl = `${appUrl}/dashboard/settings/integrations`

  // Handle errors from Facebook (user denied, etc.)
  const error = request.nextUrl.searchParams.get('error')
  if (error) {
    const reason = request.nextUrl.searchParams.get('error_description') || error
    return NextResponse.redirect(
      `${integrationsUrl}?fb_error=${encodeURIComponent(reason)}`
    )
  }

  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(`${integrationsUrl}?fb_error=missing_params`)
  }

  // Decode state to extract store_id and channel
  let storeId: string
  let channel: string = 'messenger'
  try {
    const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    storeId = state.store_id
    channel = state.channel || 'messenger'
    if (!storeId) throw new Error('No store_id in state')
  } catch {
    return NextResponse.redirect(`${integrationsUrl}?fb_error=invalid_state`)
  }

  const errorPrefix = channel === 'instagram' ? 'ig_error' : 'fb_error'
  const successParam = channel === 'instagram' ? 'ig_success' : 'fb_success'

  // Verify user is authenticated and owns the store
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.redirect(`${integrationsUrl}?${errorPrefix}=store_not_found`)
  }

  try {
    // Step 1: Exchange code for short-lived user access token
    const tokenUrl = new URL(`${GRAPH_API}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('Token exchange failed:', err)
      throw new Error('Failed to exchange code for token')
    }
    const { access_token: shortLivedToken } = await tokenRes.json()

    // Step 2: Exchange for long-lived user token
    const longLivedUrl = new URL(`${GRAPH_API}/oauth/access_token`)
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.set('client_id', appId)
    longLivedUrl.searchParams.set('client_secret', appSecret)
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken)

    const longLivedRes = await fetch(longLivedUrl.toString())
    if (!longLivedRes.ok) {
      throw new Error('Failed to get long-lived token')
    }
    const { access_token: longLivedUserToken } = await longLivedRes.json()

    // Step 3: Get ALL pages the user manages (personal + business)
    const fields = channel === 'instagram'
      ? 'id,name,access_token,instagram_business_account'
      : 'id,name,access_token'

    // Fetch personal pages
    const pagesUrl = new URL(`${GRAPH_API}/me/accounts`)
    pagesUrl.searchParams.set('access_token', longLivedUserToken)
    pagesUrl.searchParams.set('limit', '100')
    pagesUrl.searchParams.set('fields', fields)

    const personalPages = await fetchAllPaginated<FacebookPage>(pagesUrl.toString())
    console.log(`[FB OAuth] Fetched ${personalPages.length} personal pages`)

    // Fetch business pages
    const businessPages = await fetchBusinessPages(longLivedUserToken, fields)
    console.log(`[FB OAuth] Fetched ${businessPages.length} business pages`)

    // Merge and deduplicate by page ID
    const pageMap = new Map<string, FacebookPage>()
    for (const page of [...personalPages, ...businessPages]) {
      if (!pageMap.has(page.id)) {
        pageMap.set(page.id, page)
      }
    }
    const pages = Array.from(pageMap.values())

    // Debug: Log total pages
    console.log(`[FB OAuth] Total ${pages.length} unique pages:`, pages.map(p => ({ id: p.id, name: p.name })))

    if (channel === 'instagram') {
      return handleInstagramFlow(pages, storeId, supabase, appUrl, integrationsUrl)
    }

    // --- Messenger flow ---
    if (pages.length === 0) {
      return NextResponse.redirect(`${integrationsUrl}?fb_error=no_pages`)
    }

    if (pages.length > 1) {
      const pagesParam = Buffer.from(
        JSON.stringify(pages.map(p => ({ id: p.id, name: p.name, token: p.access_token })))
      ).toString('base64url')

      return NextResponse.redirect(
        `${appUrl}/dashboard/settings/integrations/select-page?pages=${pagesParam}&store_id=${storeId}`
      )
    }

    // Single page — auto-connect
    const page = pages[0]
    await subscribePage(page.id, page.access_token)

    const { error: updateError } = await supabase
      .from('stores')
      .update({
        facebook_page_id: page.id,
        facebook_page_access_token: page.access_token,
        facebook_page_name: page.name,
        facebook_connected_at: new Date().toISOString(),
      })
      .eq('id', storeId)

    if (updateError) throw updateError

    return NextResponse.redirect(`${integrationsUrl}?${successParam}=true`)
  } catch (err) {
    console.error('Facebook OAuth callback error:', err)
    return NextResponse.redirect(`${integrationsUrl}?${errorPrefix}=exchange_failed`)
  }
}

async function handleInstagramFlow(
  pages: FacebookPage[],
  storeId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  appUrl: string,
  integrationsUrl: string,
) {
  // Filter pages that have a linked Instagram Business Account
  const igPages = pages.filter(p => p.instagram_business_account?.id)

  if (igPages.length === 0) {
    return NextResponse.redirect(
      `${integrationsUrl}?ig_error=no_instagram`
    )
  }

  if (igPages.length > 1) {
    // Multiple Instagram accounts — redirect to picker
    const pagesParam = Buffer.from(
      JSON.stringify(igPages.map(p => ({
        id: p.instagram_business_account!.id,
        name: `${p.name} (Instagram)`,
        token: p.access_token,
        page_id: p.id,
      })))
    ).toString('base64url')

    return NextResponse.redirect(
      `${appUrl}/dashboard/settings/integrations/select-page?pages=${pagesParam}&store_id=${storeId}&channel=instagram`
    )
  }

  // Single Instagram account — auto-connect
  const page = igPages[0]
  const igAccountId = page.instagram_business_account!.id

  // Subscribe the Facebook Page to webhooks (Instagram DMs come through the page's subscription)
  await subscribePage(page.id, page.access_token)

  // Store the page access token (needed for sending IG DMs) and IG account ID
  const { error: updateError } = await supabase
    .from('stores')
    .update({
      instagram_business_account_id: igAccountId,
      instagram_page_name: page.name,
      instagram_connected_at: new Date().toISOString(),
      // Also ensure the page token is stored (shared with Messenger)
      facebook_page_id: page.id,
      facebook_page_access_token: page.access_token,
      facebook_page_name: page.name,
    })
    .eq('id', storeId)

  if (updateError) throw updateError

  return NextResponse.redirect(`${integrationsUrl}?ig_success=true`)
}

async function subscribePage(pageId: string, pageAccessToken: string) {
  try {
    const res = await fetch(
      `${GRAPH_API}/${pageId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: pageAccessToken,
          // Subscribe to messaging events (DMs) and feed events (comments)
          subscribed_fields: 'messages,messaging_postbacks,messaging_optins,feed',
        }),
      }
    )
    if (!res.ok) {
      const errText = await res.text()
      console.error('Failed to subscribe page to webhooks:', errText)
    }
  } catch (err) {
    console.error('Page subscription error:', err)
  }
}
