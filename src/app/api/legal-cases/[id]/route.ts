import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateLegalCaseSchema } from '@/lib/validations'
import { validateTransition, legalCaseTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/legal-cases/:id
 *
 * Get a single legal case by id.
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

  const { data: legalCase, error } = await supabase
    .from('legal_cases')
    .select(`
      id, case_number, title, customer_id, assigned_to, case_type, status, priority, description, court_name, filing_date, next_hearing, total_fees, amount_paid, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !legalCase) {
    return NextResponse.json({ error: 'Legal case not found' }, { status: 404 })
  }

  return NextResponse.json(legalCase)
}

/**
 * PATCH /api/legal-cases/:id
 *
 * Update a legal case.
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

  const { data: body, error: validationError } = await validateBody(request, updateLegalCaseSchema)
  if (validationError) return validationError

  // Validate status transition
  if (body.status) {
    const { data: current } = await supabase
      .from('legal_cases')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Legal case not found' }, { status: 404 })
    }

    const result = validateTransition(legalCaseTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const { data: legalCase, error } = await supabase
    .from('legal_cases')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, case_number, title, customer_id, assigned_to, case_type, status, priority, description, court_name, filing_date, next_hearing, total_fees, amount_paid, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!legalCase) {
    return NextResponse.json({ error: 'Legal case not found' }, { status: 404 })
  }

  return NextResponse.json(legalCase)
}

/**
 * DELETE /api/legal-cases/:id
 *
 * Delete a legal case.
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
    .from('legal_cases')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
