import { describe, it, expect, vi, beforeEach } from 'vitest'

const { supa, verifyTOTP } = vi.hoisted(() => ({
  supa: { auth: { getUser: vi.fn() }, from: vi.fn() },
  verifyTOTP: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))
vi.mock('@/lib/totp', () => ({ verifyTOTP }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }) }))

import { POST } from './route'

const BACKUP = 'A1B2-C3D4'

function wireDb(row: { secret: string; backup_codes: string[]; enabled: boolean } | null) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  supa.from.mockReturnValue({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: row }) }) }),
    update: () => ({ eq: updateEq }),
  })
  return { updateEq }
}

function req(token: unknown) {
  return { json: async () => ({ token }) } as unknown as import('next/server').NextRequest
}

describe('POST /api/2fa/verify — backup codes (#27)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    verifyTOTP.mockReturnValue(false)
  })

  it('accepts a valid backup code (previously rejected by the length guard)', async () => {
    wireDb({ secret: 'S', backup_codes: [BACKUP], enabled: false })

    const res = await POST(req(BACKUP))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.verified).toBe(true)
    expect(json.usedBackup).toBe(true)
  })

  it('accepts a valid 6-digit TOTP', async () => {
    verifyTOTP.mockReturnValue(true)
    wireDb({ secret: 'S', backup_codes: [], enabled: false })

    const res = await POST(req('123456'))
    expect(res.status).toBe(200)
    expect((await res.json()).usedBackup).toBe(false)
  })

  it('rejects a token that is neither a 6-digit code nor a backup-code format', async () => {
    const res = await POST(req('nope'))
    expect(res.status).toBe(400)
  })

  it('rejects a wrong backup code with 401', async () => {
    wireDb({ secret: 'S', backup_codes: [BACKUP], enabled: false })

    const res = await POST(req('9999-9999'))
    expect(res.status).toBe(401)
  })
})
