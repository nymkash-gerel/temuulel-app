import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const stockCountSchema = z.object({
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      variant_id: z.string().uuid().optional(),
      location_id: z.string().uuid().optional(),
      expected_quantity: z.number(),
      actual_quantity: z.number(),
      notes: z.string().optional(),
    })
  ),
})

/**
 * POST /api/inventory/count
 *
 * Stock reconciliation endpoint. Compares expected vs actual quantities
 * and creates inventory_movement adjustment records for any discrepancies.
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

  let body: z.infer<typeof stockCountSchema>
  try {
    const json = await request.json()
    body = stockCountSchema.parse(json)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const movementsToInsert = body.items
    .filter((item) => item.actual_quantity !== item.expected_quantity)
    .map((item) => ({
      store_id: store.id,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      location_id: item.location_id || null,
      movement_type: 'adjusted',
      quantity: item.actual_quantity - item.expected_quantity,
      reference_type: 'stock_count',
      notes: item.notes || 'Stock count adjustment',
    }))

  if (movementsToInsert.length === 0) {
    return NextResponse.json({ adjustments: 0, movements: [] }, { status: 200 })
  }

  const { data: movements, error } = await supabase
    .from('inventory_movements')
    .insert(movementsToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { adjustments: movements.length, movements },
    { status: 201 }
  )
}
