import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { driverLocationSchema } from '@/lib/validations'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = driverLocationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid' }, { status: 400 })
  }

  const { lat, lng } = parsed.data
  const { error } = await supabase
    .from('delivery_drivers')
    .update({
      current_location: JSON.parse(JSON.stringify({ lat, lng, updated_at: new Date().toISOString() })),
    })
    .eq('id', auth.driver.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
