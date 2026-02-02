import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createAttachmentSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/attachments
 *
 * List attachments for the store. Supports filtering by entity_type and entity_id.
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
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('attachments')
    .select('id, entity_type, entity_id, file_name, file_url, file_type, file_size, uploaded_by, created_at', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }
  if (entityId) {
    query = query.eq('entity_id', entityId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/attachments
 *
 * Create an attachment record.
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

  const { data: body, error: validationError } = await validateBody(request, createAttachmentSchema)
  if (validationError) return validationError

  const { data: attachment, error } = await supabase
    .from('attachments')
    .insert({
      store_id: store.id,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      file_name: body.file_name,
      file_url: body.file_url,
      file_type: body.file_type || null,
      file_size: body.file_size || null,
      uploaded_by: user.id,
    })
    .select('id, entity_type, entity_id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(attachment, { status: 201 })
}
