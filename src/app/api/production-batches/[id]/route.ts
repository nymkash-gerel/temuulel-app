import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateProductionBatchSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/production-batches/:id
 *
 * Get a single production batch by id.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { data: batch, error } = await supabase
    .from('production_batches')
    .select(`
      id, product_id, production_date, target_qty, produced_qty,
      cost_per_unit, expiry_date, status, assigned_to, notes,
      created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !batch) {
    return NextResponse.json({ error: 'Production batch not found' }, { status: 404 })
  }

  return NextResponse.json(batch)
}

/**
 * PATCH /api/production-batches/:id
 *
 * Update a production batch.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { data: body, error: validationError } = await validateBody(request, updateProductionBatchSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.produced_qty !== undefined) updateData.produced_qty = body.produced_qty
  if (body.notes !== undefined) updateData.notes = body.notes

  const { data: batch, error } = await supabase
    .from('production_batches')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, product_id, production_date, target_qty, produced_qty,
      cost_per_unit, expiry_date, status, assigned_to, notes,
      created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!batch) {
    return NextResponse.json({ error: 'Production batch not found' }, { status: 404 })
  }

  return NextResponse.json(batch)
}
