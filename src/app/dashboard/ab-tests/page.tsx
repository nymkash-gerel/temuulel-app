'use client'

import { useEffect, useState } from 'react'

interface Test {
  id: string
  name: string
  variant_a: Record<string, unknown>
  variant_b: Record<string, unknown>
  status: string
  created_at: string
  stats: {
    a: { impressions: number; conversions: number; rate: number }
    b: { impressions: number; conversions: number; rate: number }
    winner: 'a' | 'b' | 'tie' | null
  }
}

export default function ABTestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [vA, setVA] = useState('')
  const [vB, setVB] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/ab-tests')
    if (res.ok) setTests((await res.json()).tests || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    await fetch('/api/ab-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, variant_a: { text: vA }, variant_b: { text: vB } }),
    })
    setShow(false); setName(''); setVA(''); setVB('')
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">🧪 A/B Тест</h1>
          <button onClick={() => setShow(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm">+ Шинэ тест</button>
        </div>

        {show && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
            <h3 className="text-white font-medium mb-4">Шинэ A/B тест</h3>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Welcome message тест" className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <textarea value={vA} onChange={e => setVA(e.target.value)} placeholder="Variant A текст" rows={3} className="px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm resize-none" />
              <textarea value={vB} onChange={e => setVB(e.target.value)} placeholder="Variant B текст" rows={3} className="px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={create} disabled={!name.trim() || !vA.trim() || !vB.trim()} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm disabled:opacity-50">Үүсгэх</button>
              <button onClick={() => setShow(false)} className="px-5 py-2 bg-slate-700 text-white rounded-xl text-sm">Болих</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" /></div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-2xl">
            <div className="text-5xl mb-3">🧪</div>
            <p className="text-slate-400">Тест байхгүй. Variant A vs B үүсгээд харна уу!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(t => (
              <div key={t.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">{t.name}</h3>
                  {t.stats.winner && (
                    <span className={`px-3 py-1 text-xs rounded-full ${t.stats.winner === 'tie' ? 'bg-slate-600 text-slate-200' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {t.stats.winner === 'tie' ? 'Тэнцсэн' : `Variant ${t.stats.winner.toUpperCase()} ялсан`}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['a', 'b'] as const).map(v => (
                    <div key={v} className={`p-3 rounded-xl ${t.stats.winner === v ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-900/50'}`}>
                      <p className="text-xs text-slate-500 mb-1">Variant {v.toUpperCase()}</p>
                      <p className="text-sm text-slate-300 mb-2">"{(v === 'a' ? t.variant_a : t.variant_b).text as string}"</p>
                      <div className="text-xs text-slate-400">
                        {t.stats[v].impressions} харсан → {t.stats[v].conversions} конверс
                        <span className="ml-2 text-emerald-400 font-medium">{(t.stats[v].rate * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
