'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const PLANS = [
  { id: 'basic' as const, name: 'Basic', price: '₮89,900', desc: '10,000 мессеж/сар', features: ['1 хуудас', 'AI хариулт', 'Каталог', 'Захиалга'] },
  { id: 'starter' as const, name: 'Starter', price: '₮149,900', desc: '15,000 мессеж/сар', features: ['1 хуудас', 'Бүгд + Comment auto reply'] },
  { id: 'pro' as const, name: 'Pro', price: '₮249,900', desc: '30,000 мессеж/сар', popular: true, features: ['3 хуудас', 'Бүгд + Хүргэлт интеграц', 'Priority дэмжлэг'] },
]

export default function SubscriptionPage() {
  const params = useSearchParams()
  const success = params.get('success')
  const canceled = params.get('canceled')
  const [loading, setLoading] = useState<string | null>(null)

  async function checkout(plan: 'basic' | 'starter' | 'pro') {
    setLoading(plan)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else { alert(data.error || 'Алдаа гарлаа'); setLoading(null) }
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">💳 Захиалга & Төлбөр</h1>
        <p className="text-slate-400 mb-8">Stripe-аар олон улсын карт хүлээн авна. QPay-тэй хамт ашиглаж болно.</p>

        {success && <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">✅ Захиалга амжилттай!</div>}
        {canceled && <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400">⚠️ Цуцалсан. Хүсвэл дахин оролдоно уу.</div>}

        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map(p => (
            <div key={p.id} className={`rounded-2xl p-6 border ${p.popular ? 'bg-blue-500/5 border-blue-500/50 ring-2 ring-blue-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
              {p.popular && <div className="text-xs text-blue-400 font-semibold uppercase mb-2">Түгээмэл</div>}
              <h3 className="text-xl font-bold text-white">{p.name}</h3>
              <p className="text-3xl font-bold text-white mt-2">{p.price}<span className="text-sm font-normal text-slate-500">/сар</span></p>
              <p className="text-sm text-slate-400 mt-1">{p.desc}</p>
              <ul className="space-y-2 mt-4 mb-6">
                {p.features.map(f => (
                  <li key={f} className="text-sm text-slate-300 flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => checkout(p.id)}
                disabled={loading === p.id}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${p.popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'} disabled:opacity-50`}
              >
                {loading === p.id ? '...' : 'Захиалах'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          🇲🇳 Зөвхөн QPay-р мессежийн pack худалдаж авах бол <a href="/dashboard/message-usage" className="text-blue-400 underline">энд</a> дарна уу
        </div>
      </div>
    </div>
  )
}
