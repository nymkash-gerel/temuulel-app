'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { laundryOrderTransitions } from '@/lib/status-machine'

interface LaundryItem {
  id: string
  item_type: string
  service_type: string
  quantity: number
  unit_price: number
}

interface LaundryOrder {
  id: string
  customer_id: string | null
  order_number: string
  status: string
  total_items: number
  total_amount: number
  paid_amount: number
  rush_order: boolean
  pickup_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customers: {
    id: string
    name: string | null
    phone: string | null
  } | null
  laundry_items: LaundryItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  received: { label: '\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0441\u0430\u043D', color: 'bg-blue-500/20 text-blue-400' },
  processing: { label: '\u0411\u043E\u043B\u043E\u0432\u0441\u0440\u0443\u0443\u043B\u0436 \u0431\u0443\u0439', color: 'bg-yellow-500/20 text-yellow-400' },
  washing: { label: '\u0423\u0433\u0430\u0430\u0436 \u0431\u0443\u0439', color: 'bg-cyan-500/20 text-cyan-400' },
  drying: { label: '\u0425\u0430\u0442\u0430\u0430\u0436 \u0431\u0443\u0439', color: 'bg-purple-500/20 text-purple-400' },
  ironing: { label: '\u0418\u043D\u0434\u04AF\u04AF\u0434\u044D\u0436 \u0431\u0443\u0439', color: 'bg-orange-500/20 text-orange-400' },
  ready: { label: '\u0411\u044D\u043B\u044D\u043D', color: 'bg-green-500/20 text-green-400' },
  delivered: { label: '\u0425\u04AF\u0440\u0433\u044D\u0441\u044D\u043D', color: 'bg-slate-500/20 text-slate-400' },
  cancelled: { label: '\u0426\u0443\u0446\u043B\u0430\u0433\u0434\u0441\u0430\u043D', color: 'bg-red-500/20 text-red-400' },
}

const STATUS_FLOW: string[] = [
  'received',
  'processing',
  'washing',
  'drying',
  'ironing',
  'ready',
  'delivered',
]

