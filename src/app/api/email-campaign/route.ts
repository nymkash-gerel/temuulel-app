import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFromEmailAddress } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  const body = await req.json()
  const { subject, html_body, target } = body as {
    subject: string; html_body: string; target?: 'all' | 'ordered'
  }

  if (!subject?.trim() || !html_body?.trim()) {
    return NextResponse.json({ error: 'subject and html_body required' }, { status: 400 })
  }

  // Get store info
  const { data: store } = await supabase
    .from('stores')
    .select('name')
    .eq('id', member.store_id)
    .single()

  // Get customers with email
  let customerQuery = supabase
    .from('customers')
    .select('id, email, name')
    .eq('store_id', member.store_id)
    .not('email', 'is', null)

  if (target === 'ordered') {
    const { data: orderCustomers } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('store_id', member.store_id)
    const orderIds = [...new Set((orderCustomers || []).map((o: { customer_id: string }) => o.customer_id))]
    if (orderIds.length > 0) customerQuery = customerQuery.in('id', orderIds)
  }

  const { data: customers } = await customerQuery.limit(500)
  if (!customers || customers.length === 0) {
    return NextResponse.json({ error: 'No customers with email found' }, { status: 400 })
  }

  // Send via Resend
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 })
  }

  const fromEmail = getFromEmailAddress()
  let sentCount = 0
  let failedCount = 0

  for (const customer of customers) {
    if (!customer.email) continue
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${store?.name || 'Temuulel'} <${fromEmail}>`,
          to: [customer.email],
          subject,
          html: html_body.replace('{{name}}', customer.name || 'Хэрэглэгч'),
        }),
      })
      if (res.ok) sentCount++
      else failedCount++
    } catch {
      failedCount++
    }
    await new Promise(r => setTimeout(r, 100)) // Rate limit
  }

  return NextResponse.json({ sent: sentCount, failed: failedCount, total: customers.length })
}
