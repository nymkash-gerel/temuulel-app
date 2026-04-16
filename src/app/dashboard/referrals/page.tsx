'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Referral {
  id: string
  referral_code: string
  status: string
  created_at: string
  reward_months: number
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [shareUrl, setShareUrl] = useState('')
  const [stats, setStats] = useState<{ total: number; rewarded: number; monthsEarned: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/referrals')
    if (res.ok) {
      const d = await res.json()
      setReferrals(d.referrals || [])
      setStats(d.stats || null)
      if (d.referrals?.[0]) {
        const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
        setShareUrl(`${appUrl}/signup?ref=${d.referrals[0].referral_code}`)
      }
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function generate() {
    const res = await fetch('/api/referrals', { method: 'POST' })
    if (res.ok) {
      const d = await res.json()
      setShareUrl(d.shareUrl)
      await load()
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" /></div>

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">🎁 Найз урих</h1>
        <p className="text-slate-400 mb-4">Найз бизнес урихад тус бүр 1 сар үнэгүй</p>

        <Link
          href="/dashboard/affiliate"
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-gradient-to-r from-blue-600/20 to-cyan-500/20 border border-blue-500/30 hover:border-blue-500 rounded-xl text-sm text-blue-300 hover:text-white transition-all"
        >
          💼 Илүү их орлого хүсвэл Affiliate партнер болоорой (20% комисс) →
        </Link>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-blue-400">{stats?.total || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Нийт уригдсан</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-emerald-400">{stats?.rewarded || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Идэвхжсэн</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-purple-400">{stats?.monthsEarned || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Хэмнэсэн сар</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Таны уриалгын холбоос</h3>
          {shareUrl ? (
            <div className="flex gap-2">
              <input
                value={shareUrl}
                readOnly
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-sm font-mono"
              />
              <button onClick={copyLink} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {copied ? '✓ Хууллаа' : '📋 Хуулах'}
              </button>
            </div>
          ) : (
            <button onClick={generate} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium">
              Холбоос үүсгэх
            </button>
          )}
          <p className="text-xs text-slate-500 mt-3">Найздаа энэ холбоос илгээнэ. Бүртгүүлбэл та 2-улаа 1 сар free!</p>
        </div>

        {referrals.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Уриалгын түүх</h3>
            <div className="space-y-2">
              {referrals.map(r => (
                <div key={r.id} className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-white font-mono">{r.referral_code}</span>
                    <span className="text-xs text-slate-500 ml-3">{new Date(r.created_at).toLocaleDateString('mn-MN')}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    r.status === 'rewarded' ? 'bg-emerald-500/20 text-emerald-400' :
                    r.status === 'signed_up' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {r.status === 'rewarded' ? '🎁 Шагнал авсан' : r.status === 'signed_up' ? '✅ Бүртгүүлсэн' : '⏳ Хүлээж буй'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
