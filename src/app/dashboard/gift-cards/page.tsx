'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
  redeemed: { label: 'Redeemed', color: 'bg-blue-500/20 text-blue-400' },
  expired: { label: 'Expired', color: 'bg-slate-500/20 text-slate-400' },
  disabled: { label: 'Disabled', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'GC-'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default function GiftCardsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [giftCards, setGiftCards] = useState<GiftCardRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewGiftCard>({
    code: generateCode(),
    initial_balance: '',
  })

  const loadGiftCards = useCallback(async (sid: string) => {
    let query = supabase
      .from('gift_cards')
      .select(`
        id, store_id, code, initial_balance, current_balance, customer_id,
        status, expires_at, created_at, updated_at,
        customers(id, name, phone)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query

    if (data) {
      setGiftCards(data as unknown as GiftCardRow[])
    }
  }, [supabase, statusFilter])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        await loadGiftCards(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadGiftCards])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadGiftCards(storeId) }
    reload()
  }, [statusFilter, storeId, loading, loadGiftCards])

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

      await loadGiftCards(storeId)
      setShowForm(false)
      setForm({ code: generateCode(), initial_balance: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create gift card')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Gift Cards</h1>
          <p className="text-slate-400 mt-1">{giftCards.length} gift cards</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> New Gift Card
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Cards</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active Cards</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Total Value Issued</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalValue)}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Current Balance</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.currentValue)}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Gift Card</h2>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Card Code *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. GC-ABCD1234"
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, code: generateCode() })}
                    className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all text-sm"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Balance *</label>
                <input
                  type="number"
                  value={form.initial_balance}
                  onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Gift Card'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        {statusFilter && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setStatusFilter('')}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {giftCards.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Code</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Initial</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Balance</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Expires</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Created</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {giftCards.map((card) => {
                const sc = STATUS_CONFIG[card.status] || { label: card.status, color: 'bg-slate-500/20 text-slate-400' }
                const customerName = card.customers?.name || card.customers?.phone || '-'
                const usedPercent = card.initial_balance > 0
                  ? ((card.initial_balance - card.current_balance) / card.initial_balance) * 100
                  : 0
                return (
                  <tr key={card.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-mono font-medium">{card.code}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{customerName}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{formatPrice(card.initial_balance)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(card.current_balance)}</span>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${100 - usedPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{card.expires_at ? formatDate(card.expires_at) : 'No expiry'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDate(card.created_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#127876;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Gift Cards</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter
              ? 'No gift cards match your current filter. Try adjusting the filter.'
              : 'Create gift cards to offer your customers as a gift or promotional tool.'}
          </p>
          {statusFilter ? (
            <button
              onClick={() => setStatusFilter('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filter
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
            >
              <span>+</span> Create First Gift Card
            </button>
          )}
        </div>
      )}
    </div>
  )
}
