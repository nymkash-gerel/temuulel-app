'use client'

import { useEffect, useState } from 'react'

interface PackOption { size: number; price: number; label: string }
interface Usage { limit: number; used: number; resetAt: string }
interface Purchase { id: string; pack_size: number; price: number; status: string; created_at: string }

export default function MessageUsagePage() {
  const [packs, setPacks] = useState<PackOption[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/message-packs')
      if (res.ok) {
        const data = await res.json()
        setPacks(data.packs || [])
        setUsage(data.usage || null)
        setPurchases(data.purchases || [])
      }
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function buyPack(size: number) {
    if (!confirm(`${size} мессеж худалдаж авах уу?`)) return
    setBuying(size)
    try {
      const res = await fetch('/api/message-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_size: size }),
      })
      if (res.ok) {
        const data = await res.json()
        alert(`${data.added} мессеж нэмэгдлээ!`)
        await load()
      }
    } catch { /* */ }
    setBuying(null)
  }

  const usagePercent = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0
  const isLow = usagePercent >= 80

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">💬 Мессежийн хэрэглээ</h1>
        <p className="text-slate-400 mb-8">AI автомат хариулсан мессежийн тоо</p>

        {/* Usage bar */}
        {usage && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">
                {usage.used.toLocaleString()} / {usage.limit.toLocaleString()} мессеж
              </span>
              <span className={`text-sm ${isLow ? 'text-orange-400' : 'text-slate-400'}`}>
                {usagePercent}% ашигласан
              </span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isLow ? 'bg-orange-500' : 'bg-blue-500'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {isLow && (
              <p className="text-orange-400 text-sm mt-3">
                Мессежийн лимит дуусаж байна. Нэмэлт мессеж худалдаж авна уу!
              </p>
            )}
          </div>
        )}

        {/* Buy packs */}
        <h2 className="text-lg font-semibold text-white mb-4">Нэмэлт мессеж худалдаж авах</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {packs.map(p => (
            <button
              key={p.size}
              onClick={() => buyPack(p.size)}
              disabled={buying === p.size}
              className="bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 rounded-xl p-4 text-center transition-all disabled:opacity-50"
            >
              <p className="text-2xl font-bold text-white">{p.size.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mb-3">мессеж</p>
              <p className="text-blue-400 font-semibold">₮{p.price.toLocaleString()}</p>
              {buying === p.size && <p className="text-xs text-yellow-400 mt-2">Худалдаж авч байна...</p>}
            </button>
          ))}
        </div>

        {/* Purchase history */}
        {purchases.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-white mb-4">Худалдан авалтын түүх</h2>
            <div className="space-y-2">
              {purchases.map(p => (
                <div key={p.id} className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium">{p.pack_size.toLocaleString()} мессеж</span>
                    <span className="text-slate-500 text-sm ml-3">₮{p.price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${p.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                      {p.status === 'paid' ? 'Төлсөн' : p.status}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString('mn-MN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
