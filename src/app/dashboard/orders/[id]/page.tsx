'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  variant_label: string | null
  products: {
    id: string
    name: string
    images: unknown
  } | null
  product_variants: {
    size: string | null
    color: string | null
    products: {
      id: string
      name: string
      images: unknown
    } | null
  } | null
}

interface ReturnInfo {
  id: string
  return_number: string
  return_type: string
  status: string
  refund_amount: number | null
  handled_by: string | null
  created_at: string
}

interface DeliveryInfo {
  id: string
  delivery_number: string
  status: string
  delivery_type: string
  driver_name: string | null
  driver_phone: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  shipping_amount: number
  payment_method: string | null
  payment_status: string
  tracking_number: string | null
  notes: string | null
  shipping_address: string | null
  created_at: string
  updated_at: string
  customers: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    messenger_id: string | null
  } | null
  order_items: OrderItem[]
  return_requests: ReturnInfo[]
}

const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '⏳' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '✅' },
  processing: { label: 'Бэлтгэж буй', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '📦' },
  shipped: { label: 'Илгээсэн', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: '🚚' },
  delivered: { label: 'Хүргэсэн', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '✅' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '❌' },
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  // Stable client — useMemo prevents re-creating on every render (avoids useEffect dep loop)
  const supabase = useMemo(() => createClient(), [])
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null)

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing]     = useState(false)
  const [editSaving, setEditSaving]   = useState(false)
  const [editData, setEditData]       = useState({
    customerName: '', customerPhone: '', shippingAddress: '', notes: '', shippingAmount: 0,
  })
  const [editItems, setEditItems]     = useState<{ id: string; quantity: number; unit_price: number; name: string }[]>([])
  const [qrData, setQrData] = useState<{ qr_image?: string; short_url?: string; deeplinks?: { name: string; link: string; logo: string }[] } | null>(null)
  const [bankInfo, setBankInfo] = useState<{ bank_name?: string; bank_account?: string; bank_holder?: string; note?: string } | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          customers(id, name, phone, email, messenger_id),
          order_items(
            id, quantity, unit_price, variant_label,
            products(id, name, images),
            product_variants(size, color, products(id, name, images))
          ),
          return_requests(id, return_number, return_type, status, refund_amount, handled_by, created_at)
        `)
        .eq('id', orderId)
        .single()

      if (!data) {
        router.push('/dashboard/orders')
        return
      }

      setOrder(data)
      setTrackingNumber(data.tracking_number || '')
      setNotes(data.notes || '')

      // Fetch linked delivery if any
      const { data: del } = await supabase
        .from('deliveries')
        .select('id, delivery_number, status, delivery_type, notes, metadata, created_at, delivery_drivers(name, phone)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (del) {
        const driver = del.delivery_drivers as { name: string; phone: string } | null
        setDeliveryInfo({
          id: del.id,
          delivery_number: del.delivery_number,
          status: del.status,
          delivery_type: del.delivery_type,
          driver_name: driver?.name || null,
          driver_phone: driver?.phone || null,
          notes: del.notes as string | null,
          metadata: del.metadata as Record<string, unknown> | null,
          created_at: del.created_at,
        })
      }

      setLoading(false)
    }
    load()
  }, [orderId, supabase])

  async function updateStatus(newStatus: string) {
    if (!order) return
    setUpdating(true)

    try {
      const res = await fetch('/api/orders/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          status: newStatus,
          tracking_number: newStatus === 'shipped' ? trackingNumber : undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setOrder({
          ...order,
          status: data.status,
          tracking_number: data.tracking_number || order.tracking_number,
          updated_at: data.updated_at,
        })
      }
    } catch {
      // Silently handle — UI state unchanged
    }

    setUpdating(false)
  }

  async function saveNotes() {
    if (!order) return
    await supabase
      .from('orders')
      .update({ notes })
      .eq('id', order.id)
  }

  async function cancelOrder() {
    if (!order || !confirm('Захиалга цуцлах уу? Энэ үйлдлийг буцаах боломжгүй.')) return
    await updateStatus('cancelled')
  }

  function startEdit() {
    if (!order) return
    setEditData({
      customerName:    order.customers?.name    ?? '',
      customerPhone:   order.customers?.phone   ?? '',
      shippingAddress: order.shipping_address   ?? '',
      notes:           order.notes              ?? '',
      shippingAmount:  order.shipping_amount    ?? 0,
    })
    setEditItems(
      (order.order_items ?? []).map(item => ({
        id:         item.id,
        quantity:   item.quantity,
        unit_price: item.unit_price,
        name:       item.products?.name || item.product_variants?.products?.name || 'Бараа',
      }))
    )
    setIsEditing(true)
  }

  function cancelEdit() { setIsEditing(false) }

  async function saveEdit() {
    if (!order) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name:    editData.customerName,
          customer_phone:   editData.customerPhone,
          shipping_address: editData.shippingAddress,
          notes:            editData.notes,
          shipping_amount:  editData.shippingAmount,
          items:            editItems.map(i => ({ id: i.id, quantity: i.quantity, unit_price: i.unit_price })),
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert(e.error || 'Алдаа гарлаа')
        setEditSaving(false)
        return
      }
      // Refresh order data
      const { data } = await supabase
        .from('orders')
        .select(`*, customers(id, name, phone, email, messenger_id),
          order_items(id, quantity, unit_price, variant_label,
            products(id, name, images),
            product_variants(size, color, products(id, name, images))),
          return_requests(id, return_number, return_type, status, refund_amount, handled_by, created_at)`)
        .eq('id', order.id)
        .single()
      if (data) { setOrder(data); setNotes(data.notes || '') }
      setIsEditing(false)
    } catch {
      alert('Алдаа гарлаа')
    }
    setEditSaving(false)
  }

  async function handleCreatePayment(method: string) {
    if (!order) return
    setPaymentLoading(true)
    setPaymentError(null)
    setQrData(null)
    setBankInfo(null)

    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, payment_method: method }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPaymentError(data.error || 'Төлбөр үүсгэхэд алдаа гарлаа')
        setPaymentLoading(false)
        return
      }

      if (method === 'qpay') {
        setQrData({
          qr_image: data.qr_image,
          short_url: data.short_url,
          deeplinks: data.deeplinks,
        })
      } else if (method === 'bank') {
        setBankInfo({
          bank_name: data.bank_name,
          bank_account: data.bank_account,
          bank_holder: data.bank_holder,
          note: data.note,
        })
      }

      setOrder({ ...order, payment_method: method })
    } catch {
      setPaymentError('Алдаа гарлаа. Дахин оролдоно уу.')
    }

    setPaymentLoading(false)
  }

  async function handleCheckPayment() {
    if (!order) return
    setPaymentLoading(true)
    setPaymentError(null)

    try {
      const res = await fetch('/api/payments/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id }),
      })

      const data = await res.json()

      if (data.status === 'paid') {
        setOrder({ ...order, payment_status: 'paid' })
        setQrData(null)
      } else {
        setPaymentError('Төлбөр хараахан хийгдээгүй байна')
      }
    } catch {
      setPaymentError('Шалгахад алдаа гарлаа')
    }

    setPaymentLoading(false)
  }

  async function handleMarkPaymentStatus(status: string) {
    if (!order) return
    if (!confirm(status === 'paid' ? 'Төлбөр төлөгдсөн гэж тэмдэглэх үү?' : 'Төлбөр буцаах уу?')) return
    setPaymentLoading(true)

    try {
      const res = await fetch('/api/payments/check', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, payment_status: status }),
      })

      if (res.ok) {
        setOrder({ ...order, payment_status: status })
        setQrData(null)
        setBankInfo(null)
      }
    } catch {
      setPaymentError('Алдаа гарлаа')
    }

    setPaymentLoading(false)
  }

  function getEditMode(status: string): 'full' | 'address_only' | 'locked' {
    if (['picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'].includes(status)) return 'locked'
    if (['assigned', 'at_store'].includes(status)) return 'address_only'
    return 'full'
  }

  function getNextStatus(): string | null {
    if (!order) return null
    const idx = STATUS_FLOW.indexOf(order.status)
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null
    return STATUS_FLOW[idx + 1]
  }

  function getItemName(item: OrderItem): string {
    const product = item.products || item.product_variants?.products
    return product?.name || 'Нэргүй бүтээгдэхүүн'
  }

  function getItemVariant(item: OrderItem): string {
    if (item.variant_label) return item.variant_label
    const v = item.product_variants
    if (!v) return ''
    const parts = []
    if (v.size) parts.push(v.size)
    if (v.color) parts.push(v.color)
    return parts.join(' / ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!order) return null

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const nextStatus = getNextStatus()
  const editMode = getEditMode(order.status)
  const subtotal = order.order_items?.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) || 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/orders" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            ←
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">#{order.order_number}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                {statusConfig.icon} {statusConfig.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {new Date(order.created_at).toLocaleDateString('mn-MN', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button onClick={cancelEdit} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-all">
                Цуцлах
              </button>
              <button onClick={saveEdit} disabled={editSaving} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {editSaving ? '⏳ Хадгалж байна...' : '✅ Хадгалах'}
              </button>
            </>
          ) : (
            <>
              {editMode === 'locked' ? (
                <span className="px-3 py-2 text-xs text-slate-500 border border-slate-700 rounded-xl flex items-center gap-1.5">
                  🔒 Засварлах боломжгүй
                </span>
              ) : (
                <button onClick={startEdit} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all flex items-center gap-1.5">
                  ✏️ {editMode === 'address_only' ? 'Хаяг засах' : 'Засах'}
                </button>
              )}
              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <button
                  onClick={cancelOrder}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all"
                >
                  Цуцлах
                </button>
              )}
              {nextStatus && (
                <button
                  onClick={() => updateStatus(nextStatus)}
                  disabled={updating}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {updating ? '...' : `${STATUS_CONFIG[nextStatus]?.icon} ${STATUS_CONFIG[nextStatus]?.label} болгох`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Захиалгын явц</h3>
            <div className="flex items-center justify-between">
              {STATUS_FLOW.map((status, i) => {
                const config = STATUS_CONFIG[status]
                const currentIdx = STATUS_FLOW.indexOf(order.status)
                const isCompleted = i <= currentIdx && order.status !== 'cancelled'
                const isCurrent = status === order.status

                return (
                  <div key={status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        isCompleted
                          ? isCurrent ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-emerald-500'
                          : 'bg-slate-700'
                      }`}>
                        {isCompleted ? (isCurrent ? config.icon : '✓') : config.icon}
                      </div>
                      <span className={`text-xs mt-2 ${isCompleted ? 'text-white' : 'text-slate-500'}`}>
                        {config.label}
                      </span>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        i < currentIdx ? 'bg-emerald-500' : 'bg-slate-700'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            {order.status === 'cancelled' && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">Энэ захиалга цуцлагдсан байна</p>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className={`bg-slate-800/50 border rounded-2xl p-6 ${isEditing ? 'border-amber-500/40' : 'border-slate-700'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Бүтээгдэхүүнүүд</h3>
              {isEditing && editMode === 'full' && <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">✏️ Засварлаж байна</span>}
              {isEditing && editMode === 'address_only' && <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">🔒 Тоо ширхэг засварлах боломжгүй</span>}
            </div>
            <div className="space-y-3">
              {isEditing && editMode === 'full' ? (
                editItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl border border-slate-600/50">
                    <span className="text-xl">📦</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      <p className="text-slate-400 text-xs">{formatPrice(item.unit_price)} / ширхэг</p>
                    </div>
                    {/* Quantity stepper */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditItems(p => p.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                        className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 text-white flex items-center justify-center text-sm"
                      >−</button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => setEditItems(p => p.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it))}
                        className="w-12 text-center bg-slate-700 border border-slate-500 rounded-lg text-white text-sm py-1 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => setEditItems(p => p.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                        className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 text-white flex items-center justify-center text-sm"
                      >+</button>
                    </div>
                    <div className="w-24 text-right">
                      <p className="text-white text-sm font-medium">{formatPrice(item.unit_price * item.quantity)}</p>
                    </div>
                  </div>
                ))
              ) : (
                order.order_items?.map((item) => {
                  const variant = getItemVariant(item)
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-700/20 rounded-xl">
                      <div className="w-14 h-14 bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                        {((item.products?.images as string[])?.[0] || (item.product_variants?.products?.images as string[])?.[0]) ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={(item.products?.images as string[])?.[0] || (item.product_variants?.products?.images as string[])?.[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{getItemName(item)}</p>
                        {variant && <p className="text-slate-400 text-sm">{variant}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-white">{formatPrice(item.unit_price)}</p>
                        <p className="text-slate-400 text-sm">x{item.quantity}</p>
                      </div>
                      <div className="text-right w-28">
                        <p className="text-white font-medium">{formatPrice(item.unit_price * item.quantity)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Дэд дүн</span>
                <span className="text-white">
                  {isEditing
                    ? formatPrice(editItems.reduce((s, i) => s + i.quantity * i.unit_price, 0))
                    : formatPrice(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Хүргэлт</span>
                {isEditing && editMode === 'full' ? (
                  <input
                    type="number" min={0}
                    value={editData.shippingAmount}
                    onChange={e => setEditData(p => ({ ...p, shippingAmount: parseFloat(e.target.value) || 0 }))}
                    className="w-32 text-right bg-slate-700 border border-amber-500/50 rounded-lg text-white text-sm px-2 py-1 focus:outline-none focus:border-amber-400"
                  />
                ) : (
                  <span className="text-white">{formatPrice(isEditing ? editData.shippingAmount : (order.shipping_amount || 0))}</span>
                )}
              </div>
              <div className="flex items-center justify-between text-base font-medium pt-2 border-t border-slate-700">
                <span className="text-white">Нийт дүн</span>
                <span className={`text-lg font-bold ${isEditing && editMode === 'full' ? 'text-amber-400' : 'text-white'}`}>
                  {isEditing && editMode === 'full'
                    ? formatPrice(editItems.reduce((s, i) => s + i.quantity * i.unit_price, 0) + editData.shippingAmount)
                    : formatPrice(order.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Tracking */}
          {(order.status === 'processing' || order.status === 'shipped') && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Хүргэлтийн мэдээлэл</h3>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Трэкинг дугаар</label>
                <div className="flex items-center gap-3">
                  <input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Хүргэлтийн трэкинг дугаар"
                  />
                  <button
                    onClick={() => {
                      supabase.from('orders').update({ tracking_number: trackingNumber }).eq('id', order.id)
                      setOrder({ ...order, tracking_number: trackingNumber })
                    }}
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
                  >
                    Хадгалах
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className={`bg-slate-800/50 border rounded-2xl p-6 ${isEditing ? 'border-amber-500/40' : 'border-slate-700'}`}>
            <h3 className="text-white font-medium mb-4">Тэмдэглэл</h3>
            <textarea
              value={isEditing ? editData.notes : notes}
              onChange={e => isEditing
                ? setEditData(p => ({ ...p, notes: e.target.value }))
                : setNotes(e.target.value)}
              onBlur={isEditing ? undefined : saveNotes}
              rows={3}
              className={`w-full px-4 py-3 bg-slate-700/50 border rounded-xl text-white text-sm focus:outline-none resize-none transition-all ${isEditing ? 'border-amber-500/50 focus:border-amber-400' : 'border-slate-600 focus:border-blue-500'}`}
              placeholder="Захиалгын тэмдэглэл..."
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className={`bg-slate-800/50 border rounded-2xl p-6 ${isEditing ? 'border-amber-500/40' : 'border-slate-700'}`}>
            <h3 className="text-white font-medium mb-4">Харилцагч</h3>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">FB нэр / Нэр</label>
                  <input
                    value={editData.customerName}
                    onChange={e => setEditData(p => ({ ...p, customerName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-amber-500/50 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
                    placeholder="Харилцагчийн нэр"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Утасны дугаар</label>
                  <input
                    value={editData.customerPhone}
                    onChange={e => setEditData(p => ({ ...p, customerPhone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-amber-500/50 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
                    placeholder="99001122"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {order.customers?.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{order.customers?.name || 'Нэргүй'}</p>
                    {order.customers?.messenger_id && (
                      <span className="text-xs text-blue-400">Messenger</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {order.customers?.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">📱</span>
                      <span className="text-slate-300">{order.customers.phone}</span>
                    </div>
                  )}
                  {order.customers?.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">📧</span>
                      <span className="text-slate-300">{order.customers.email}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  {order.customers?.id && (
                    <Link href={`/dashboard/customers/${order.customers.id}`} className="flex-1 py-2 text-center text-sm text-blue-400 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all">
                      Дэлгэрэнгүй
                    </Link>
                  )}
                  <Link href={`/dashboard/chat?customer=${order.customers?.id}`} className="flex-1 py-2 text-center text-sm text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all">
                    💬 Чат
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Payment */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Төлбөр</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Хэлбэр</span>
                <span className="text-white">
                  {order.payment_method === 'qpay' ? 'QPay' :
                   order.payment_method === 'bank' ? 'Дансаар' :
                   order.payment_method === 'cash' ? 'Бэлэн' : order.payment_method || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Төлөв</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  order.payment_status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : order.payment_status === 'refunded'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {order.payment_status === 'paid' ? 'Төлсөн' :
                   order.payment_status === 'refunded' ? 'Буцаасан' : 'Төлөөгүй'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Дүн</span>
                <span className="text-white font-medium">{formatPrice(order.total_amount)}</span>
              </div>
            </div>

            {/* Payment Actions */}
            {order.payment_status !== 'paid' && order.status !== 'cancelled' && (
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                <p className="text-xs text-slate-500 mb-2">Төлбөр авах</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleCreatePayment('qpay')}
                    disabled={paymentLoading}
                    className="w-full py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg transition-all disabled:opacity-50"
                  >
                    {paymentLoading ? '...' : '💳 QPay нэхэмжлэл'}
                  </button>
                  <button
                    onClick={() => handleCreatePayment('bank')}
                    disabled={paymentLoading}
                    className="w-full py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-lg transition-all disabled:opacity-50"
                  >
                    🏦 Дансаар
                  </button>
                  <button
                    onClick={() => handleMarkPaymentStatus('paid')}
                    disabled={paymentLoading}
                    className="w-full py-2 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-all disabled:opacity-50"
                  >
                    ✅ Төлсөн гэж тэмдэглэх
                  </button>
                </div>
              </div>
            )}

            {/* QPay QR Display */}
            {qrData && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-400 mb-3">QPay QR код</p>
                {qrData.qr_image && (
                  <div className="bg-white rounded-xl p-3 mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${qrData.qr_image}`}
                      alt="QPay QR"
                      className="w-full"
                    />
                  </div>
                )}
                {qrData.short_url && (
                  <a
                    href={qrData.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2 text-center text-sm text-blue-400 border border-blue-500/30 rounded-lg hover:border-blue-500/50 transition-all mb-2"
                  >
                    Линкээр нээх
                  </a>
                )}
                {qrData.deeplinks && qrData.deeplinks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-500">Банкны апп:</p>
                    {qrData.deeplinks.slice(0, 4).map((dl, i) => (
                      <a
                        key={i}
                        href={dl.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all text-xs text-slate-300"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {dl.logo && <img src={dl.logo} alt="" className="w-5 h-5 rounded" />}
                        {dl.name}
                      </a>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleCheckPayment}
                  disabled={paymentLoading}
                  className="w-full mt-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
                >
                  {paymentLoading ? 'Шалгаж байна...' : '🔄 Төлбөр шалгах'}
                </button>
              </div>
            )}

            {/* Bank Transfer Info Display */}
            {bankInfo && (
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                <p className="text-xs text-slate-400 mb-2">Шилжүүлгийн мэдээлэл</p>
                <div className="bg-slate-700/30 rounded-xl p-3 space-y-1.5 text-sm">
                  {bankInfo.bank_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Банк</span>
                      <span className="text-white">{bankInfo.bank_name}</span>
                    </div>
                  )}
                  {bankInfo.bank_account && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Данс</span>
                      <span className="text-white font-mono">{bankInfo.bank_account}</span>
                    </div>
                  )}
                  {bankInfo.bank_holder && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Нэр</span>
                      <span className="text-white">{bankInfo.bank_holder}</span>
                    </div>
                  )}
                  {bankInfo.note && (
                    <div className="pt-1.5 border-t border-slate-600">
                      <p className="text-slate-400 text-xs">{bankInfo.note}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleMarkPaymentStatus('paid')}
                  disabled={paymentLoading}
                  className="w-full mt-2 py-2 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-all disabled:opacity-50"
                >
                  ✅ Шилжүүлэг баталгаажуулах
                </button>
              </div>
            )}

            {/* Refund option for paid orders */}
            {order.payment_status === 'paid' && order.status !== 'cancelled' && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <button
                  onClick={() => handleMarkPaymentStatus('refunded')}
                  disabled={paymentLoading}
                  className="w-full py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all disabled:opacity-50"
                >
                  ↩️ Буцаалт хийх
                </button>
              </div>
            )}

            {/* Error display */}
            {paymentError && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs">{paymentError}</p>
              </div>
            )}
          </div>

          {/* Return Requests */}
          {order.return_requests && order.return_requests.length > 0 && (
            <div className="bg-slate-800/50 border border-orange-500/30 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">↩️ Буцаалт</h3>
              <div className="space-y-3">
                {order.return_requests.map((ret) => (
                  <div key={ret.id} className="p-3 bg-slate-700/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/dashboard/returns/${ret.id}`} className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-all">
                        #{ret.return_number}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        ret.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        ret.status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
                        ret.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {ret.status === 'pending' ? 'Хүлээгдэж буй' :
                         ret.status === 'approved' ? 'Зөвшөөрсөн' :
                         ret.status === 'completed' ? 'Дууссан' : 'Татгалзсан'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {ret.return_type === 'full' ? 'Бүтэн' : 'Хэсэгчилсэн'}
                      </span>
                      <span className="text-white">
                        {ret.refund_amount ? formatPrice(ret.refund_amount) : '-'}
                      </span>
                    </div>
                    {ret.handled_by && (
                      <p className="text-slate-400 text-xs">Хариуцсан: {ret.handled_by}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Info */}
          {deliveryInfo && (
            <div className="bg-slate-800/50 border border-cyan-500/30 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">🚚 Хүргэлт</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Дугаар</span>
                  <Link
                    href={`/dashboard/deliveries/${deliveryInfo.id}`}
                    className="text-blue-400 hover:text-blue-300 transition-all"
                  >
                    #{deliveryInfo.delivery_number}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Төлөв</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    deliveryInfo.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                    deliveryInfo.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    deliveryInfo.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {deliveryInfo.status === 'pending' ? 'Хүлээгдэж буй' :
                     deliveryInfo.status === 'assigned' ? 'Оноосон' :
                     deliveryInfo.status === 'picked_up' ? 'Авсан' :
                     deliveryInfo.status === 'in_transit' ? 'Зам дээр' :
                     deliveryInfo.status === 'delivered' ? 'Хүргэсэн' :
                     deliveryInfo.status === 'failed' ? 'Амжилтгүй' :
                     deliveryInfo.status === 'delayed' ? 'Хоцорсон' :
                     deliveryInfo.status === 'cancelled' ? 'Цуцлагдсан' : deliveryInfo.status}
                  </span>
                </div>
                {deliveryInfo.driver_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Жолооч</span>
                    <span className="text-white">{deliveryInfo.driver_name}</span>
                  </div>
                )}
                {deliveryInfo.driver_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Утас</span>
                    <span className="text-slate-300">{deliveryInfo.driver_phone}</span>
                  </div>
                )}
              </div>
              {/* Wrong item photo */}
              {deliveryInfo.metadata?.wrong_item_photo_url && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-xs font-medium mb-2">📦 Буруу барааны зураг (жолоочоос)</p>
                  <a
                    href={deliveryInfo.metadata.wrong_item_photo_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={deliveryInfo.metadata.wrong_item_photo_url as string}
                      alt="Буруу бараа"
                      className="w-full max-h-48 object-cover rounded-lg border border-red-500/20 cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </a>
                  <p className="text-slate-400 text-xs mt-2">
                    {deliveryInfo.notes || 'Буруу бараа мэдэгдэл'}
                  </p>
                </div>
              )}

              {/* Wrong item action: mark order for re-fulfillment */}
              {deliveryInfo.status === 'failed' && deliveryInfo.metadata?.wrong_item_photo_url && order.status !== 'cancelled' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      if (!confirm('Захиалгыг дахин бэлтгэх болгох уу?')) return
                      setUpdating(true)
                      await supabase.from('orders').update({ status: 'processing', notes: (order.notes ? order.notes + '\n' : '') + `[${new Date().toLocaleDateString('mn-MN')}] Буруу бараа — дахин бэлтгэж байна` }).eq('id', order.id)
                      setOrder(prev => prev ? { ...prev, status: 'processing', notes: (prev.notes ? prev.notes + '\n' : '') + `Буруу бараа — дахин бэлтгэж байна` } : prev)
                      setUpdating(false)
                    }}
                    disabled={updating}
                    className="flex-1 py-2 text-sm bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 rounded-lg transition-all disabled:opacity-50"
                  >
                    🔄 Дахин бэлтгэх
                  </button>
                </div>
              )}

              <Link
                href={`/dashboard/deliveries/${deliveryInfo.id}`}
                className="block w-full mt-4 py-2 text-center text-sm text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 rounded-lg transition-all"
              >
                Дэлгэрэнгүй
              </Link>
            </div>
          )}

          {/* Shipping Address */}
          <div className={`bg-slate-800/50 border rounded-2xl p-6 ${isEditing ? 'border-amber-500/40' : 'border-slate-700'}`}>
            <h3 className="text-white font-medium mb-4">Хүргэлтийн хаяг</h3>
            {isEditing ? (
              <textarea
                value={editData.shippingAddress}
                onChange={e => setEditData(p => ({ ...p, shippingAddress: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-slate-700 border border-amber-500/50 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 resize-none"
                placeholder="Хүргэлтийн хаяг..."
              />
            ) : order.shipping_address ? (
              <p className="text-slate-300 text-sm">{order.shipping_address}</p>
            ) : (
              <p className="text-slate-500 text-sm">Хаяг оруулаагүй</p>
            )}
            {!isEditing && order.tracking_number && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Трэкинг</p>
                <p className="text-white text-sm font-mono">{order.tracking_number}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
