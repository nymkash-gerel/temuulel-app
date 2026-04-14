import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/messenger'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get campaign
  const { data: campaign } = await supabase
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Get store token
  const { data: store } = await supabase
    .from('stores')
    .select('facebook_page_access_token')
    .eq('id', campaign.store_id)
    .single()

  if (!store?.facebook_page_access_token) {
    return NextResponse.json({ error: 'Facebook page not connected' }, { status: 400 })
  }

  // Get target customers with messenger IDs
  let customerQuery = supabase
    .from('customers')
    .select('id, messenger_id')
    .eq('store_id', campaign.store_id)
    .not('messenger_id', 'is', null)

  if (campaign.target_audience === 'ordered') {
    // Only customers who have ordered
    const { data: orderCustomers } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('store_id', campaign.store_id)
    const orderIds = [...new Set((orderCustomers || []).map((o: { customer_id: string }) => o.customer_id))]
    if (orderIds.length > 0) {
      customerQuery = customerQuery.in('id', orderIds)
    }
  }

  const { data: customers } = await customerQuery
  if (!customers || customers.length === 0) {
    return NextResponse.json({ error: 'No recipients found' }, { status: 400 })
  }

  // Update campaign status
  await supabase
    .from('broadcast_campaigns')
    .update({ status: 'sending', total_recipients: customers.length, updated_at: new Date().toISOString() })
    .eq('id', id)

  // Send messages (fire-and-forget in background)
  let sentCount = 0
  let failedCount = 0

  for (const customer of customers) {
    if (!customer.messenger_id) continue
    try {
      await sendTextMessage(customer.messenger_id, campaign.message_text, store.facebook_page_access_token)
      sentCount++
      // Insert recipient record
      await supabase.from('broadcast_recipients').insert({
        campaign_id: id,
        customer_id: customer.id,
        messenger_id: customer.messenger_id,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    } catch (err) {
      failedCount++
      await supabase.from('broadcast_recipients').insert({
        campaign_id: id,
        customer_id: customer.id,
        messenger_id: customer.messenger_id,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
    // Rate limit: 200ms between messages
    await new Promise(r => setTimeout(r, 200))
  }

  // Update final status
  await supabase
    .from('broadcast_campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
      failed_count: failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({ sent: sentCount, failed: failedCount, total: customers.length })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('broadcast_campaigns').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
