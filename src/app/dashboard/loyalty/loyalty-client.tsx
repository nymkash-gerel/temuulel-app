'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LoyaltyTransactionRow {
  id: string
  store_id: string
  customer_id: string | null
  points: number
  transaction_type: string
  reference_type: string | null
  reference_id: string | null
  description: string | null
  created_at: string
  customers: { id: string; name: string | null; phone: string | null } | null
}

const TYPE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string; sign: string }> = {
  earn:   { label: 'Цуглуулсан', dot: 'bg-emerald-400',bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-l-emerald-500', sign: '+' },
  redeem: { label: 'Ашигласан',  dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-l-blue-500',    sign: '-' },
  adjust: { label: 'Тохируулга', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-l-yellow-500',  sign: '' },
  expire: { label: 'Хугацаа дууссан', dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500', sign: '-' },
}

interface LoyaltyClientProps {
  initialTransactions: LoyaltyTransactionRow[]
  storeId: string
}

export default function LoyaltyClient({ initialTransactions, storeId }: LoyaltyClientProps) {
  const supabase = useMemo(() => createClient(), [])

  const [transactions, setTransactions] = useState<LoyaltyTransactionRow[]>(initialTransactions)
  const [typeFilter, setTypeFilter] = useState('')
  const [error] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadTransactions = useCallback(async () => {
    let query = supabase
      .from('loyalty_transactions')
      .select(`
        id, store_id, customer_id, points, transaction_type, reference_type,
        reference_id, description, created_at,
        customers(id, name, phone)
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (typeFilter) {
      query = query.eq('transaction_type', typeFilter)
    }

    const { data } = await query
    if (data) {
      setTransactions(data as unknown as LoyaltyTransactionRow[])
    }
  }, [supabase, storeId, typeFilter])

  useEffect(() => {
    if (typeFilter) {
      loadTransactions()
    }
  }, [typeFilter, loadTransactions])

  const stats = useMemo(() => {
    const total = transactions.length
    const earned = transactions.filter(t => t.transaction_type === 'earn').reduce((sum, t) => sum + t.points, 0)
    const redeemed = transactions.filter(t => t.transaction_type === 'redeem').reduce((sum, t) => sum + Math.abs(t.points), 0)
    const netPoints = transactions.reduce((sum, t) => {
      if (t.transaction_type === 'earn') return sum + t.points
      if (t.transaction_type === 'redeem' || t.transaction_type === 'expire') return sum - Math.abs(t.points)
      return sum + t.points
    }, 0)
    return { total, earned, redeemed, netPoints }
  }, [transactions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Урамшууллын оноо</h1>
          <p className="text-slate-500 mt-1 text-sm">Нийт {transactions.length} гүйлгээ</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Нийт гүйлгээ', value: stats.total, gradient: 'from-slate-500/20 to-slate-600/5' },
          { label: 'Цуглуулсан оноо', value: null, display: stats.earned.toLocaleString(), gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Ашигласан оноо', value: null, display: stats.redeemed.toLocaleString(), gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Цэвэр оноо', value: null, display: stats.netPoints.toLocaleString(), gradient: 'from-purple-500/20 to-purple-600/5' },
        ].map((stat) => (
          <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1.5 relative">
              {stat.value !== null ? stat.value : stat.display}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]"
        >
          <option value="">Бүх төрөл</option>
          <option value="earn">Цуглуулсан</option>
          <option value="redeem">Ашигласан</option>
          <option value="adjust">Тохируулга</option>
          <option value="expire">Хугацаа дууссан</option>
        </select>
        {typeFilter && (
          <button onClick={() => setTypeFilter('')}
            className="px-3 py-2.5 text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      {transactions.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(80px,0.8fr)_minmax(100px,1fr)_minmax(80px,0.7fr)_minmax(70px,0.6fr)_minmax(140px,1.5fr)_minmax(80px,0.7fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Огноо</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Харилцагч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төрөл</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Оноо</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Тайлбар</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Лавлагаа</p>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/[0.04]">
            {transactions.map((t) => {
              const tc = TYPE_CONFIG[t.transaction_type] || { label: t.transaction_type, dot: 'bg-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500', sign: '' }
              const isExpanded = expandedId === t.id

              return (
                <div key={t.id}>
                  {/* Desktop Row */}
                  <div className={`hidden md:grid grid-cols-[minmax(80px,0.8fr)_minmax(100px,1fr)_minmax(80px,0.7fr)_minmax(70px,0.6fr)_minmax(140px,1.5fr)_minmax(80px,0.7fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors border-l-2 ${tc.border}`}>
                    <div>
                      <span className="text-slate-400 text-xs">
                        {new Date(t.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-300 text-sm truncate">{t.customers?.name || t.customers?.phone || '—'}</p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${tc.bg} ${tc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />
                        {tc.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold text-sm ${t.transaction_type === 'earn' ? 'text-emerald-400' : t.transaction_type === 'redeem' || t.transaction_type === 'expire' ? 'text-red-400' : 'text-white'}`}>
                        {tc.sign}{Math.abs(t.points).toLocaleString()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-400 text-sm truncate">{t.description || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600 text-xs">{t.reference_type || '—'}</span>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left border-l-2 ${tc.border}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 text-sm">{t.customers?.name || t.customers?.phone || '—'}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${tc.bg} ${tc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />
                            {tc.label}
                          </span>
                        </div>
                        <p className="text-slate-600 text-xs mt-0.5">
                          {new Date(t.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`font-semibold text-sm shrink-0 ${t.transaction_type === 'earn' ? 'text-emerald-400' : t.transaction_type === 'redeem' || t.transaction_type === 'expire' ? 'text-red-400' : 'text-white'}`}>
                        {tc.sign}{Math.abs(t.points).toLocaleString()}
                      </span>
                      <svg className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-1 bg-white/[0.02]">
                        {t.description && <p className="text-slate-400 text-xs">{t.description}</p>}
                        {t.reference_type && <p className="text-slate-600 text-xs">Лавлагаа: {t.reference_type}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
            <span className="text-slate-600 text-xs">{transactions.length} гүйлгээ</span>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Гүйлгээ байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            {typeFilter
              ? 'Шүүлтүүрт тохирох гүйлгээ олдсонгүй'
              : 'Харилцагчид оноо цуглуулж, ашиглах үед энд харагдана'}
          </p>
          {typeFilter && (
            <button
              onClick={() => setTypeFilter('')}
              className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
