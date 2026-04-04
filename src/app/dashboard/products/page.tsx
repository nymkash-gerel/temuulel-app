import { createClient } from '@/lib/supabase/server'
import { resolveStore } from '@/lib/resolve-store'
import { redirect } from 'next/navigation'
import ProductsClient from './products-client'

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await resolveStore(supabase, user.id)
  const storeId = store?.id ?? ''
  if (!storeId) redirect('/onboarding')

  // Get products with variants
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      product_variants(*)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  // Get subscription for limits
  const { data: subscription } = await supabase
    .from('store_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('store_id', storeId)
    .single()

  const productLimit = (subscription?.subscription_plans?.limits as Record<string, number> | undefined)?.products || 20

  return <ProductsClient products={products || []} productLimit={productLimit} />
}
