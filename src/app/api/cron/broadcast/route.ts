import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/messenger'

/**
 * Cron endpoint: sends scheduled broadcast campaigns.
 * Call via Vercel Cron or external scheduler every 1-5 minutes.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
  )

  // Find campaigns that are scheduled and due
  const { data: campaigns } = await supabase
    .from('broadcast_campaigns')
    .select('*, stores(facebook_page_access_token)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let totalProcessed = 0

  for (const campaign of campaigns) {
    const pageToken = campaign.stores?.facebook_page_access_token
    if (!pageToken) continue

    // Mark as sending
    await supabase
      .from('broadcast_campaigns')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', campaign.id)

    // Get recipients
    const { data: customers } = await supabase
      .from('customers')
      .select('id, messenger_id')
      .eq('store_id', campaign.store_id)
      .not('messenger_id', 'is', null)

    let sentCount = 0
    let failedCount = 0

    for (const customer of (customers || [])) {
      if (!customer.messenger_id) continue
      try {
        await sendTextMessage(customer.messenger_id, campaign.message_text, pageToken)
        sentCount++
        await supabase.from('broadcast_recipients').insert({
          campaign_id: campaign.id,
          customer_id: customer.id,
          messenger_id: customer.messenger_id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      } catch {
        failedCount++
      }
      await new Promise(r => setTimeout(r, 200))
    }

    await supabase
      .from('broadcast_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        total_recipients: (customers || []).length,
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)

    totalProcessed++
  }

  return NextResponse.json({ processed: totalProcessed })
}
