'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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

const TYPE_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  earn: { label: 'Earn', color: 'bg-green-500/20 text-green-400', sign: '+' },
  redeem: { label: 'Redeem', color: 'bg-blue-500/20 text-blue-400', sign: '-' },
  adjust: { label: 'Adjust', color: 'bg-yellow-500/20 text-yellow-400', sign: '' },
  expire: { label: 'Expire', color: 'bg-red-500/20 text-red-400', sign: '-' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LoyaltyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [transactions, setTransactions] = useState<LoyaltyTransactionRow[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState('')

  async function loadTransactions(sid: string) {
    let query = supabase
      .from('loyalty_transactions')
      .select(`
        id, store_id, customer_id, points, transaction_type, reference_type,
        reference_id, description, created_at,
        customers(id, name, phone)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (typeFilter) {
      query = query.eq('transaction_type', typeFilter)
    }

    const { data } = await query

    if (data) {
      setTransactions(data as unknown as LoyaltyTransactionRow[])
    }
  }

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
        await loadTransactions(store.id)
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storeId || loading) return
    loadTransactions(storeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter])

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
          <h1 className="text-2xl font-bold text-white">Loyalty Transactions</h1>
          <p className="text-slate-400 mt-1">{transactions.length} transactions</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Transactions</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Points Earned</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.earned.toLocaleString()}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Points Redeemed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.redeemed.toLocaleString()}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Net Points</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.netPoints.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Transaction Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
          >
            <option value="">All Types</option>
            <option value="earn">Earn</option>
            <option value="redeem">Redeem</option>
            <option value="adjust">Adjust</option>
            <option value="expire">Expire</option>
          </select>
        </div>
        {typeFilter && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setTypeFilter('')}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {transactions.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Date</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Type</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Points</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Description</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Reference</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const tc = TYPE_CONFIG[t.transaction_type] || { label: t.transaction_type, color: 'bg-slate-500/20 text-slate-400', sign: '' }
                const customerName = t.customers?.name || t.customers?.phone || '-'
                return (
                  <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDate(t.created_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{customerName}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${tc.color}`}>
                        {tc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className={`font-medium ${t.transaction_type === 'earn' ? 'text-green-400' : t.transaction_type === 'redeem' || t.transaction_type === 'expire' ? 'text-red-400' : 'text-white'}`}>
                        {tc.sign}{Math.abs(t.points).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{t.description || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm capitalize">{t.reference_type || '-'}</span>
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
            <span className="text-4xl">&#127919;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Loyalty Transactions</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {typeFilter
              ? 'No transactions match your current filter. Try adjusting the filter.'
              : 'Loyalty point transactions will appear here as customers earn and redeem points.'}
          </p>
          {typeFilter && (
            <button
              onClick={() => setTypeFilter('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
