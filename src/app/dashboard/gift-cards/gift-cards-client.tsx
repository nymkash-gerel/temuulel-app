'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'

interface GiftCardRow {
  id: string
  store_id: string
  code: string
  initial_balance: number
  current_balance: number
  customer_id: string | null
  status: string
  expires_at: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null; phone: string | null } | null
}

interface NewGiftCard {
  code: string
  initial_balance: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  active:   { label: 'Идэвхтэй',       dot: 'bg-emerald-400',bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-l-emerald-500' },
  redeemed: { label: 'Ашигласан',        dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-l-blue-500' },
  expired:  { label: 'Хугацаа дууссан',  dot: 'bg-slate-400',  bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-l-slate-500' },
  disabled: { label: 'Идэвхгүй',        dot: 'bg-red-400',    bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-l-red-500' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('mn-MN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'GC-'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

interface GiftCardsClientProps {
  initialGiftCards: GiftCardRow[]
  storeId: string
}

export default function GiftCardsClient({ initialGiftCards, storeId }: GiftCardsClientProps) {
  const supabase = useMemo(() => createClient(), [])

  const [giftCards, setGiftCards] = useState<GiftCardRow[]>(initialGiftCards)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [form, setForm] = useState<NewGiftCard>({
    code: generateCode(),
    initial_balance: '',
  })

  const loadGiftCards = useCallback(async () => {
    let query = supabase
      .from('gift_cards')
      .select(`
        id, store_id, code, initial_balance, current_balance, customer_id,
        status, expires_at, created_at, updated_at,
        customers(id, name, phone)
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    if (data) {
      setGiftCards(data as unknown as GiftCardRow[])
    }
  }, [supabase, storeId, statusFilter])

  const handleFilterChange = async (value: string) => {
    setStatusFilter(value)
    let query = supabase
      .from('gift_cards')
      .select(`
        id, store_id, code, initial_balance, current_balance, customer_id,
        status, expires_at, created_at, updated_at,
        customers(id, name, phone)
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (value) {
      query = query.eq('status', value)
    }

    const { data } = await query
    if (data) {
      setGiftCards(data as unknown as GiftCardRow[])
    }
  }

  const stats = useMemo(() => {
    const total = giftCards.length
    const active = giftCards.filter(g => g.status === 'active').length
    const totalValue = giftCards.reduce((sum, g) => sum + g.initial_balance, 0)
    const currentValue = giftCards.filter(g => g.status === 'active').reduce((sum, g) => sum + g.current_balance, 0)
    return { total, active, totalValue, currentValue }
  }, [giftCards])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const balance = parseFloat(form.initial_balance)
      const { error: insertError } = await supabase
        .from('gift_cards')
        .insert({
          store_id: storeId,
          code: form.code,
          initial_balance: balance,
          current_balance: balance,
        })

      if (insertError) throw insertError

      await loadGiftCards()
      setShowForm(false)
      setForm({ code: generateCode(), initial_balance: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create gift card')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Бэлгийн карт</h1>
          <p className="text-slate-500 mt-1 text-sm">Нийт {giftCards.length} карт</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-pink-500/20"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Шинэ карт
          </span>
        </button>
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
          { label: 'Нийт карт', value: stats.total, gradient: 'from-slate-500/20 to-slate-600/5' },
          { label: 'Идэвхтэй', value: stats.active, gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Нийт дүн', value: null, display: formatPrice(stats.totalValue), gradient: 'from-purple-500/20 to-purple-600/5' },
          { label: 'Идэвхтэй үлдэгдэл', value: null, display: formatPrice(stats.currentValue), gradient: 'from-blue-500/20 to-blue-600/5' },
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

      {/* Create Form */}
      {showForm && (
        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Шинэ бэлгийн карт</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Картын код *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="GC-ABCD1234"
                    className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-pink-500/10 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, code: generateCode() })}
                    className="px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 rounded-xl transition-all text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Үлдэгдэл *</label>
                <input
                  type="number"
                  value={form.initial_balance}
                  onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-pink-500/10 transition-all"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl transition-all text-sm"
              >
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-medium rounded-xl disabled:opacity-50 transition-all text-sm shadow-lg shadow-pink-500/20"
              >
                {saving ? 'Үүсгэж байна...' : 'Үүсгэх'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]"
        >
          <option value="">Бүх төлөв</option>
          <option value="active">Идэвхтэй</option>
          <option value="redeemed">Ашигласан</option>
          <option value="expired">Хугацаа дууссан</option>
          <option value="disabled">Идэвхгүй</option>
        </select>
        {statusFilter && (
          <button onClick={() => handleFilterChange('')}
            className="px-3 py-2.5 text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      {giftCards.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(120px,1.2fr)_minmax(90px,0.9fr)_minmax(80px,0.7fr)_minmax(110px,1fr)_minmax(80px,0.7fr)_minmax(80px,0.7fr)_minmax(80px,0.7fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Код</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Харилцагч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Анхны дүн</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Үлдэгдэл</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Хугацаа</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төлөв</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Огноо</p>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/[0.04]">
            {giftCards.map((card) => {
              const sc = STATUS_CONFIG[card.status] || { label: card.status, dot: 'bg-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500' }
              const usedPercent = card.initial_balance > 0
                ? ((card.initial_balance - card.current_balance) / card.initial_balance) * 100
                : 0
              const isExpanded = expandedId === card.id

              return (
                <div key={card.id}>
                  {/* Desktop Row */}
                  <div className={`hidden md:grid grid-cols-[minmax(120px,1.2fr)_minmax(90px,0.9fr)_minmax(80px,0.7fr)_minmax(110px,1fr)_minmax(80px,0.7fr)_minmax(80px,0.7fr)_minmax(80px,0.7fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors group border-l-2 ${sc.border}`}>
                    <div>
                      <span className="text-white text-sm font-mono font-medium">{card.code}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-300 text-sm truncate">{card.customers?.name || card.customers?.phone || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-sm">{formatPrice(card.initial_balance)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{formatPrice(card.current_balance)}</span>
                      </div>
                      <div className="w-full max-w-[80px] bg-white/[0.06] rounded-full h-1 mt-1">
                        <div
                          className={`h-1 rounded-full transition-all ${usedPercent > 80 ? 'bg-red-400' : usedPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.max(100 - usedPercent, 2)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">
                        {card.expires_at ? new Date(card.expires_at).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600 text-xs">
                        {new Date(card.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : card.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left border-l-2 ${sc.border}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono font-medium">{card.code}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">{card.customers?.name || '—'}</p>
                      </div>
                      <span className="text-white text-sm font-medium shrink-0">{formatPrice(card.current_balance)}</span>
                      <svg className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2 bg-white/[0.02]">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Анхны дүн</p>
                            <p className="text-slate-300">{formatPrice(card.initial_balance)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Хугацаа</p>
                            <p className="text-slate-400">{card.expires_at ? formatDate(card.expires_at) : 'Хязгааргүй'}</p>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-600">Ашигласан</span>
                            <span className="text-slate-400">{Math.round(usedPercent)}%</span>
                          </div>
                          <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${usedPercent > 80 ? 'bg-red-400' : usedPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${Math.max(100 - usedPercent, 2)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-slate-600 text-xs">{formatDate(card.created_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
            <span className="text-slate-600 text-xs">{giftCards.length} карт</span>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Бэлгийн карт байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            {statusFilter
              ? 'Шүүлтүүрт тохирох карт олдсонгүй'
              : 'Бэлгийн карт үүсгэж харилцагчдадаа бэлэглээрэй'}
          </p>
          {statusFilter ? (
            <button
              onClick={() => handleFilterChange('')}
              className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-pink-500/20 transition-all hover:from-pink-500 hover:to-rose-400"
            >
              Эхний карт үүсгэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
