/**
 * Format a price in Mongolian Tugrik (₮).
 *
 * Handles `null` / `undefined` gracefully so callers don't need to guard.
 */
export function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '0₮'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

/** Mongolian labels for the order status enum. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж буй',
  shipped: 'Илгээсэн',
  delivered: 'Хүргэсэн',
  cancelled: 'Цуцлагдсан',
}

/**
 * Mongolian label for an order status, falling back to the raw value for
 * statuses this map doesn't cover (delivery/appointment enums reuse it).
 */
export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status
}
