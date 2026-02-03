'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface PurchaseOrderItem {
  id: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
}

interface SupplierRef {
  id: string
  name: string
}

interface PurchaseOrderRow {
  id: string
  store_id: string
  supplier_id: string
  po_number: string
  status: string
  total_amount: number
  expected_date: string | null
  received_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  supplier?: SupplierRef | null
  purchase_order_items?: PurchaseOrderItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/20 text-slate-400' },
  sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400' },
  confirmed: { label: 'Confirmed', color: 'bg-indigo-500/20 text-indigo-400' },
  partially_received: { label: 'Partially Received', color: 'bg-yellow-500/20 text-yellow-400' },
  received: { label: 'Received', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
}

function formatCurrency(amount: number) {
  return amount.toLocaleString() + '₮'
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getReceiveProgress(items: PurchaseOrderItem[] | undefined) {
  if (!items || items.length === 0) return 0
  const totalOrdered = items.reduce((s, i) => s + i.quantity_ordered, 0)
  const totalReceived = items.reduce((s, i) => s + i.quantity_received, 0)
  if (totalOrdered === 0) return 0
  return Math.min(Math.round((totalReceived / totalOrdered) * 100), 100)
}

function isOverdue(expectedDate: string | null, status: string) {
  if (!expectedDate) return false
  if (status === 'received' || status === 'cancelled') return false
  return new Date(expectedDate) < new Date()
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadOrders = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(id, name), purchase_order_items(id, quantity_ordered, quantity_received, unit_cost)')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })

    if (data) {
      setOrders(data as unknown as PurchaseOrderRow[])
    }
  }, [supabase])

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
        await loadOrders(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadOrders])

  const stats = useMemo(() => {
    const total = orders.length
    const open = orders.filter(o =>
      o.status === 'draft' || o.status === 'sent' || o.status === 'confirmed'
    ).length
    const receiving = orders.filter(o => o.status === 'partially_received').length
    const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    return { total, open, receiving, totalAmount }
  }, [orders])

  const supplierNames = useMemo(() => {
    const names = new Set<string>()
    orders.forEach(o => {
      if (o.supplier?.name) names.add(o.supplier.name)
    })
    return Array.from(names).sort()
  }, [orders])

  const filtered = useMemo(() => {
    let result = orders
    if (statusFilter) {
      result = result.filter(o => o.status === statusFilter)
    }
    if (supplierFilter) {
      result = result.filter(o => o.supplier?.name === supplierFilter)
    }
    return result
  }, [orders, statusFilter, supplierFilter])

  const overdueCount = useMemo(() => {
    return orders.filter(o => isOverdue(o.expected_date, o.status)).length
  }, [orders])

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
          <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
          <p className="text-slate-400 mt-1">
            {orders.length} purchase orders total
            {filtered.length !== orders.length && ` (${filtered.length} shown)`}
            {overdueCount > 0 && (
              <span className="text-red-400 ml-2">
                ({overdueCount} overdue)
              </span>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/purchase-orders/new"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          + Шинэ захиалга
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total POs</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Open (Draft/Sent/Confirmed)</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.open}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Receiving</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.receiving}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Total Amount</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(stats.totalAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="confirmed">Confirmed</option>
              <option value="partially_received">Partially Received</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Supplier</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Suppliers</option>
              {supplierNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        {(statusFilter || supplierFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setSupplierFilter('') }}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400 w-8"></th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">PO Number</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Supplier</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Items</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Receive Progress</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Total Amount</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Expected Date</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'bg-slate-500/20 text-slate-400' }
                const itemCount = po.purchase_order_items?.length || 0
                const progress = getReceiveProgress(po.purchase_order_items)
                const overdue = isOverdue(po.expected_date, po.status)
                const isExpanded = expandedId === po.id

                return (
                  <>
                    <tr
                      key={po.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer ${
                        overdue ? 'bg-red-500/5' : ''
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : po.id)}
                    >
                      <td className="py-3 px-3 md:py-4 md:px-4">
                        <span className={`text-slate-400 text-xs transition-transform inline-block ${isExpanded ? 'rotate-90' : ''}`}>
                          &#9654;
                        </span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-white font-medium font-mono">{po.po_number}</span>
                        {overdue && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
                            OVERDUE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-slate-300">{po.supplier?.name || '-'}</span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                        <span className="text-slate-300">{itemCount}</span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-yellow-500' : 'bg-slate-600'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 min-w-[32px] text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                        <span className="text-white font-medium">{formatCurrency(po.total_amount)}</span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className={`text-sm ${overdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                          {formatDate(po.expected_date)}
                        </span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-slate-400 text-sm">{formatDate(po.created_at)}</span>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr key={`${po.id}-detail`} className="border-b border-slate-700/50">
                        <td colSpan={9} className="py-4 px-6">
                          <div className="bg-slate-900/50 rounded-xl p-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Received Date</p>
                                <p className="text-sm text-slate-300">{formatDateTime(po.received_date)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Last Updated</p>
                                <p className="text-sm text-slate-300">{formatDateTime(po.updated_at)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Notes</p>
                                <p className="text-sm text-slate-300">{po.notes || 'No notes'}</p>
                              </div>
                            </div>

                            {/* Items Breakdown */}
                            {po.purchase_order_items && po.purchase_order_items.length > 0 ? (
                              <div>
                                <h4 className="text-sm font-medium text-white mb-3">Line Items ({po.purchase_order_items.length})</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-700">
                                        <th className="text-left py-2 px-3 text-xs text-slate-500">#</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500">Qty Ordered</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500">Qty Received</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500">Unit Cost</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500">Line Total</th>
                                        <th className="text-center py-2 px-3 text-xs text-slate-500">Fulfillment</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {po.purchase_order_items.map((item, idx) => {
                                        const lineTotal = item.quantity_ordered * item.unit_cost
                                        const itemProgress = item.quantity_ordered > 0
                                          ? Math.round((item.quantity_received / item.quantity_ordered) * 100)
                                          : 0
                                        return (
                                          <tr key={item.id} className="border-b border-slate-800">
                                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                                            <td className="py-2 px-3 text-right text-slate-300">{item.quantity_ordered}</td>
                                            <td className="py-2 px-3 text-right text-slate-300">{item.quantity_received}</td>
                                            <td className="py-2 px-3 text-right text-slate-300">{formatCurrency(item.unit_cost)}</td>
                                            <td className="py-2 px-3 text-right text-white font-medium">{formatCurrency(lineTotal)}</td>
                                            <td className="py-2 px-3 text-center">
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                itemProgress === 100
                                                  ? 'bg-green-500/20 text-green-400'
                                                  : itemProgress > 0
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-slate-500/20 text-slate-400'
                                              }`}>
                                                {itemProgress}%
                                              </span>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No line items on this purchase order.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : orders.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No purchase orders match your current filters</p>
          <button
            onClick={() => { setStatusFilter(''); setSupplierFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128220;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Purchase Orders Yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Purchase orders will appear here when you start ordering from suppliers.
          </p>
        </div>
      )}
    </div>
  )
}
