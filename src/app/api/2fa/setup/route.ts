import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSecret, buildOtpauthUrl, generateBackupCodes } from '@/lib/totp'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = generateSecret()
  const backupCodes = generateBackupCodes()
  const otpauthUrl = buildOtpauthUrl(secret, user.email || user.id)

  // Store secret but keep enabled=false until user verifies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('user_2fa').upsert({
    user_id: user.id,
    secret,
    enabled: false,
    backup_codes: backupCodes,
  })

  return NextResponse.json({ secret, otpauthUrl, backupCodes })
}
