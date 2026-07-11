import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyTOTP } from '@/lib/totp'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit per user to prevent brute-forcing the 6-digit TOTP / backup codes.
  const rl = await rateLimit(`2fa:${user.id}`, { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })

  const { token } = await req.json() as { token: string }
  // Accept either a 6-digit TOTP code or a backup code (format XXXX-XXXX from
  // generateBackupCodes). The old `length !== 6` guard rejected every backup code,
  // so the backup-code path below was unreachable.
  const isTotp = /^\d{6}$/.test(token || '')
  const isBackupCode = /^[0-9a-f]{4}-[0-9a-f]{4}$/i.test(token || '')
  if (!token || (!isTotp && !isBackupCode)) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from('user_2fa')
    .select('secret, backup_codes, enabled')
    .eq('user_id', user.id)
    .single()

  if (!row) return NextResponse.json({ error: '2FA not set up' }, { status: 404 })

  // Check if token is a backup code
  const isBackup = (row.backup_codes || []).includes(token.toUpperCase())
  const valid = isBackup || verifyTOTP(row.secret, token)

  if (!valid) return NextResponse.json({ error: 'Invalid code' }, { status: 401 })

  // Enable 2FA + remove used backup code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('user_2fa').update({
    enabled: true,
    last_used_at: new Date().toISOString(),
    backup_codes: isBackup ? row.backup_codes.filter((c: string) => c !== token.toUpperCase()) : row.backup_codes,
  }).eq('user_id', user.id)

  return NextResponse.json({ verified: true, usedBackup: isBackup })
}
