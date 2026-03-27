/**
 * Format a price in Mongolian Tugrik (₮).
 *
 * Handles `null` / `undefined` gracefully so callers don't need to guard.
 */
export function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '0₮'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}
