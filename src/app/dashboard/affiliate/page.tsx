'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AffiliateStats {
  clicks: number
  signups: number
  conversions: number
  pending_commission: number
  paid_commission: number
  total_earned: number
  conversion_rate: number
}

interface AffiliateReferral {
  id: string
  referral_code: string
  referred_email?: string
  status: 'clicked' | 'signed_up' | 'converted' | 'paid'
  plan?: string
  commission_amount?: number
  created_at: string
  converted_at?: string
}

interface Payout {
  id: string
  amount: number
  status: 'pending' | 'paid'
  paid_at?: string
  created_at: string
}

export default function AffiliatePage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'overview' | 'referrals' | 'payouts' | 'marketing'>('overview')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/affiliate')
      if (res.ok) {
        const d = await res.json()
        setStats(d.stats || null)
        setReferrals(d.referrals || [])
        setPayouts(d.payouts || [])
        setShareUrl(d.shareUrl || '')
      }
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function enroll() {
    const res = await fetch('/api/affiliate', { method: 'POST' })
    if (res.ok) {
      await load()
    }
  }

  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function requestPayout() {
    const res = await fetch('/api/affiliate/payout', { method: 'POST' })
    if (res.ok) {
      await load()
      alert('Төлбөр нэхэмжлэл илгээгдлээ — 3-5 ажлын өдрийн дотор шилжүүлнэ.')
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Төлбөр нэхэмжлэх боломжгүй')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" /></div>
  }

  // Not enrolled yet
  if (!stats) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">←</Link>
          <h1 className="text-2xl font-bold text-white">💼 Affiliate партнер хөтөлбөр</h1>
        </div>

        <div className="bg-gradient-to-br from-blue-600/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">🤝</div>
          <h2 className="text-2xl font-bold text-white mb-3">Temuulel-ийн албан ёсны партнер болоорой</h2>
          <p className="text-slate-300 mb-6 max-w-xl mx-auto">
            Бизнес эрхлэгчдийг Temuulel-руу танилцуулж, тэдний төлбөрөөс <strong className="text-blue-400">20% комисс</strong> насан туршдаа ав.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-2xl mb-2">💰</div>
              <h3 className="text-white font-semibold mb-1">20% насан туршийн комисс</h3>
              <p className="text-xs text-slate-400">Уригдсан хэрэглэгч төлбөр хийх бүрд</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="text-white font-semibold mb-1">Real-time статистик</h3>
              <p className="text-xs text-slate-400">Click, conversion, орлого бүр харагдана</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-2xl mb-2">💳</div>
              <h3 className="text-white font-semibold mb-1">Сар бүрийн төлбөр</h3>
              <p className="text-xs text-slate-400">100,000₮-ээс дээш хуралдахад</p>
            </div>
          </div>
          <button
            onClick={enroll}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold"
          >
            Партнер болох
          </button>
          <p className="text-xs text-slate-500 mt-4">Ямар ч төлбөргүй — зөвхөн бүртгэл</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-white">💼 Affiliate Dashboard</h1>
          <p className="text-sm text-slate-400">Таны партнер статистик ба орлого</p>
        </div>
      </div>

      {/* Share link (sticky top) */}
      <div className="bg-gradient-to-r from-blue-600/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl p-5 mb-6">
        <p className="text-sm text-slate-300 mb-2">Таны partner холбоос:</p>
        <div className="flex gap-2">
          <input
            value={shareUrl}
            readOnly
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-sm font-mono"
          />
          <button
            onClick={copyLink}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copied ? '✓ Хуулсан' : '📋 Хуулах'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-700">
        {[
          { id: 'overview', label: '📊 Тойм' },
          { id: 'referrals', label: '👥 Урилгууд' },
          { id: 'payouts', label: '💸 Төлбөрүүд' },
          { id: 'marketing', label: '🎨 Marketing' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 ${
              tab === t.id
                ? 'text-white border-blue-500'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Click" value={stats.clicks} icon="👆" />
            <StatCard label="Бүртгүүлсэн" value={stats.signups} icon="📝" />
            <StatCard label="Төлбөр хийсэн" value={stats.conversions} icon="✅" />
            <StatCard
              label="Conversion rate"
              value={`${stats.conversion_rate.toFixed(1)}%`}
              icon="📈"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
              <p className="text-sm text-amber-400 mb-2">⏳ Хүлээгдэж буй</p>
              <p className="text-2xl font-bold text-white">{stats.pending_commission.toLocaleString('mn-MN')}₮</p>
              <p className="text-xs text-slate-500 mt-1">Дараагийн төлбөрт багтана</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
              <p className="text-sm text-emerald-400 mb-2">💰 Нийт олсон</p>
              <p className="text-2xl font-bold text-white">{stats.total_earned.toLocaleString('mn-MN')}₮</p>
              <p className="text-xs text-slate-500 mt-1">Энэ жил бүгд нийлбэр</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
              <p className="text-sm text-blue-400 mb-2">✅ Төлөгдсөн</p>
              <p className="text-2xl font-bold text-white">{stats.paid_commission.toLocaleString('mn-MN')}₮</p>
              <p className="text-xs text-slate-500 mt-1">Таны дансанд шилжсэн</p>
            </div>
          </div>

          {stats.pending_commission >= 100000 && (
            <button
              onClick={requestPayout}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold mb-6"
            >
              💸 Төлбөр нэхэмжлэх ({stats.pending_commission.toLocaleString('mn-MN')}₮)
            </button>
          )}
          {stats.pending_commission < 100000 && stats.pending_commission > 0 && (
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-slate-400 text-center mb-6">
              Төлбөр нэхэмжлэхэд дахин <strong className="text-white">{(100000 - stats.pending_commission).toLocaleString('mn-MN')}₮</strong> шаардлагатай
            </div>
          )}
        </>
      )}

      {/* Referrals tab */}
      {tab === 'referrals' && (
        <div>
          {referrals.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Одоогоор урилга байхгүй байна</div>
          ) : (
            <div className="space-y-2">
              {referrals.map(r => (
                <div key={r.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{r.referred_email || 'Нэргүй'}</span>
                      <span className="text-xs text-slate-500 font-mono">{r.referral_code}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{new Date(r.created_at).toLocaleDateString('mn-MN')}</span>
                      {r.plan && <><span>•</span><span className="text-blue-400">{r.plan}</span></>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      r.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                      r.status === 'converted' ? 'bg-blue-500/20 text-blue-400' :
                      r.status === 'signed_up' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {r.status === 'paid' ? '💰 Төлөгдсөн' :
                       r.status === 'converted' ? '✅ Конверт' :
                       r.status === 'signed_up' ? '📝 Бүртгүүлсэн' : '👆 Click'}
                    </span>
                    {r.commission_amount ? (
                      <p className="text-emerald-400 text-sm font-semibold mt-1">+{r.commission_amount.toLocaleString('mn-MN')}₮</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payouts tab */}
      {tab === 'payouts' && (
        <div>
          {payouts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Одоогоор төлбөр хийгдээгүй байна</div>
          ) : (
            <div className="space-y-2">
              {payouts.map(p => (
                <div key={p.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{p.amount.toLocaleString('mn-MN')}₮</p>
                    <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString('mn-MN')}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs rounded-full ${
                    p.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {p.status === 'paid' ? `✅ ${p.paid_at ? new Date(p.paid_at).toLocaleDateString('mn-MN') : 'Төлөгдсөн'}` : '⏳ Хүлээгдэж буй'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Marketing resources tab */}
      {tab === 'marketing' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-2">📱 Нийтлэлийн загвар — Facebook/Instagram</h3>
            <div className="bg-slate-900 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-line">
              {`🚀 Monoglyn бизнес эрхлэгчиддээ зориулсан AI чатбот — Temuulel-г туршиж үзээрэй!

✅ Facebook Messenger дээр автомат хариулна
✅ Захиалга бүрдүүлэх, төлбөр авах
✅ Монгол хэлээр 24/7 ажиллана
✅ Үнэгүй план дотор 100 мессеж

👉 ${shareUrl}`}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`🚀 Monoglyn бизнес эрхлэгчиддээ зориулсан AI чатбот — Temuulel-г туршиж үзээрэй!\n\n✅ Facebook Messenger дээр автомат хариулна\n✅ Захиалга бүрдүүлэх, төлбөр авах\n✅ Монгол хэлээр 24/7 ажиллана\n✅ Үнэгүй план дотор 100 мессеж\n\n👉 ${shareUrl}`)
              }}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm"
            >
              📋 Хуулах
            </button>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-2">✉️ Email загвар</h3>
            <div className="bg-slate-900 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-line">
              {`Сайн байна уу,

Танай бизнест AI чатбот санал болгоё — Temuulel гэдэг монголын бүтээгдэхүүн.

Юу хийдэг вэ?
• Facebook/Instagram мессежид автомат хариулна
• Захиалга авч, QPay-ээр төлбөр авна
• Таны бүтээгдэхүүн, үнэ, төлөвийг мэдэж байгаад зөв хариулна

Үнэгүй туршиж болно: ${shareUrl}`}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-2">🎨 Банн ба лого</h3>
            <p className="text-sm text-slate-400 mb-3">Албан ёсны лого, баннер файлууд:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['Logo PNG', 'Logo SVG', 'Banner 1200x628', 'Square 1080x1080'].map(name => (
                <a
                  key={name}
                  href="#"
                  className="p-3 bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-xl text-center text-xs text-slate-300 transition-all"
                >
                  📥 {name}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  )
}
