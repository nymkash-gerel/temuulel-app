import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  const format = req.nextUrl.searchParams.get('format') || 'json'
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, channel, status, created_at, updated_at, customers(name, phone, email, messenger_id)')
    .eq('store_id', member.store_id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!conversations) return NextResponse.json({ error: 'No data' }, { status: 500 })

  const convIds = conversations.map((c: { id: string }) => c.id)
  const { data: messages } = await supabase
    .from('messages')
    .select('conversation_id, content, is_from_customer, is_ai_response, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true })

  // Build export structure
  const msgByConv: Record<string, { content: string; is_from_customer: boolean; is_ai_response: boolean; created_at: string }[]> = {}
  for (const m of (messages || []) as { conversation_id: string; content: string; is_from_customer: boolean; is_ai_response: boolean; created_at: string }[]) {
    if (!msgByConv[m.conversation_id]) msgByConv[m.conversation_id] = []
    msgByConv[m.conversation_id].push(m)
  }

  type CustomerRef = { name?: string | null; phone?: string | null; email?: string | null; messenger_id?: string | null }
  const rows = conversations.map((c) => {
    const conv = c as unknown as { id: string; channel: string; status: string; created_at: string; customers: CustomerRef | CustomerRef[] | null }
    const customer = Array.isArray(conv.customers) ? conv.customers[0] : conv.customers
    return {
      conversation_id: conv.id,
      channel: conv.channel,
      status: conv.status,
      customer_name: customer?.name || '',
      customer_phone: customer?.phone || '',
      customer_email: customer?.email || '',
      created_at: conv.created_at,
      messages: msgByConv[conv.id] || [],
    }
  })

  if (format === 'csv') {
    // Flatten: one row per message
    const header = 'conversation_id,channel,customer_name,customer_phone,sender,is_ai,content,timestamp\n'
    const lines = rows.flatMap(r =>
      r.messages.map(m => {
        const sender = m.is_from_customer ? 'customer' : 'store'
        const content = (m.content || '').replace(/"/g, '""').replace(/\n/g, ' ')
        return `"${r.conversation_id}","${r.channel}","${r.customer_name}","${r.customer_phone}","${sender}","${m.is_ai_response}","${content}","${m.created_at}"`
      })
    )
    const csv = header + lines.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="conversations-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  // Default: JSON
  return new NextResponse(JSON.stringify({ conversations: rows, exported_at: new Date().toISOString() }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="conversations-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
