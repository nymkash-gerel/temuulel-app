import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateCommentRuleSchema } from '@/lib/validations'

// GET - Get a single comment auto-reply rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const { data: rule, error } = await supabase
    .from('comment_auto_rules')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  return NextResponse.json({ rule })
}

// PATCH - Update a comment auto-reply rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Verify rule belongs to store
  const { data: existingRule } = await supabase
    .from('comment_auto_rules')
    .select('id')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!existingRule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  const { data: body, error: validationError } = await validateBody(request, updateCommentRuleSchema)
  if (validationError) return validationError

  const { data: rule, error } = await supabase
    .from('comment_auto_rules')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule })
}

// DELETE - Delete a comment auto-reply rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Verify rule belongs to store
  const { data: existingRule } = await supabase
    .from('comment_auto_rules')
    .select('id')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!existingRule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('comment_auto_rules')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
