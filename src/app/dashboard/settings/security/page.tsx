'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Session {
  id: string
  ip_address: string | null
  user_agent: string | null
  last_active_at: string
  created_at: string
}

export default function SecurityPage() {
  const [enabled2FA, setEnabled2FA] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; backupCodes: string[] } | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadSessions() {
    const res = await fetch('/api/sessions')
    if (res.ok) {
      const data = await res.json()
      setSessions(data.sessions || [])
    }
  }

  useEffect(() => { loadSessions() }, [])

  async function startSetup() {
    setLoading(true); setError(null)
    const res = await fetch('/api/2fa/setup', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setSetup(data)
    } else { setError('Тохируулж чадсангүй') }
    setLoading(false)
  }

  async function verifyToken() {
    setLoading(true); setError(null)
    const res = await fetch('/api/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      setEnabled2FA(true)
      setSetup(null)
      setToken('')
    } else { setError('Буруу код') }
    setLoading(false)
  }

  async function disable2FA() {
    if (!confirm('2FA-г идэвхгүй болгох уу?')) return
    await fetch('/api/2fa/disable', { method: 'POST' })
    setEnabled2FA(false)
  }

  async function revokeSession(id?: string) {
    if (!confirm(id ? 'Энэ session-ыг хаах уу?' : 'Бүх session-ыг хаах уу?')) return
    const url = id ? `/api/sessions?id=${id}` : '/api/sessions'
    await fetch(url, { method: 'DELETE' })
    await loadSessions()
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard/settings" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">←</Link>
          <h1 className="text-2xl font-bold text-white">🔒 Аюулгүй байдал</h1>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

        {/* 2FA */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Хоёр шатлалт нэвтрэлт (2FA)</h2>
              <p className="text-sm text-slate-400">Google Authenticator эсвэл Authy ашиглана</p>
            </div>
            {enabled2FA ? (
              <button onClick={disable2FA} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm">Идэвхгүй болгох</button>
            ) : (
              <button onClick={startSetup} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm disabled:opacity-50">
                {loading ? '...' : 'Идэвхжүүлэх'}
              </button>
            )}
          </div>

          {setup && (
            <div className="space-y-4 mt-4 p-4 bg-slate-900/50 rounded-xl">
              <div>
                <p className="text-sm text-slate-300 mb-2">1. Authenticator апп нээгээд QR код скан хийнэ үү:</p>
                <div className="bg-white p-4 rounded inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup.otpauthUrl)}`}
                    alt="2FA QR"
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Эсвэл гараар: <code className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">{setup.secret}</code></p>
              </div>
              <div>
                <p className="text-sm text-slate-300 mb-2">2. 6 оронтой кодоо оруулна уу:</p>
                <div className="flex gap-2">
                  <input
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-center text-lg tracking-widest"
                  />
                  <button onClick={verifyToken} disabled={token.length !== 6} className="px-4 py-2 bg-blue-600 text-white rounded-xl disabled:opacity-50">Шалгах</button>
                </div>
              </div>
              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm text-yellow-400 mb-2">⚠️ Backup codes — нууц газар хадгалаарай:</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setup.backupCodes.map((c, i) => (
                    <div key={i} className="bg-slate-800 px-3 py-2 rounded">{c}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">🖥️ Идэвхтэй sessions</h2>
              <p className="text-sm text-slate-400">{sessions.length} төхөөрөмжөөс нэвтэрсэн</p>
            </div>
            {sessions.length > 0 && (
              <button onClick={() => revokeSession()} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm">
                Бүгдийг хаах
              </button>
            )}
          </div>
          {sessions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Session байхгүй</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{s.user_agent?.substring(0, 80) || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">
                      {s.ip_address || '?'} • Сүүлд: {new Date(s.last_active_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                  <button onClick={() => revokeSession(s.id)} className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded">Хаах</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
