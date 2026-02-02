import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * POST /api/driver/deliveries/:id/upload-proof
 *
 * Upload a delivery proof photo. Accepts multipart/form-data with a "file" field.
 * Stores in Supabase Storage "delivery-proofs" bucket.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rl = rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth

  // Verify delivery belongs to driver
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, status')
    .eq('id', id)
    .eq('driver_id', driver.id)
    .single()

  if (!delivery) {
    return NextResponse.json({ error: 'Хүргэлт олдсонгүй' }, { status: 404 })
  }

  // Parse form data
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Зураг оруулна уу' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Зөвхөн JPEG, PNG, WebP зураг зөвшөөрнө' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Зургийн хэмжээ 10MB-с хэтэрсэн' }, { status: 400 })
  }

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('delivery-proofs')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('delivery-proofs')
    .getPublicUrl(filePath)

  const publicUrl = urlData.publicUrl

  // Update delivery record
  await supabase
    .from('deliveries')
    .update({ proof_photo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ url: publicUrl })
}
