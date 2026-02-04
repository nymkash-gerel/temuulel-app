import type { Json } from '@/lib/database.types'

/**
 * Cast validated data to the Supabase Json column type.
 *
 * Supabase generates a recursive `Json` union that TypeScript won't accept
 * from narrower types like `string[]` or `Record<string, unknown>`.
 * This helper centralises the single `as Json` assertion so call-sites stay
 * clean and grep-able.
 */
export function toJson(value: unknown): Json {
  return value as Json
}
