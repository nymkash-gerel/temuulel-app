import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createMachineSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/machines
 *
 * List machines for the store. Supports filtering by machine_type, status.
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const machineType = searchParams.get('machine_type')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  const validMachineTypes = ['washer', 'dryer', 'iron_press', 'steam'] as const
  const validStatuses = ['available', 'in_use', 'maintenance', 'out_of_order'] as const

  let query = supabase
    .from('machines')
    .select(`
      id, name, machine_type, status, capacity_kg, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (machineType && validMachineTypes.includes(machineType as typeof validMachineTypes[number])) {
    query = query.eq('machine_type', machineType as typeof validMachineTypes[number])
  }

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/machines
 *
 * Create a new machine.
 */
export async function POST(request: NextRequest) {
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

  const { data: body, error: validationError } = await validateBody(request, createMachineSchema)
  if (validationError) return validationError

  const { data: machine, error } = await supabase
    .from('machines')
    .insert({
      store_id: store.id,
      name: body.name,
      machine_type: body.machine_type || undefined,
      capacity_kg: body.capacity_kg || null,
    })
    .select(`
      id, name, machine_type, status, capacity_kg, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(machine, { status: 201 })
}
