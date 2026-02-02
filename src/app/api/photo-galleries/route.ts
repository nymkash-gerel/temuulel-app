import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPhotoGallerySchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/photo-galleries
 *
 * List photo galleries for the store. Supports filtering by session_id, status.
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
  const sessionId = searchParams.get('session_id')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['processing', 'ready', 'delivered', 'archived'] as const

  let query = supabase
    .from('photo_galleries')
    .select(`
      id, session_id, name, description, gallery_url, download_url, password, photo_count, status, created_at, updated_at,
      photo_sessions(id, session_type, scheduled_at)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (sessionId) {
    query = query.eq('session_id', sessionId)
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
 * POST /api/photo-galleries
 *
 * Create a new photo gallery.
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

  const { data: body, error: validationError } = await validateBody(request, createPhotoGallerySchema)
  if (validationError) return validationError

  // Verify session belongs to store
  const { data: session } = await supabase
    .from('photo_sessions')
    .select('id')
    .eq('id', body.session_id)
    .eq('store_id', store.id)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Photo session not found in this store' }, { status: 404 })
  }

  const { data: gallery, error } = await supabase
    .from('photo_galleries')
    .insert({
      store_id: store.id,
      session_id: body.session_id,
      name: body.name,
      description: body.description || null,
      gallery_url: body.gallery_url || null,
      download_url: body.download_url || null,
      password: body.password || null,
      photo_count: body.photo_count || undefined,
    })
    .select(`
      id, session_id, name, description, gallery_url, download_url, password, photo_count, status, created_at, updated_at,
      photo_sessions(id, session_type, scheduled_at)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(gallery, { status: 201 })
}
