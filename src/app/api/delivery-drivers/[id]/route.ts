import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateDriverSchema } from '@/lib/validations'
import type { Database } from '@/lib/database.types'

/**
 * GET /api/delivery-drivers/:id
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: driver, error } = await supabase
    .from('delivery_drivers')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  return NextResponse.json({ driver })
}

/**
 * PATCH /api/delivery-drivers/:id
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: updates, error: validationError } = await validateBody(request, updateDriverSchema)
  if (validationError) return validationError

  const { data: driver, error } = await supabase
    .from('delivery_drivers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    } as Database['public']['Tables']['delivery_drivers']['Update'])
    .eq('id', id)
    .eq('store_id', store.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Driver with this phone already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  return NextResponse.json({ driver })
}

/**
 * DELETE /api/delivery-drivers/:id
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Check if driver has active deliveries
  const { count } = await supabase
    .from('deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', id)
    .in('status', ['assigned', 'picked_up', 'in_transit'])

  if (count && count > 0) {
    return NextResponse.json({
      error: 'Cannot delete driver with active deliveries',
    }, { status: 400 })
  }

  const { error } = await supabase
    .from('delivery_drivers')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
