/**
 * Stock management: decrement variant quantities on order confirmation
 * and dispatch low_stock notifications when thresholds are breached.
 */
import { dispatchNotification } from '@/lib/notifications'

const DEFAULT_LOW_STOCK_THRESHOLD = 5

interface SupabaseClient {
  from: (table: string) => unknown
}

/**
 * Decrement stock for all order items with a variant_id,
 * then dispatch low_stock notifications for variants that
 * have fallen at or below the store's configured threshold.
 *
 * Safe to call multiple times — only processes items with variant_id.
 */
export async function decrementStockAndNotify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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

  // 3. Decrement each variant and check against threshold
  for (const item of items as { variant_id: string; quantity: number }[]) {
    // Fetch current stock
    const { data: variant } = await supabase
      .from('product_variants')
      .select('id, stock_quantity, product_id')
      .eq('id', item.variant_id)
      .single()

    if (!variant) continue

    const newQuantity = Math.max(0, variant.stock_quantity - item.quantity)

    // Decrement stock
    await supabase
      .from('product_variants')
      .update({ stock_quantity: newQuantity })
      .eq('id', item.variant_id)

    // 4. Check if stock fell to or below threshold
    if (newQuantity <= threshold && variant.stock_quantity > threshold) {
      // Stock just crossed the threshold — notify
      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', variant.product_id)
        .single()

      const productName = product?.name || 'Бүтээгдэхүүн'

      dispatchNotification(storeId, 'low_stock', {
        product_name: productName,
        remaining: newQuantity,
        variant_id: item.variant_id,
        product_id: variant.product_id,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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
