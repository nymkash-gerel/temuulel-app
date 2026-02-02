'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { purchaseOrderTransitions } from '@/lib/status-machine'

interface PurchaseOrderItem {
  id: string
  product_id: string
  variant_id: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
}

interface Supplier {
  id: string
  name: string
}

interface PurchaseOrder {
  id: string
  supplier_id: string
  po_number: string
  status: string
  total_amount: number
  expected_date: string | null
  received_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  suppliers: Supplier | null
  purchase_order_items: PurchaseOrderItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Ноорог', color: 'bg-slate-500/20 text-slate-400' },
  sent: { label: 'Илгээсэн', color: 'bg-blue-500/20 text-blue-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-cyan-500/20 text-cyan-400' },
  partially_received: { label: 'Хэсэгчлэн хүлээн авсан', color: 'bg-yellow-500/20 text-yellow-400' },
  received: { label: 'Хүлээн авсан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const STATUS_FLOW: Record<string, string> = {
  draft: 'sent',
  sent: 'confirmed',
  confirmed: 'partially_received',
  partially_received: 'received',
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  sent: 'Илгээх',
  confirmed: 'Батлах',
  partially_received: 'Хэсэгчлэн хүлээн авах',
  received: 'Бүгдийг хүлээн авах',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Ноорог',
  sent: 'Илгээсэн',
  confirmed: 'Баталгаажсан',
  partially_received: 'Хэсэгчлэн хүлээн авсан',
  received: 'Хүлээн авсан',
  cancelled: 'Цуцлагдсан',
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const poId = params.id as string

  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) {
      router.push('/dashboard/purchase-orders')
      return
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        id, supplier_id, po_number, status, total_amount, expected_date, received_date, notes, created_at, updated_at,
        suppliers(id, name),
        purchase_order_items(id, product_id, variant_id, quantity_ordered, quantity_received, unit_cost)
      `)
      .eq('id', poId)
      .eq('store_id', store.id)
      .single()

    if (error || !data) {
      router.push('/dashboard/purchase-orders')
      return
    }

    setPo(data as unknown as PurchaseOrder)
    setLoading(false)
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId])

  async function handleStatusChange(newStatus: string) {
    if (!po) return

    const confirmMessages: Record<string, string> = {
      sent: 'Захиалгыг нийлүүлэгч рүү илгээх үү?',
      confirmed: 'Захиалгыг баталгаажуулах уу?',
      partially_received: 'Хэсэгчлэн хүлээн авсан гэж тэмдэглэх үү?',
      received: 'Бүх барааг хүлээн авсан гэж тэмдэглэх үү?',
      cancelled: 'Энэ захиалгыг цуцлах уу?',
    }

    if (!confirm(confirmMessages[newStatus] || `Төлөв "${newStatus}" болгох уу?`)) return

    setActionLoading(true)

    try {
      const body: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'received') {
        body.received_date = new Date().toISOString()
      }

      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const updated = await res.json() as PurchaseOrder
        setPo(updated)
      }
    } catch {
      // keep state unchanged
    }

    setActionLoading(false)
  }

  function startEdit() {
    if (!po) return
    setEditData({
      expected_date: po.expected_date ? po.expected_date.slice(0, 10) : '',
      received_date: po.received_date ? po.received_date.slice(0, 10) : '',
      notes: po.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!po) return
    setSaving(true)

    try {
      const changed: Record<string, unknown> = {}

      const origExpected = po.expected_date ? po.expected_date.slice(0, 10) : ''
      const origReceived = po.received_date ? po.received_date.slice(0, 10) : ''
      const origNotes = po.notes || ''

      if (editData.expected_date !== origExpected) {
        changed.expected_date = (editData.expected_date as string) || null
      }
      if (editData.received_date !== origReceived) {
        changed.received_date = (editData.received_date as string) || null
      }
      if (editData.notes !== origNotes) {
        changed.notes = (editData.notes as string) || null
      }

      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (res.ok) {
        setIsEditing(false)
        load()
      } else {
        alert('Хадгалахад алдаа гарлаа')
      }
    } catch {
      alert('Хадгалахад алдаа гарлаа')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!po) return null

  const sc = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft
  const nextStatus = STATUS_FLOW[po.status]
  const nextLabel = nextStatus ? STATUS_ACTION_LABELS[nextStatus] : null
  const items = po.purchase_order_items || []
  const totalOrdered = items.reduce((s, i) => s + i.quantity_ordered, 0)
  const totalReceived = items.reduce((s, i) => s + i.quantity_received, 0)
  const receiveProgress = totalOrdered > 0 ? Math.min(Math.round((totalReceived / totalOrdered) * 100), 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/purchase-orders"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                Худалдан авалтын захиалга
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              <StatusActions
                currentStatus={po.status}
                transitions={purchaseOrderTransitions}
                statusLabels={STATUS_LABELS}
                apiPath={`/api/purchase-orders/${poId}`}
                onSuccess={load}
              />
            </div>
            <p className="text-slate-400 mt-1 font-mono">{po.po_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {saving ? '...' : 'Хадгалах'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all"
              >
                Засах
              </button>
              {po.status !== 'received' && po.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  Цуцлах
                </button>
              )}
              {nextStatus && nextLabel && (
                <button
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {actionLoading ? '...' : nextLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* PO Info Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Захиалгын мэдээлэл</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Дугаар</span>
              <span className="text-white font-mono">{po.po_number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Төлөв</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хүлээн авалт</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      receiveProgress === 100 ? 'bg-green-500' : receiveProgress > 0 ? 'bg-yellow-500' : 'bg-slate-600'
                    }`}
                    style={{ width: `${receiveProgress}%` }}
                  />
                </div>
                <span className="text-slate-300 text-xs">{receiveProgress}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Үүсгэсэн</span>
              <span className="text-slate-300 text-xs">{formatDateTime(po.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Шинэчлэгдсэн</span>
              <span className="text-slate-300 text-xs">{formatDateTime(po.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Supplier Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Нийлүүлэгч</h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {po.suppliers?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="text-white font-medium">{po.suppliers?.name || 'Тодорхойгүй'}</p>
              <p className="text-slate-400 text-xs">ID: {po.supplier_id}</p>
            </div>
          </div>
        </div>

        {/* Dates Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Огноо</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хүлээгдэж буй</span>
              {isEditing ? (
                <input
                  type="date"
                  value={(editData.expected_date as string) || ''}
                  onChange={(e) => setEditData({ ...editData, expected_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-white">{formatDate(po.expected_date)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хүлээн авсан</span>
              {isEditing ? (
                <input
                  type="date"
                  value={(editData.received_date as string) || ''}
                  onChange={(e) => setEditData({ ...editData, received_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-white">{formatDate(po.received_date)}</span>
              )}
            </div>
            {po.expected_date && po.status !== 'received' && po.status !== 'cancelled' && new Date(po.expected_date) < new Date() && (
              <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs font-medium">Хугацаа хэтэрсэн</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Нийт дүн</h3>
          <p className="text-3xl font-bold text-white">{formatPrice(po.total_amount)}</p>
          <p className="text-slate-400 text-sm mt-2">
            {items.length} бараа, {totalOrdered} ширхэг захиалсан
          </p>
        </div>

        {/* Notes Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:col-span-2">
          <h3 className="text-white font-medium mb-4">Тэмдэглэл</h3>
          {isEditing ? (
            <textarea
              value={(editData.notes as string) || ''}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-slate-300 text-sm">
              {po.notes || 'Тэмдэглэл байхгүй'}
            </p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-white font-medium">
            Бараа ({items.length})
          </h3>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Бүтээгдэхүүн ID</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Захиалсан</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Хүлээн авсан</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Нэгж үнэ</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Мөрийн дүн</th>
                  <th className="text-center py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Хүлээн авалт</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const lineTotal = item.quantity_ordered * item.unit_cost
                  const itemProgress = item.quantity_ordered > 0
                    ? Math.round((item.quantity_received / item.quantity_ordered) * 100)
                    : 0

                  return (
                    <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-all">
                      <td className="py-3 px-6 text-slate-400 text-sm">{idx + 1}</td>
                      <td className="py-3 px-6">
                        <span className="text-white text-sm font-mono">{item.product_id.slice(0, 8)}...</span>
                        {item.variant_id && (
                          <p className="text-slate-500 text-xs mt-0.5">Хувилбар: {item.variant_id.slice(0, 8)}...</p>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right text-slate-300 text-sm">{item.quantity_ordered}</td>
                      <td className="py-3 px-6 text-right text-slate-300 text-sm">{item.quantity_received}</td>
                      <td className="py-3 px-6 text-right text-slate-300 text-sm">{formatPrice(item.unit_cost)}</td>
                      <td className="py-3 px-6 text-right text-white font-medium text-sm">{formatPrice(lineTotal)}</td>
                      <td className="py-3 px-6 text-center">
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
              <tfoot>
                <tr className="border-t border-slate-600">
                  <td colSpan={2} className="py-3 px-6 text-slate-400 text-sm font-medium">Нийт</td>
                  <td className="py-3 px-6 text-right text-white text-sm font-medium">{totalOrdered}</td>
                  <td className="py-3 px-6 text-right text-white text-sm font-medium">{totalReceived}</td>
                  <td className="py-3 px-6" />
                  <td className="py-3 px-6 text-right text-white font-bold text-sm">{formatPrice(po.total_amount)}</td>
                  <td className="py-3 px-6 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      receiveProgress === 100
                        ? 'bg-green-500/20 text-green-400'
                        : receiveProgress > 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {receiveProgress}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm">Энэ захиалгад бараа байхгүй байна</p>
          </div>
        )}
      </div>
    </div>
  )
}
