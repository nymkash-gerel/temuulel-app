import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/medical-notes/:id
 *
 * Get a single medical note by id.
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

  const { data: note, error } = await supabase
    .from('medical_notes')
    .select(`
      id, encounter_id, patient_id, author_id, note_type, content, is_private, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !note) {
    return NextResponse.json({ error: 'Medical note not found' }, { status: 404 })
  }

  return NextResponse.json(note)
}

/**
 * PATCH /api/medical-notes/:id
 *
 * Update a medical note (content and is_private).
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

  let raw: Record<string, unknown>
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof raw.content === 'string') updateData.content = raw.content
  if (typeof raw.is_private === 'boolean') updateData.is_private = raw.is_private

  if (Object.keys(updateData).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: note, error } = await supabase
    .from('medical_notes')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, encounter_id, patient_id, author_id, note_type, content, is_private, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!note) {
    return NextResponse.json({ error: 'Medical note not found' }, { status: 404 })
  }

  return NextResponse.json(note)
}
