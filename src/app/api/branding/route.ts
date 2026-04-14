import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Branding {
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  custom_domain?: string
  hide_temuulel_brand?: boolean
  widget_title?: string
  widget_subtitle?: string
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: store } = await (supabase as any)
    .from('stores')
    .select('branding, custom_domain')
    .eq('id', member.store_id)
    .single()

  return NextResponse.json({
    branding: (store?.branding as Branding) || {},
    custom_domain: store?.custom_domain || null,
  })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  const body = await req.json() as { branding?: Branding; custom_domain?: string }
  const updates: Record<string, unknown> = {}
  if (body.branding !== undefined) updates.branding = body.branding
  if (body.custom_domain !== undefined) {
    // Validate domain format (basic)
    if (body.custom_domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(body.custom_domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
    }
    updates.custom_domain = body.custom_domain || null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('stores')
    .update(updates)
    .eq('id', member.store_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: true })
}
