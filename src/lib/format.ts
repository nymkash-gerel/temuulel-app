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
  // hasOwnProperty, not a bare lookup: a status of 'toString' or 'constructor'
  // would otherwise resolve to an inherited Object.prototype member and return
  // a function where the signature promises a string. This helper is shared
  // with delivery/appointment statuses, which don't come from the order enum.
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS_LABELS, status)
    ? ORDER_STATUS_LABELS[status]
    : status
}