const STATUS_LABELS: Record<string, string> = {
  received: 'Хүлээн авсан',
  processing: 'Боловсруулж байна',
  washing: 'Угааж байна',
  drying: 'Хатааж байна',
  ironing: 'Индүүдэж байна',
  ready: 'Бэлэн',
  delivered: 'Хүлээлгэж өгсөн',
  cancelled: 'Цуцлагдсан',
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('mn-MN').format(amount) + '\u20AE'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LaundryOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const orderId = params.id as string

  const [order, setOrder] = useState<LaundryOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) {
      router.push('/dashboard/laundry')
      return
    }

    const { data, error: fetchError } = await supabase
      .from('laundry_orders')
      .select(`
        id, customer_id, order_number, status, total_items, total_amount, paid_amount, rush_order, pickup_date, notes, created_at, updated_at,
        customers(id, name, phone),
        laundry_items(id, item_type, service_type, quantity, unit_price)
      `)
      .eq('id', orderId)
      .eq('store_id', store.id)
      .single()

    if (fetchError || !data) {
      router.push('/dashboard/laundry')
      return
    }

    setOrder(data as unknown as LaundryOrder)
    setLoading(false)
  }, [orderId, supabase, router])

  useEffect(() => {
    load()
  }, [load])

  function getNextStatus(): string | null {
    if (!order) return null
    const idx = STATUS_FLOW.indexOf(order.status)
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null
    return STATUS_FLOW[idx + 1]
  }

  async function handleUpdateStatus(newStatus: string) {
    if (!order) return

    const nextLabel = STATUS_CONFIG[newStatus]?.label || newStatus
    if (!confirm(`\u0422\u04E9\u043B\u04E9\u0432\u0438\u0439\u0433 "${nextLabel}" \u0431\u043E\u043B\u0433\u043E\u0445 \u0443\u0443?`)) return

    setUpdating(true)
    setError('')

    try {
      const res = await fetch(`/api/laundry-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || '\u0422\u04E9\u043B\u04E9\u0432 \u0448\u0438\u043D\u044D\u0447\u043B\u044D\u0445\u044D\u0434 \u0430\u043B\u0434\u0430\u0430 \u0433\u0430\u0440\u043B\u0430\u0430')
      }

      const updated = await res.json()
      setOrder(updated as unknown as LaundryOrder)
    } catch (err) {
      setError(err instanceof Error ? err.message : '\u0410\u043B\u0434\u0430\u0430 \u0433\u0430\u0440\u043B\u0430\u0430')
    } finally {
      setUpdating(false)
    }
  }

  function startEdit() {
    if (!order) return
    setEditData({
      rush_order: order.rush_order,
      pickup_date: order.pickup_date ? order.pickup_date.slice(0, 10) : '',
      paid_amount: order.paid_amount,
      notes: order.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!order) return

    const changed: Record<string, unknown> = {}

    if (editData.rush_order !== order.rush_order) {
      changed.rush_order = editData.rush_order
    }
    const currentPickup = order.pickup_date ? order.pickup_date.slice(0, 10) : ''
    if (editData.pickup_date !== currentPickup) {
      changed.pickup_date = editData.pickup_date || null
    }
    if (Number(editData.paid_amount) !== order.paid_amount) {
      changed.paid_amount = Number(editData.paid_amount)
    }
    const currentNotes = order.notes || ''
    if (editData.notes !== currentNotes) {
      changed.notes = editData.notes || null
    }

    if (Object.keys(changed).length === 0) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/laundry-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Хадгалахад алдаа гарлаа')
      }

      setIsEditing(false)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!order) return null

  const sc = STATUS_CONFIG[order.status] || { label: order.status, color: 'bg-slate-500/20 text-slate-400' }
  const nextStatus = getNextStatus()
  const balance = order.total_amount - order.paid_amount

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/laundry"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                #{order.order_number}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              {order.rush_order && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                  &#9889; \u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439
                </span>
              )}
            </div>
            <p className="text-slate-400 mt-1 text-sm">
              \u04AE\u04AF\u0441\u0433\u044D\u0441\u044D\u043D: {formatDate(order.created_at)}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusActions
                currentStatus={order.status}
                transitions={laundryOrderTransitions}
                statusLabels={STATUS_LABELS}
                apiPath={`/api/laundry-orders/${order.id}`}
                onSuccess={load}
              />
              {!isEditing ? (
                <button
                  onClick={startEdit}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-all"
                >
                  Засах
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {saving ? '...' : 'Хадгалах'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <button
              onClick={() => handleUpdateStatus('cancelled')}
              disabled={updating}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
            >
              \u0426\u0443\u0446\u043B\u0430\u0445
            </button>
          )}
          {nextStatus && (
            <button
              onClick={() => handleUpdateStatus(nextStatus)}
              disabled={updating}
              className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {updating ? '...' : `${STATUS_CONFIG[nextStatus]?.label} \u0431\u043E\u043B\u0433\u043E\u0445`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <h3 className="text-white font-medium mb-4">\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u044B\u043D \u044F\u0432\u0446</h3>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STATUS_FLOW.map((status, i) => {
            const config = STATUS_CONFIG[status]
            const currentIdx = STATUS_FLOW.indexOf(order.status)
            const isCompleted = i <= currentIdx && order.status !== 'cancelled'
            const isCurrent = status === order.status

            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                      isCompleted
                        ? isCurrent
                          ? 'bg-pink-500 ring-4 ring-pink-500/20'
                          : 'bg-emerald-500'
                        : 'bg-slate-700'
                    }`}
                  >
                    <span className="text-white">
                      {isCompleted && !isCurrent ? '\u2713' : i + 1}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] mt-1.5 text-center whitespace-nowrap ${
                      isCompleted ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {config.label}
                  </span>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1.5 ${
                      i < currentIdx ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
        {order.status === 'cancelled' && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">
              \u042D\u043D\u044D \u0437\u0430\u0445\u0438\u0430\u043B\u0433\u0430 \u0446\u0443\u0446\u043B\u0430\u0433\u0434\u0441\u0430\u043D \u0431\u0430\u0439\u043D\u0430
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">
              \u0411\u0430\u0440\u0430\u0430\u043D\u0443\u0443\u0434
              <span className="text-slate-400 text-sm font-normal ml-2">
                ({order.laundry_items?.length || 0})
              </span>
            </h3>
            {order.laundry_items && order.laundry_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-3 text-sm font-medium text-slate-400">
                        \u0411\u0430\u0440\u0430\u0430\u043D\u044B \u0442\u04E9\u0440\u04E9\u043B
                      </th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-slate-400">
                        \u04AE\u0439\u043B\u0447\u0438\u043B\u0433\u044D\u044D
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-slate-400">
                        \u0422\u043E\u043E
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-slate-400">
                        \u041D\u044D\u0433\u0436 \u04AF\u043D\u044D
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-slate-400">
                        \u041D\u0438\u0439\u0442
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.laundry_items.map((item) => {
                      const lineTotal = item.quantity * item.unit_price
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                        >
                          <td className="py-3 px-3">
                            <span className="text-white">{item.item_type}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-slate-300">{item.service_type}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-white">{item.quantity}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-slate-300">{formatPrice(item.unit_price)}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-white font-medium">{formatPrice(lineTotal)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-600">
                      <td
                        colSpan={4}
                        className="py-3 px-3 text-right text-sm font-medium text-slate-400"
                      >
                        \u041D\u0438\u0439\u0442 \u0434\u04AF\u043D
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-white font-bold text-lg">
                          {formatPrice(order.total_amount)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                \u0411\u0430\u0440\u0430\u0430 \u0431\u04AF\u0440\u0442\u0433\u044D\u0433\u0434\u044D\u044D\u0433\u04AF\u0439
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0422\u044D\u043C\u0434\u044D\u0433\u043B\u044D\u043B</h3>
            {isEditing ? (
              <textarea
                value={editData.notes as string}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                rows={4}
                className={inputClassName + ' resize-none'}
              />
            ) : order.notes ? (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{order.notes}</p>
            ) : (
              <p className="text-slate-500 text-sm">
                \u0422\u044D\u043C\u0434\u044D\u0433\u043B\u044D\u043B \u043E\u0440\u0443\u0443\u043B\u0430\u0430\u0433\u04AF\u0439
              </p>
            )}
          </div>

          {/* Status Action Buttons */}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">
                \u0422\u04E9\u043B\u04E9\u0432 \u04E9\u04E9\u0440\u0447\u043B\u04E9\u0445
              </h3>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.map((status) => {
                  const config = STATUS_CONFIG[status]
                  const currentIdx = STATUS_FLOW.indexOf(order.status)
                  const statusIdx = STATUS_FLOW.indexOf(status)
                  const isNext = statusIdx === currentIdx + 1
                  const isPast = statusIdx <= currentIdx
                  const isFuture = statusIdx > currentIdx + 1

                  return (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(status)}
                      disabled={updating || isPast || isFuture}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        isNext
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white'
                          : `${config.color} hover:opacity-80`
                      }`}
                    >
                      {updating ? '...' : config.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">
              \u0417\u0430\u0445\u0438\u0430\u043B\u0433\u044B\u043D \u043C\u044D\u0434\u044D\u044D\u043B\u044D\u043B
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u0414\u0443\u0433\u0430\u0430\u0440</span>
                <span className="text-white font-medium">#{order.order_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u0422\u04E9\u043B\u04E9\u0432</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u041D\u0438\u0439\u0442 \u0431\u0430\u0440\u0430\u0430</span>
                <span className="text-white">{order.total_items}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439</span>
                {isEditing ? (
                  <input
                    type="checkbox"
                    checked={editData.rush_order as boolean}
                    onChange={(e) => setEditData({ ...editData, rush_order: e.target.checked })}
                    className="w-4 h-4 accent-blue-500"
                  />
                ) : (
                  <span className={order.rush_order ? 'text-red-400 font-medium' : 'text-slate-300'}>
                    {order.rush_order ? '\u0422\u0438\u0439\u043C' : '\u04AE\u0433\u04AF\u0439'}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u04AE\u04AF\u0441\u0433\u044D\u0441\u044D\u043D</span>
                <span className="text-slate-300 text-xs">{formatDate(order.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u0428\u0438\u043D\u044D\u0447\u043B\u044D\u0433\u0434\u0441\u044D\u043D</span>
                <span className="text-slate-300 text-xs">{formatDate(order.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Customer Card */}
          {order.customers && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">\u0417\u0430\u0445\u0438\u0430\u043B\u0430\u0433\u0447</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {order.customers.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">
                    {order.customers.name || '\u041D\u044D\u0440\u0433\u04AF\u0439'}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {order.customers.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">\u260E</span>
                    <span className="text-slate-300">{order.customers.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Financial Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0422\u04E9\u043B\u0431\u04E9\u0440</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u041D\u0438\u0439\u0442 \u0434\u04AF\u043D</span>
                <span className="text-white font-medium">{formatPrice(order.total_amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">\u0422\u04E9\u043B\u0441\u04E9\u043D</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.paid_amount as number}
                    onChange={(e) => setEditData({ ...editData, paid_amount: e.target.value })}
                    className={inputClassName + ' max-w-[140px] text-right'}
                  />
                ) : (
                  <span className="text-emerald-400 font-medium">{formatPrice(order.paid_amount)}</span>
                )}
              </div>
              <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
                <span className="text-slate-400">\u04AE\u043B\u0434\u044D\u0433\u0434\u044D\u043B</span>
                <span
                  className={`font-bold text-lg ${
                    balance > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {formatPrice(balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Pickup Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">
              \u0410\u0432\u0430\u0445 \u04E9\u0434\u04E9\u0440
            </h3>
            {isEditing ? (
              <input
                type="date"
                value={editData.pickup_date as string}
                onChange={(e) => setEditData({ ...editData, pickup_date: e.target.value })}
                className={inputClassName}
              />
            ) : order.pickup_date ? (
              <p className="text-white text-sm">{formatDate(order.pickup_date)}</p>
            ) : (
              <p className="text-slate-500 text-sm">
                \u0422\u043E\u0433\u0442\u043E\u043E\u0433\u04AF\u0439
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
