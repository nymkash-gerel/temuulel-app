import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateStaffSchema } from '@/lib/validations'

/**
 * GET /api/staff/:id — Get a single staff member.
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

  const { data: staff, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  return NextResponse.json({ staff })
}

/**
 * PATCH /api/staff/:id — Update a staff member.
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

  const { data: updates, error: validationError } = await validateBody(request, updateStaffSchema)
  if (validationError) return validationError

  const { data: staff, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .eq('store_id', store.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  return NextResponse.json({ staff })
}

/**
 * DELETE /api/staff/:id — Delete a staff member.
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

  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
