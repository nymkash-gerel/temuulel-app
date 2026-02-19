'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { exportToFile } from '@/lib/export-utils'

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  created_at: string
  order_type: string | null
  customers: { name: string | null; phone: string | null } | null
  order_items: { quantity: number; unit_price: number }[] | null
}

const ORDER_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  dine_in: { label: 'Зоогийн', color: 'bg-purple-500/20 text-purple-400' },
  pickup: { label: 'Очиж авах', color: 'bg-cyan-500/20 text-cyan-400' },
  delivery: { label: 'Хүргэлт', color: 'bg-blue-500/20 text-blue-400' },
  catering: { label: 'Кейтэринг', color: 'bg-amber-500/20 text-amber-400' },
}

export default function OrdersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [orderTypeFilter, setOrderTypeFilter] = useState('')

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
          .from('orders')
          .select(`
            id, order_number, status, total_amount, created_at, order_type,
            customers(name, phone),
            order_items(quantity, unit_price)
          `)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })

        if (data) {
          setOrders(data as unknown as Order[])
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filteredOrders = useMemo(() => {
    let result = orders

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        o.customers?.name?.toLowerCase().includes(q) ||
        o.customers?.phone?.includes(q)
      )
    }

    // Status filter
    if (statusFilter) {
      result = result.filter(o => o.status === statusFilter)
    }

    // Order type filter
    if (orderTypeFilter) {
      result = result.filter(o => o.order_type === orderTypeFilter)
    }

    // Date filter
    if (dateFilter) {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      if (dateFilter === 'today') {
        result = result.filter(o => new Date(o.created_at) >= startOfDay)
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(startOfDay)
        weekAgo.setDate(weekAgo.getDate() - weekAgo.getDay())
        result = result.filter(o => new Date(o.created_at) >= weekAgo)
      } else if (dateFilter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        result = result.filter(o => new Date(o.created_at) >= monthStart)
      }
    }

    return result
  }, [orders, search, statusFilter, dateFilter, orderTypeFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'confirmed': return 'bg-blue-500/20 text-blue-400'
      case 'processing': return 'bg-purple-500/20 text-purple-400'
      case 'shipped': return 'bg-cyan-500/20 text-cyan-400'
      case 'delivered': return 'bg-green-500/20 text-green-400'
      case 'cancelled': return 'bg-red-500/20 text-red-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Хүлээгдэж буй'
      case 'confirmed': return 'Баталгаажсан'
      case 'processing': return 'Бэлтгэж буй'
      case 'shipped': return 'Илгээсэн'
      case 'delivered': return 'Хүргэсэн'
      case 'cancelled': return 'Цуцлагдсан'
      default: return status
    }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filteredOrders.map(o => ({
      'Дугаар': o.order_number,
      'Харилцагч': o.customers?.name || '',
      'Утас': o.customers?.phone || '',
      'Бүтээгдэхүүн тоо': o.order_items?.length || 0,
      'Нийт дүн': Number(o.total_amount),
      'Төлөв': getStatusLabel(o.status),
      'Огноо': new Date(o.created_at).toLocaleDateString('mn-MN'),
    }))

    exportToFile(data, `захиалга_${new Date().toISOString().slice(0, 10)}`, format, 'Захиалга')
  }

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
          <h1 className="text-2xl font-bold text-white">Захиалга</h1>
          <p className="text-slate-400 mt-1">
            Нийт {orders.length} захиалга
            {filteredOrders.length !== orders.length && ` (${filteredOrders.length} илэрц)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/deliveries"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all text-sm"
          >
            Хүргэлт
          </Link>
          {orders.length > 0 && (
            <>
              <button
                onClick={() => handleExport('xlsx')}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm"
              >
                <span>📥</span>
                <span>Excel</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm"
              >
                <span>📄</span>
                <span>CSV</span>
              </button>
            </>
          )}
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
                placeholder="Захиалгын дугаар, харилцагч хайх..."
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
              <option value="confirmed">Баталгаажсан</option>
              <option value="processing">Бэлтгэж буй</option>
              <option value="shipped">Илгээсэн</option>
              <option value="delivered">Хүргэсэн</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="dine_in">Зоогийн</option>
              <option value="pickup">Очиж авах</option>
              <option value="delivery">Хүргэлт</option>
              <option value="catering">Кейтэринг</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх хугацаа</option>
              <option value="today">Өнөөдөр</option>
              <option value="week">Энэ долоо хоног</option>
              <option value="month">Энэ сар</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">
            {orders.filter(o => o.status === 'pending').length}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Боловсруулж буй</p>
          <p className="text-2xl font-bold text-white mt-1">
            {orders.filter(o => ['confirmed', 'processing'].includes(o.status)).length}
          </p>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
          <p className="text-cyan-400 text-sm">Илгээсэн</p>
          <p className="text-2xl font-bold text-white mt-1">
            {orders.filter(o => o.status === 'shipped').length}
          </p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Хүргэсэн</p>
          <p className="text-2xl font-bold text-white mt-1">
            {orders.filter(o => o.status === 'delivered').length}
          </p>
        </div>
      </div>

      {/* Orders Table */}
      {filteredOrders.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалга</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Бүтээгдэхүүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нийт дүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">#{order.order_number}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    {(() => {
                      const ot = ORDER_TYPE_CONFIG[order.order_type || 'delivery'] || ORDER_TYPE_CONFIG.delivery
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ot.color}`}>
                          {ot.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <div>
                      <p className="text-white">{order.customers?.name || 'N/A'}</p>
                      <p className="text-slate-400 text-sm">{order.customers?.phone || ''}</p>
                    </div>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">
                      {order.order_items?.length || 0} бүтээгдэхүүн
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">
                      {Number(order.total_amount).toLocaleString()}₮
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(order.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all inline-block"
                    >
                      👁️
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : orders.length > 0 ? (
        /* No results from filter */
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох захиалга олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); setOrderTypeFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🛒</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Захиалга байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Хэрэглэгчид chatbot-оор захиалга өгөхөд энд харагдана
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard/products"
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2"
            >
              <span>📦</span>
              <span>Бүтээгдэхүүн харах</span>
            </Link>
            <Link
              href="/dashboard/settings/integrations"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all flex items-center gap-2"
            >
              <span>💬</span>
              <span>Messenger холбох</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
