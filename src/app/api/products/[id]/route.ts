import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveStore } from '@/lib/resolve-store'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const store = await resolveStore(supabase, user.id)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Verify product belongs to this store
  const { data: product } = await supabase
    .from('products')
    .select('id, store_id')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Nullify order_items references (preserve order history)
  await supabase.from('order_items').update({ product_id: null }).eq('product_id', id)

  // Delete variants (FK constraint)
  await supabase.from('product_variants').delete().eq('product_id', id)

  // Delete product
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
