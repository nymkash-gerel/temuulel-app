import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ token: string }> }

/**
 * GET /api/tables/:token
 *
 * Public endpoint to resolve a QR code token to table/store information.
 * No authentication required - used for QR code scanning.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
  }

  // Use service role to bypass RLS (public endpoint)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Look up table by QR token
  const { data: table, error } = await supabase
    .from('table_layouts')
    .select(`
      id,
      name,
      capacity,
      section,
      qr_enabled,
      store_id,
      stores(id, name, logo_url)
    `)
    .eq('qr_code_token', token)
    .eq('is_active', true)
    .single()

  if (error || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  // Check if QR ordering is enabled for this table
  if (!table.qr_enabled) {
    return NextResponse.json({ error: 'QR ordering not enabled for this table' }, { status: 403 })
  }

  // Type-safe extraction of nested store data
  const storeData = table.stores as unknown as { id: string; name: string; logo_url: string | null } | null

  return NextResponse.json({
    table_id: table.id,
    table_name: table.name,
    capacity: table.capacity,
    section: table.section,
    store_id: table.store_id,
    store_name: storeData?.name ?? null,
    store_logo: storeData?.logo_url ?? null,
  })
}
