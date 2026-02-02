import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePayoutSchema } from '@/lib/validations'

/**
 * PATCH /api/driver-payouts/[id]
 * Update payout status (approve, pay, cancel).
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

  const { data: body, error: validationError } = await validateBody(request, updatePayoutSchema)
  if (validationError) return validationError

  // Verify payout belongs to store
  const { data: existing } = await supabase
    .from('driver_payouts')
    .select('id, status')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })

  const updateData: Record<string, unknown> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  }

  if (body.status === 'paid') {
    updateData.paid_at = new Date().toISOString()
  }
  if (body.notes !== undefined) {
    updateData.notes = body.notes
  }

  const { data: payout, error } = await supabase
    .from('driver_payouts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payout })
}
