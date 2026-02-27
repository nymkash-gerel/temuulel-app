'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { exportToFile } from '@/lib/export-utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  variant_label: string | null
  products: { name: string } | null
  product_variants: { size: string | null; color: string | null; products: { name: string } | null } | null
}

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  shipping_amount: number
  created_at: string
  order_type: string | null
  notes: string | null
  shipping_address: string | null
  customers: { id: string; name: string | null; phone: string | null } | null
  order_items: OrderItem[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '⏳' },
  confirmed:  { label: 'Баталгаажсан',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      icon: '✅' },
  processing: { label: 'Бэлтгэж буй',   color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '📦' },
  shipped:    { label: 'Илгээсэн',       color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',      icon: '🚚' },
  delivered:  { label: 'Хүргэсэн',       color: 'bg-green-500/20 text-green-400 border-green-500/30',   icon: '✅' },
  cancelled:  { label: 'Цуцлагдсан',     color: 'bg-red-500/20 text-red-400 border-red-500/30',        icon: '❌' },
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat('mn-MN').format(n) + '₮'
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function itemName(item: OrderItem) {
  return item.products?.name || item.product_variants?.products?.name || 'Бараа'
}
function itemVariant(item: OrderItem) {
  if (item.variant_label) return item.variant_label
  const v = item.product_variants
  if (!v) return ''
  return [v.size, v.color].filter(Boolean).join(' / ')
}

// ─── Inline edit state per order ─────────────────────────────────────────────

interface EditState {
  customerName: string
  customerPhone: string
  shippingAddress: string
  notes: string
  shippingAmount: number
  items: { id: string; quantity: number; unit_price: number; name: string }[]
}

function initEdit(order: Order): EditState {
  return {
    customerName:    order.customers?.name    ?? '',
    customerPhone:   order.customers?.phone   ?? '',
    shippingAddress: order.shipping_address   ?? '',
    notes:           order.notes              ?? '',
    shippingAmount:  order.shipping_amount    ?? 0,
    items: (order.order_items ?? []).map(i => ({
      id: i.id, quantity: i.quantity, unit_price: i.unit_price,
      name: itemName(i),
    })),
  }
}

// ─── Single Order Card ────────────────────────────────────────────────────────

function OrderCard({ order, onSaved }: { order: Order; onSaved: (updated: Order) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [edit, setEdit]           = useState<EditState>(() => initEdit(order))

  function startEdit() { setEdit(initEdit(order)); setIsEditing(true) }
  function cancelEdit() { setIsEditing(false) }

  async function saveEdit() {
    setSaving(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:    edit.customerName,
        customer_phone:   edit.customerPhone,
        shipping_address: edit.shippingAddress,
        notes:            edit.notes,
        shipping_amount:  edit.shippingAmount,
        items: edit.items.map(i => ({ id: i.id, quantity: i.quantity, unit_price: i.unit_price })),
      }),
    })
    setSaving(false)
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Алдаа'); return }

    // Optimistically update the card
    onSaved({
      ...order,
      notes:           edit.notes || null,
      shipping_address: edit.shippingAddress || null,
      shipping_amount: edit.shippingAmount,
      total_amount:    edit.items.reduce((s, i) => s + i.quantity * i.unit_price, 0) + edit.shippingAmount,
      customers: order.customers ? { ...order.customers, name: edit.customerName, phone: edit.customerPhone } : null,
      order_items: order.order_items.map(oi => {
        const ei = edit.items.find(e => e.id === oi.id)
        return ei ? { ...oi, quantity: ei.quantity } : oi
      }),
    })
    setIsEditing(false)
  }

  const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const editSubtotal = edit.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  return (
    <div className={`bg-slate-800/50 border rounded-2xl overflow-hidden transition-all ${isEditing ? 'border-amber-500/40' : 'border-slate-700'}`}>
      {/* ── Card Header ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/60">
        <Link href={`/dashboard/orders/${order.id}`} className="text-white font-bold hover:text-blue-400 transition-colors">
          #{order.order_number}
        </Link>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.color}`}>
          {sc.icon} {sc.label}
        </span>
        <span className="text-slate-500 text-xs ml-auto">{fmtDate(order.created_at)}</span>
        {isEditing ? (
          <div className="flex gap-2 ml-2">
            <button onClick={cancelEdit} className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg">Цуцлах</button>
            <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50">
              {saving ? '⏳...' : '✅ Хадгалах'}
            </button>
          </div>
        ) : (
          <button onClick={startEdit} className="ml-2 px-3 py-1 text-xs bg-slate-700 hover:bg-amber-600/30 text-slate-300 hover:text-amber-300 border border-slate-600 hover:border-amber-500/50 rounded-lg transition-all">
            ✏️ Засах
          </button>
        )}
      </div>

      {/* ── Card Body ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-700/40">

        {/* Customer */}
        <div className="px-5 py-4 space-y-1.5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Харилцагч</p>
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={edit.customerName}
                onChange={e => setEdit(p => ({ ...p, customerName: e.target.value }))}
                placeholder="FB нэр"
                className="w-full px-2.5 py-1.5 bg-slate-700 border border-amber-500/40 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
              />
              <input
                value={edit.customerPhone}
                onChange={e => setEdit(p => ({ ...p, customerPhone: e.target.value }))}
                placeholder="Утас"
                className="w-full px-2.5 py-1.5 bg-slate-700 border border-amber-500/40 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          ) : (
            <>
              <p className="text-white text-sm font-medium">{order.customers?.name || '—'}</p>
              <p className="text-slate-400 text-sm">📱 {order.customers?.phone || '—'}</p>
            </>
          )}
        </div>

        {/* Products */}
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Бүтээгдэхүүн</p>
          <div className="space-y-1.5">
            {isEditing ? (
              edit.items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs truncate flex-1">{item.name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEdit(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it) }))}
                      className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center">−</button>
                    <input type="number" min={1} value={item.quantity}
                      onChange={e => setEdit(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it) }))}
                      className="w-10 text-center bg-slate-700 border border-amber-500/40 rounded text-white text-xs py-0.5 focus:outline-none" />
                    <button onClick={() => setEdit(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it) }))}
                      className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center">+</button>
                  </div>
                  <span className="text-slate-400 text-xs w-20 text-right flex-shrink-0">{fmtPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))
            ) : (
              order.order_items?.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="text-white truncate flex-1">{itemName(item)}</span>
                  {itemVariant(item) && <span className="text-slate-500 text-xs">{itemVariant(item)}</span>}
                  <span className="text-slate-400 flex-shrink-0">x{item.quantity}</span>
                  <span className="text-white font-medium flex-shrink-0">{fmtPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Address + Notes */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1.5">Хаяг</p>
            {isEditing ? (
              <textarea
                value={edit.shippingAddress}
                onChange={e => setEdit(p => ({ ...p, shippingAddress: e.target.value }))}
                rows={2}
                placeholder="Хүргэлтийн хаяг..."
                className="w-full px-2.5 py-1.5 bg-slate-700 border border-amber-500/40 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 resize-none"
              />
            ) : (
              <p className="text-slate-300 text-sm">{order.shipping_address || <span className="text-slate-600 italic">Хаяг байхгүй</span>}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1.5">Тэмдэглэл</p>
            {isEditing ? (
              <textarea
                value={edit.notes}
                onChange={e => setEdit(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Тэмдэглэл..."
                className="w-full px-2.5 py-1.5 bg-slate-700 border border-amber-500/40 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 resize-none"
              />
            ) : (
              <p className="text-slate-300 text-sm">{order.notes || <span className="text-slate-600 italic">—</span>}</p>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Дүн</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Дэд дүн</span>
              <span className="text-white">
                {isEditing ? fmtPrice(editSubtotal) : fmtPrice(order.order_items?.reduce((s, i) => s + i.quantity * i.unit_price, 0) ?? 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Хүргэлт</span>
              {isEditing ? (
                <input type="number" min={0} value={edit.shippingAmount}
                  onChange={e => setEdit(p => ({ ...p, shippingAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-24 text-right bg-slate-700 border border-amber-500/40 rounded px-2 py-0.5 text-white text-sm focus:outline-none" />
              ) : (
                <span className="text-white">{fmtPrice(order.shipping_amount ?? 0)}</span>
              )}
            </div>
            <div className="flex justify-between pt-1.5 border-t border-slate-700">
              <span className="text-white font-medium">Нийт</span>
              <span className={`font-bold text-base ${isEditing ? 'text-amber-400' : 'text-white'}`}>
                {isEditing ? fmtPrice(editSubtotal + edit.shippingAmount) : fmtPrice(order.total_amount)}
              </span>
            </div>
          </div>
          <Link href={`/dashboard/orders/${order.id}`}
            className="mt-3 block w-full py-1.5 text-center text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all">
            Дэлгэрэнгүй →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading]               = useState(true)
  const [orders, setOrders]                 = useState<Order[]>([])
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState('')
  const [dateFilter, setDateFilter]         = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).single()
    if (!store) { setLoading(false); return }

    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, total_amount, shipping_amount, created_at, order_type, notes, shipping_address,
        customers(id, name, phone),
        order_items(
          id, quantity, unit_price, variant_label,
          products(name),
          product_variants(size, color, products(name))
        )
      `)
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })

    if (data) setOrders(data as unknown as Order[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  const getStatusLabel = (s: string) => STATUS_CONFIG[s]?.label ?? s

  const filteredOrders = useMemo(() => {
    let r = orders
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        o.customers?.name?.toLowerCase().includes(q) ||
        o.customers?.phone?.includes(q) ||
        o.shipping_address?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) r = r.filter(o => o.status === statusFilter)
    if (dateFilter) {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (dateFilter === 'today')  r = r.filter(o => new Date(o.created_at) >= today)
      if (dateFilter === 'week')   { const w = new Date(today); w.setDate(w.getDate() - w.getDay()); r = r.filter(o => new Date(o.created_at) >= w) }
      if (dateFilter === 'month')  r = r.filter(o => new Date(o.created_at) >= new Date(now.getFullYear(), now.getMonth(), 1))
    }
    return r
  }, [orders, search, statusFilter, dateFilter])

  function handleSaved(updated: Order) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    exportToFile(
      filteredOrders.map(o => ({
        'Дугаар': o.order_number,
        'Харилцагч': o.customers?.name || '',
        'Утас': o.customers?.phone || '',
        'Хаяг': o.shipping_address || '',
        'Бүтээгдэхүүн': o.order_items?.map(i => `${itemName(i)} x${i.quantity}`).join(', ') || '',
        'Нийт дүн': Number(o.total_amount),
        'Тэмдэглэл': o.notes || '',
        'Төлөв': getStatusLabel(o.status),
        'Огноо': new Date(o.created_at).toLocaleDateString('mn-MN'),
      })),
      `захиалга_${new Date().toISOString().slice(0, 10)}`,
      format, 'Захиалга'
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Захиалга</h1>
          <p className="text-slate-400 mt-1">
            Нийт {orders.length} захиалга
            {filteredOrders.length !== orders.length && ` · ${filteredOrders.length} илэрц`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/dashboard/deliveries" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all">
            🚚 Хүргэлт
          </Link>
          {orders.length > 0 && (
            <>
              <button onClick={() => handleExport('xlsx')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all">📥 Excel</button>
              <button onClick={() => handleExport('csv')}  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all">📄 CSV</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Хүлээгдэж буй', count: orders.filter(o => o.status === 'pending').length,                            bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400' },
          { label: 'Боловсруулж буй', count: orders.filter(o => ['confirmed','processing'].includes(o.status)).length,   bg: 'bg-blue-500/10 border-blue-500/20',   text: 'text-blue-400' },
          { label: 'Илгээсэн',       count: orders.filter(o => o.status === 'shipped').length,                           bg: 'bg-cyan-500/10 border-cyan-500/20',   text: 'text-cyan-400' },
          { label: 'Хүргэсэн',       count: orders.filter(o => o.status === 'delivered').length,                         bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-3 ${s.bg}`}>
            <p className={`text-sm ${s.text}`}>{s.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Дугаар, нэр, утас, хаяг хайх..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="">Бүх төлөв</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="">Бүх хугацаа</option>
            <option value="today">Өнөөдөр</option>
            <option value="week">Энэ долоо хоног</option>
            <option value="month">Энэ сар</option>
          </select>
          {(search || statusFilter || dateFilter) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter('') }}
              className="px-3 py-2.5 text-slate-400 hover:text-white text-sm bg-slate-700 rounded-xl">✕</button>
          )}
        </div>
      </div>

      {/* Order Cards */}
      {filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} onSaved={handleSaved} />
          ))}
        </div>
      ) : orders.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох захиалга олдсонгүй</p>
          <button onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🛒</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Захиалга байхгүй байна</h3>
          <p className="text-slate-400 mb-6">Хэрэглэгчид chatbot-оор захиалга өгөхөд энд харагдана</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard/products" className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">📦 Бүтээгдэхүүн</Link>
            <Link href="/dashboard/settings/integrations" className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm">💬 Messenger</Link>
          </div>
        </div>
      )}
    </div>
  )
}
