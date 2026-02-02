import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateMachineSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/machines/:id
 *
 * Get a single machine by id.
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

  const { data: machine, error } = await supabase
    .from('machines')
    .select(`
      id, name, machine_type, status, capacity_kg, created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !machine) {
    return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
  }

  return NextResponse.json(machine)
}

/**
 * PATCH /api/machines/:id
 *
 * Update a machine.
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

  const { data: body, error: validationError } = await validateBody(request, updateMachineSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.machine_type !== undefined) updateData.machine_type = body.machine_type
  if (body.status !== undefined) updateData.status = body.status
  if (body.capacity_kg !== undefined) updateData.capacity_kg = body.capacity_kg

  const { data: machine, error } = await supabase
    .from('machines')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, machine_type, status, capacity_kg, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!machine) {
    return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
  }

  return NextResponse.json(machine)
}

/**
 * DELETE /api/machines/:id
 *
 * Delete a machine.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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

  const { error } = await supabase
    .from('machines')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
