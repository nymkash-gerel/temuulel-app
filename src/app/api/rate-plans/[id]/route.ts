import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateRatePlanSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/rate-plans/:id
 *
 * Get a single rate plan by id.
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

  const { data: ratePlan, error } = await supabase
    .from('rate_plans')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !ratePlan) {
    return NextResponse.json({ error: 'Rate plan not found' }, { status: 404 })
  }

  return NextResponse.json(ratePlan)
}

/**
 * PATCH /api/rate-plans/:id
 *
 * Update a rate plan.
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

  const { data: body, error: validationError } = await validateBody(request, updateRatePlanSchema)
  if (validationError) return validationError

  const { data: ratePlan, error } = await supabase
    .from('rate_plans')
    .update({ ...body, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', id)
    .eq('store_id', store.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!ratePlan) {
    return NextResponse.json({ error: 'Rate plan not found' }, { status: 404 })
  }

  return NextResponse.json(ratePlan)
}
