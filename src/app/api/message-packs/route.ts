import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PACKS = [
  { size: 500, price: 15000, label: '500 мессеж — ₮15,000' },
  { size: 1000, price: 25000, label: '1,000 мессеж — ₮25,000' },
  { size: 3000, price: 60000, label: '3,000 мессеж — ₮60,000' },
  { size: 5000, price: 90000, label: '5,000 мессеж — ₮90,000' },
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  // Get current usage (new columns not in generated types yet)
  const { data: store } = await supabase
    .from('stores')
    .select('monthly_message_limit, messages_used, messages_reset_at')
    .eq('id', member.store_id)
    .single()

  // Get purchase history
  const { data: purchases } = await supabase
    .from('message_pack_purchases')
    .select('*')
    .eq('store_id', member.store_id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    packs: PACKS,
    usage: {
      limit: (store as Record<string, unknown>)?.monthly_message_limit ?? 100,
      used: (store as Record<string, unknown>)?.messages_used ?? 0,
      resetAt: (store as Record<string, unknown>)?.messages_reset_at,
    },
    purchases: purchases || [],
  })
}

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
  const { pack_size } = body as { pack_size: number }

  const pack = PACKS.find(p => p.size === pack_size)
  if (!pack) return NextResponse.json({ error: 'Invalid pack size' }, { status: 400 })

  // Create purchase record
  const { data: purchase, error } = await supabase
    .from('message_pack_purchases')
    .insert({
      store_id: member.store_id,
      pack_size: pack.size,
      price: pack.price,
      status: 'paid', // In production, integrate with QPay first
      purchased_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add messages to store limit (new column not in types — use as any)
  const { data: currentStore } = await supabase
    .from('stores')
    .select('monthly_message_limit')
    .eq('id', member.store_id)
    .single()
  const currentLimit = (currentStore as Record<string, unknown>)?.monthly_message_limit as number || 100
  await supabase
    .from('stores')
    .update({ monthly_message_limit: currentLimit + pack.size })
    .eq('id', member.store_id)

  return NextResponse.json({ purchase, added: pack.size }, { status: 201 })
}
