import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateBookableResourceSchema } from '@/lib/validations'
import type { Database } from '@/lib/database.types'

/**
 * GET /api/bookable-resources/:id — Get a single resource.
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

  const { data: resource, error } = await supabase
    .from('bookable_resources')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })

  return NextResponse.json({ resource })
}

/**
 * PATCH /api/bookable-resources/:id — Update a resource.
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

  const { data: updates, error: validationError } = await validateBody(request, updateBookableResourceSchema)
  if (validationError) return validationError

  const { data: resource, error } = await supabase
    .from('bookable_resources')
    .update(updates as Database['public']['Tables']['bookable_resources']['Update'])
    .eq('id', id)
    .eq('store_id', store.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })

  return NextResponse.json({ resource })
}

/**
 * DELETE /api/bookable-resources/:id — Delete a resource.
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
    .from('bookable_resources')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
