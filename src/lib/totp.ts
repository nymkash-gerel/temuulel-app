/**
 * TOTP (Time-based One-Time Password) — RFC 6238
 * Compatible with Google Authenticator, Authy, 1Password etc.
 *
 * No external deps — uses Node crypto.
 */
import crypto from 'crypto'

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateSecret(length = 20): string {
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    result += BASE32_CHARS[bytes[i] % 32]
  }
  return result
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').toUpperCase()
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const c of clean) {
    const i = BASE32_CHARS.indexOf(c)
    if (i < 0) continue
    buffer = (buffer << 5) | i
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

export function generateTOTP(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / 30)
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter & 0xffffffff, 4)
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1_000_000
  return code.toString().padStart(6, '0')
}

/**
 * Verify TOTP with ±1 step tolerance (30s window)
 */
export function verifyTOTP(secret: string, token: string): boolean {
  const now = Date.now()
  for (const offset of [-30000, 0, 30000]) {
    if (generateTOTP(secret, now + offset) === token) return true
  }
  return false
}

export function buildOtpauthUrl(secret: string, account: string, issuer = 'Temuulel'): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params}`
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-')
  })
}
