import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePhotoSessionSchema } from '@/lib/validations'
import { validateTransition, photoSessionTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/photo-sessions/:id
 *
 * Get a single photo session by id.
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

  const { data: session, error } = await supabase
    .from('photo_sessions')
    .select(`
      id, customer_id, photographer_id, session_type, location, scheduled_at, duration_minutes, total_amount, deposit_amount, notes, status, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Photo session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}

/**
 * PATCH /api/photo-sessions/:id
 *
 * Update a photo session.
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

  const { data: body, error: validationError } = await validateBody(request, updatePhotoSessionSchema)
  if (validationError) return validationError

  // Validate status transition
  if (body.status) {
    const { data: current } = await supabase
      .from('photo_sessions')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Photo session not found' }, { status: 404 })
    }

    const result = validateTransition(photoSessionTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const { data: session, error } = await supabase
    .from('photo_sessions')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, customer_id, photographer_id, session_type, location, scheduled_at, duration_minutes, total_amount, deposit_amount, notes, status, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Photo session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}

/**
 * DELETE /api/photo-sessions/:id
 *
 * Delete a photo session.
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
    .from('photo_sessions')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
