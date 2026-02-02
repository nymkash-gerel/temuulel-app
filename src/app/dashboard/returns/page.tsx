'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ReturnRequest {
  id: string
  return_number: string
  return_type: 'full' | 'partial'
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  reason: string | null
  refund_amount: number | null
  handled_by: string | null
  created_at: string
  orders: { id: string; order_number: string; total_amount: number } | null
  customers: { id: string; name: string | null; phone: string | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-blue-500/20 text-blue-400', icon: '✅' },
  rejected: { label: 'Татгалзсан', color: 'bg-red-500/20 text-red-400', icon: '❌' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400', icon: '✓' },
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function ReturnsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        const { data } = await supabase
          .from('return_requests')
          .select(`
            id, return_number, return_type, status, reason, refund_amount,
            handled_by, created_at,
            orders(id, order_number, total_amount),
            customers(id, name, phone)
          `)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })

        if (data) {
          setReturns(data as unknown as ReturnRequest[])
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = returns

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r =>
        r.return_number.toLowerCase().includes(q) ||
        r.orders?.order_number?.toLowerCase().includes(q) ||
        r.customers?.name?.toLowerCase().includes(q) ||
        r.customers?.phone?.includes(q)
      )
    }

    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter)
    }

    return result
  }, [returns, search, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Буцаалт</h1>
          <p className="text-slate-400 mt-1">
            Нийт {returns.length} буцаалт
            {filtered.length !== returns.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Буцаалтын дугаар, захиалга, харилцагч хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="pending">Хүлээгдэж буй</option>
              <option value="approved">Зөвшөөрсөн</option>
              <option value="rejected">Татгалзсан</option>
              <option value="completed">Дууссан</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">
            {returns.filter(r => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Зөвшөөрсөн</p>
          <p className="text-2xl font-bold text-white mt-1">
            {returns.filter(r => r.status === 'approved').length}
          </p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">
            {returns.filter(r => r.status === 'completed').length}
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Татгалзсан</p>
          <p className="text-2xl font-bold text-white mt-1">
            {returns.filter(r => r.status === 'rejected').length}
          </p>
        </div>
      </div>

      {/* Returns Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Буцаалт</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалга</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Буцаах дүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хариуцсан</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ret) => {
                const sc = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending
                return (
                  <tr key={ret.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">#{ret.return_number}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {ret.orders ? (
                        <Link href={`/dashboard/orders/${ret.orders.id}`} className="text-blue-400 hover:text-blue-300 transition-all">
                          #{ret.orders.order_number}
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white">{ret.customers?.name || 'N/A'}</p>
                        <p className="text-slate-400 text-sm">{ret.customers?.phone || ''}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        ret.return_type === 'full' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {ret.return_type === 'full' ? 'Бүтэн' : 'Хэсэгчилсэн'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">
                        {ret.refund_amount ? formatPrice(ret.refund_amount) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{ret.handled_by || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(ret.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/dashboard/returns/${ret.id}`}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all inline-block"
                      >
                        👁️
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : returns.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох буцаалт олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">↩️</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Буцаалт байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Захиалгын буцаалт хүсэлт ирэхэд энд харагдана
          </p>
        </div>
      )}
    </div>
  )
}
