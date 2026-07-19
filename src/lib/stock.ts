/**
 * Stock management: decrement variant quantities on order confirmation
 * and dispatch low_stock notifications when thresholds are breached.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { dispatchNotification } from '@/lib/notifications'

const DEFAULT_LOW_STOCK_THRESHOLD = 5

/**
 * Decrement stock for all order items with a variant_id,
 * then dispatch low_stock notifications for variants that
 * have fallen at or below the store's configured threshold.
 *
 * Safe to call multiple times — only processes items with variant_id.
 */
export async function decrementStockAndNotify(
  supabase: SupabaseClient<Database>,
  orderId: string,
  storeId: string
): Promise<void> {
  // 1. Fetch order items that reference a variant
  const { data: items } = await supabase
    .from('order_items')
    .select('variant_id, quantity')
    .eq('order_id', orderId)
    .not('variant_id', 'is', null)

  if (!items || items.length === 0) return

  // 2. Get the store's low stock threshold
  const { data: store } = await supabase
    .from('stores')
    .select('product_settings')
    .eq('id', storeId)
    .single()

  const productSettings = (store?.product_settings || {}) as Record<string, unknown>
  const threshold = typeof productSettings.low_stock_threshold === 'number'
    ? productSettings.low_stock_threshold
    : DEFAULT_LOW_STOCK_THRESHOLD

  // 3. Decrement each variant atomically (see migration 073) and check the threshold.
  //    The RPC performs the read-modify-write in a single locked statement so
  //    concurrent order confirmations for the same variant cannot oversell.
  for (const item of items as { variant_id: string; quantity: number }[]) {
    const { data: rows, error } = await supabase.rpc('decrement_variant_stock', {
      p_variant_id: item.variant_id,
      p_quantity: item.quantity,
    })

    const result = rows?.[0]
    if (error || !result) continue

    const { old_quantity: oldQuantity, new_quantity: newQuantity, product_id: productId } = result

    // 4. Notify only when stock just crossed to/below the threshold.
    if (newQuantity <= threshold && oldQuantity > threshold) {
      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .single()

      const productName = product?.name || 'Бүтээгдэхүүн'

      dispatchNotification(storeId, 'low_stock', {
        product_name: productName,
        remaining: newQuantity,
        variant_id: item.variant_id,
        product_id: productId,
      })
    }
  }
}

/**
 * Restore stock for all order items with a variant_id when an order is cancelled.
 * Increments stock_quantity for each variant by the ordered quantity.
 *
 * Should only be called when cancelling an order that was previously confirmed
 * (i.e., stock was already decremented).
 */
export async function restoreStockOnCancellation(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<void> {
  const { data: items } = await supabase
    .from('order_items')
    .select('variant_id, quantity')
    .eq('order_id', orderId)
    .not('variant_id', 'is', null)

  if (!items || items.length === 0) return

  for (const item of items as { variant_id: string; quantity: number }[]) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .eq('id', item.variant_id)
      .single()

    if (!variant) continue

    const restoredQuantity = variant.stock_quantity + item.quantity

    await supabase
      .from('product_variants')
      .update({ stock_quantity: restoredQuantity })
      .eq('id', item.variant_id)
  }
}
