import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateBusyModeSchema } from '@/lib/validations'

/**
 * PATCH /api/stores/busy-mode
 *
 * Toggle busy mode for the authenticated user's store.
 * When busy_mode is true, new orders are rejected with a 503 status.
 */
export async function PATCH(request: NextRequest) {
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

  const { data: body, error: validationError } = await validateBody(request, updateBusyModeSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = {
    busy_mode: body.busy_mode,
    updated_at: new Date().toISOString(),
  }
  if (body.busy_message !== undefined) updateData.busy_message = body.busy_message
  if (body.estimated_wait_minutes !== undefined) updateData.estimated_wait_minutes = body.estimated_wait_minutes

  // Clear message and wait time when turning off busy mode
  if (!body.busy_mode) {
    updateData.busy_message = null
    updateData.estimated_wait_minutes = null
  }

  const { data: updated, error } = await supabase
    .from('stores')
    .update(updateData)
    .eq('id', store.id)
    .select('id, busy_mode, busy_message, estimated_wait_minutes, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

/**
 * GET /api/stores/busy-mode
 *
 * Returns the current busy mode status for the authenticated user's store.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store, error } = await supabase
    .from('stores')
    .select('id, busy_mode, busy_message, estimated_wait_minutes')
    .eq('owner_id', user.id)
    .single()

  if (error || !store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  return NextResponse.json(store)
}
