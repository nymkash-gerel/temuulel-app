import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePhotoGallerySchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/photo-galleries/:id
 *
 * Get a single photo gallery by id.
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

  const { data: gallery, error } = await supabase
    .from('photo_galleries')
    .select(`
      id, session_id, name, description, gallery_url, download_url, password, photo_count, status, created_at, updated_at,
      photo_sessions(id, session_type, scheduled_at)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !gallery) {
    return NextResponse.json({ error: 'Photo gallery not found' }, { status: 404 })
  }

  return NextResponse.json(gallery)
}

/**
 * PATCH /api/photo-galleries/:id
 *
 * Update a photo gallery.
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

  const { data: body, error: validationError } = await validateBody(request, updatePhotoGallerySchema)
  if (validationError) return validationError

  const { data: gallery, error } = await supabase
    .from('photo_galleries')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, session_id, name, description, gallery_url, download_url, password, photo_count, status, created_at, updated_at,
      photo_sessions(id, session_type, scheduled_at)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!gallery) {
    return NextResponse.json({ error: 'Photo gallery not found' }, { status: 404 })
  }

  return NextResponse.json(gallery)
}

/**
 * DELETE /api/photo-galleries/:id
 *
 * Delete a photo gallery.
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
    .from('photo_galleries')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
