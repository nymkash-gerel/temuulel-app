import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const DRIVER_EMAIL_DOMAIN = 'driver.temuulel.mn'

/**
 * Convert a phone number to a synthetic email for driver auth.
 * Format: {cleaned_phone}@driver.temuulel.mn
 *
 * This avoids needing SMS OTP setup — drivers log in with phone + password
 * but under the hood Supabase uses email + password auth.
 */
export function phoneToDriverEmail(phone: string): string {
  const cleaned = phone.replace(/\D/g, '').replace(/^976/, '')
  return `${cleaned}@${DRIVER_EMAIL_DOMAIN}`
}

/**
 * Extract phone number from a synthetic driver email.
 * Returns null if the email doesn't match the driver pattern.
 */
export function driverEmailToPhone(email: string): string | null {
  const match = email.match(new RegExp(`^(\\d+)@${DRIVER_EMAIL_DOMAIN.replace('.', '\\.')}$`))
  return match ? match[1] : null
}

/**
 * Check if an email belongs to a driver account.
 */
export function isDriverEmail(email: string): boolean {
  return email.endsWith(`@${DRIVER_EMAIL_DOMAIN}`)
}

type DriverRow = Database['public']['Tables']['delivery_drivers']['Row']

/**
 * Get the authenticated driver record from a Supabase server client.
 * Returns the user + driver record, or null if not authenticated or not a driver.
 */
export async function getAuthenticatedDriver(
  supabase: SupabaseClient<Database>
): Promise<{ user: { id: string; email?: string }; driver: DriverRow } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: driver } = await supabase
    .from('delivery_drivers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!driver) return null

  return { user: { id: user.id, email: user.email }, driver }
}
