'use client'

import { useEffect, useState } from 'react'

interface ChurnData {
  buckets: { active: number; at_risk: number; churned: number }
  atRiskCustomers: { id: string; name: string; daysSince: number; lifetimeValue: number; messenger_id: string | null }[]
  suggestion: string
}

export default function ChurnPage() {
  const [data, setData] = useState<ChurnData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/churn').then(r => r.ok ? r.json() : null).then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" /></div>
  if (!data) return <div className="p-6 text-slate-400">No data</div>

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">📉 Идэвхгүй харилцагчид (Churn)</h1>
        <p className="text-slate-400 mb-8">Алгасуулсан харилцагчдыг буцаахын тулд эхлээд тэдэнд хямдрал илгээ</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-emerald-400">{data.buckets.active}</p>
            <p className="text-sm text-slate-400 mt-1">🟢 Идэвхтэй (&lt;30 хоног)</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-yellow-400">{data.buckets.at_risk}</p>
            <p className="text-sm text-slate-400 mt-1">🟡 Эрсдэлтэй (30-90)</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-red-400">{data.buckets.churned}</p>
            <p className="text-sm text-slate-400 mt-1">🔴 Алгасуулсан (&gt;90)</p>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <p className="text-blue-300 text-sm">💡 {data.suggestion}</p>
        </div>

        {data.atRiskCustomers.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-white font-medium">Эрсдэлтэй харилцагчид (LTV-ээр эрэмбэлсэн)</h3>
            </div>
            <div className="divide-y divide-slate-700">
              {data.atRiskCustomers.slice(0, 20).map(c => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.daysSince} хоног идэвхгүй • LTV: ₮{c.lifetimeValue.toLocaleString()}</p>
                  </div>
                  {c.messenger_id && (
                    <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">Messenger</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
