'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { exportToFile } from '@/lib/export-utils'
import { formatPrice } from '@/lib/format'

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

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:    { label: 'Хүлээгдэж буй', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-l-yellow-500' },
  confirmed:  { label: 'Баталгаажсан',  dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-l-blue-500' },
  processing: { label: 'Бэлтгэж буй',   dot: 'bg-purple-400', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-l-purple-500' },
  shipped:    { label: 'Илгээсэн',       dot: 'bg-cyan-400',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-l-cyan-500' },
  delivered:  { label: 'Хүргэсэн',       dot: 'bg-emerald-400',bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-l-emerald-500' },
  cancelled:  { label: 'Цуцлагдсан',     dot: 'bg-red-400',    bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-l-red-500' },
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

function getEditMode(status: string): 'full' | 'address_only' | 'locked' {
  if (['picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'].includes(status)) return 'locked'
  if (['assigned', 'at_store'].includes(status)) return 'address_only'
  return 'full'
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
    const currentEditMode = getEditMode(order.status)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:    edit.customerName,
        customer_phone:   edit.customerPhone,
        shipping_address: edit.shippingAddress,
        notes:            edit.notes,
        ...(currentEditMode === 'full' ? {
          shipping_amount: edit.shippingAmount,
          items: edit.items.map(i => ({ id: i.id, quantity: i.quantity, unit_price: i.unit_price })),
        } : {}),
      }),
    })
    setSaving(false)
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Алдаа'); return }

    onSaved({
      ...order,
      notes:           edit.notes || null,
      shipping_address: edit.shippingAddress || null,
      ...(currentEditMode === 'full' ? {
        shipping_amount: edit.shippingAmount,
        total_amount:    edit.items.reduce((s, i) => s + i.quantity * i.unit_price, 0) + edit.shippingAmount,
        order_items: order.order_items.map(oi => {
          const ei = edit.items.find(e => e.id === oi.id)
          return ei ? { ...oi, quantity: ei.quantity } : oi
        }),
      } : {}),
      customers: order.customers ? { ...order.customers, name: edit.customerName, phone: edit.customerPhone } : null,
    })
    setIsEditing(false)
  }

  const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const editMode = getEditMode(order.status)
  const editSubtotal = edit.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  return (
    <div className={`bg-white/[0.02] border rounded-2xl overflow-hidden transition-all border-l-2 ${sc.border} ${isEditing ? 'border-amber-500/40 border-l-amber-500' : 'border-white/[0.06]'}`}>
      {/* Card Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04]">
        <Link href={`/dashboard/orders/${order.id}`} className="text-white font-semibold text-sm hover:text-blue-400 transition-colors">
          #{order.order_number}
        </Link>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium ${sc.bg} ${sc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {sc.label}
        </span>
        {order.order_type && order.order_type !== 'normal' && (
          <span className="px-2 py-0.5 rounded-lg text-[10px] bg-orange-500/10 text-orange-400 font-medium">
            {order.order_type === 'intercity' ? 'Хот хоорондын' : order.order_type}
          </span>
        )}
        <span className="text-slate-600 text-xs ml-auto">{fmtDate(order.created_at)}</span>
        {isEditing ? (
          <div className="flex gap-1.5 ml-2">
            <button onClick={cancelEdit} className="px-2.5 py-1 text-[11px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 rounded-lg transition-all">Цуцлах</button>
            <button onClick={saveEdit} disabled={saving} className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 font-medium transition-all">
              {saving ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : 'Хадгалах'}
            </button>
          </div>
        ) : editMode === 'locked' ? (
          <span className="ml-2 text-slate-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
          </span>
        ) : (
          <button onClick={startEdit} className="ml-2 px-2.5 py-1 text-[11px] bg-white/[0.04] hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 border border-white/[0.06] hover:border-amber-500/30 rounded-lg transition-all">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
              {editMode === 'address_only' ? 'Хаяг' : 'Засах'}
            </span>
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.04]">

        {/* Customer */}
        <div className="px-5 py-3.5 space-y-1">
          <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest mb-1.5">Харилцагч</p>
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={edit.customerName}
                onChange={e => setEdit(p => ({ ...p, customerName: e.target.value }))}
                placeholder="Нэр"
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-amber-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
              <input
                value={edit.customerPhone}
                onChange={e => setEdit(p => ({ ...p, customerPhone: e.target.value }))}
                placeholder="Утас"
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-amber-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          ) : (
            <>
              <p className="text-white text-sm">{order.customers?.name || '—'}</p>
              {order.customers?.phone && <p className="text-slate-500 text-xs">{order.customers.phone}</p>}
            </>
          )}
        </div>

        {/* Products */}
        <div className="px-5 py-3.5">
          <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest mb-1.5">Бүтээгдэхүүн</p>
          <div className="space-y-1">
            {isEditing && editMode === 'full' ? (
              edit.items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs truncate flex-1">{item.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => setEdit(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it) }))}
                      className="w-5 h-5 rounded bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs flex items-center justify-center transition-colors">-</button>
                    <input type="number" min={1} value={item.quantity}
                      onChange={e => setEdit(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it) }))}
                      className="w-9 text-center bg-white/[0.04] border border-amber-500/30 rounded text-white text-xs py-0.5 focus:outline-none" />
                    <button onClick={() => setEdit(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it) }))}
                      className="w-5 h-5 rounded bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs flex items-center justify-center transition-colors">+</button>
                  </div>
                  <span className="text-slate-500 text-xs w-16 text-right shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))
            ) : (
              order.order_items?.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-300 truncate flex-1">{itemName(item)}</span>
                  {itemVariant(item) && <span className="text-slate-600 text-[11px] shrink-0">{itemVariant(item)}</span>}
                  <span className="text-slate-500 text-xs shrink-0">x{item.quantity}</span>
                  <span className="text-white text-xs font-medium shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Address + Notes */}
        <div className="px-5 py-3.5 space-y-3">
          <div>
            <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest mb-1">Хаяг</p>
            {isEditing ? (
              <textarea
                value={edit.shippingAddress}
                onChange={e => setEdit(p => ({ ...p, shippingAddress: e.target.value }))}
                rows={2}
                placeholder="Хүргэлтийн хаяг..."
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-amber-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 resize-none transition-colors"
              />
            ) : (
              <p className="text-slate-400 text-sm">{order.shipping_address || <span className="text-slate-600">Хаяг байхгүй</span>}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest mb-1">Тэмдэглэл</p>
            {isEditing ? (
              <textarea
                value={edit.notes}
                onChange={e => setEdit(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Тэмдэглэл..."
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-amber-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 resize-none transition-colors"
              />
            ) : (
              <p className="text-slate-400 text-sm">{order.notes || <span className="text-slate-600">—</span>}</p>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="px-5 py-3.5">
          <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest mb-1.5">Дүн</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs">Дэд дүн</span>
              <span className="text-slate-300 text-xs">
                {isEditing ? formatPrice(editSubtotal) : formatPrice(order.order_items?.reduce((s, i) => s + i.quantity * i.unit_price, 0) ?? 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-xs">Хүргэлт</span>
              {isEditing ? (
                <input type="number" min={0} value={edit.shippingAmount}
                  onChange={e => setEdit(p => ({ ...p, shippingAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-20 text-right bg-white/[0.04] border border-amber-500/30 rounded px-2 py-0.5 text-white text-xs focus:outline-none" />
              ) : (
                <span className="text-slate-300 text-xs">{formatPrice(order.shipping_amount ?? 0)}</span>
              )}
            </div>
            <div className="flex justify-between pt-1.5 border-t border-white/[0.06]">
              <span className="text-white text-sm font-medium">Нийт</span>
              <span className={`font-bold text-sm ${isEditing ? 'text-amber-400' : 'text-white'}`}>
                {isEditing ? formatPrice(editSubtotal + edit.shippingAmount) : formatPrice(order.total_amount)}
              </span>
            </div>
          </div>
          <Link href={`/dashboard/orders/${order.id}`}
            className="mt-3 flex items-center justify-center gap-1 w-full py-1.5 text-[11px] text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-all">
            Дэлгэрэнгүй
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders]                 = useState<Order[]>(initialOrders)
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState('')
  const [dateFilter, setDateFilter]         = useState('')

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

  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total_amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Захиалга</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Нийт {orders.length} захиалга
            {filteredOrders.length !== orders.length && ` · ${filteredOrders.length} илэрц`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/deliveries" className="px-3.5 py-2 text-sm bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 rounded-xl transition-all">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
              Хүргэлт
            </span>
          </Link>
          {orders.length > 0 && (
            <div className="relative group">
              <button className="px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-400 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-[#141520] border border-white/[0.1] rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px] shadow-xl">
                <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">Excel</button>
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">CSV</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Хүлээгдэж буй', value: orders.filter(o => o.status === 'pending').length, gradient: 'from-yellow-500/20 to-yellow-600/5' },
          { label: 'Боловсруулж буй', value: orders.filter(o => ['confirmed','processing'].includes(o.status)).length, gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Илгээсэн', value: orders.filter(o => o.status === 'shipped').length, gradient: 'from-cyan-500/20 to-cyan-600/5' },
          { label: 'Хүргэсэн', value: orders.filter(o => o.status === 'delivered').length, gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Нийт орлого', value: null, display: formatPrice(totalRevenue), gradient: 'from-purple-500/20 to-purple-600/5' },
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Дугаар, нэр, утас, хаяг хайх..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10 transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]">
          <option value="">Бүх төлөв</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]">
          <option value="">Бүх хугацаа</option>
          <option value="today">Өнөөдөр</option>
          <option value="week">Энэ долоо хоног</option>
          <option value="month">Энэ сар</option>
        </select>
        {(search || statusFilter || dateFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter('') }}
            className="px-3 py-2.5 text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Order Cards */}
      {filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} onSaved={handleSaved} />
          ))}
        </div>
      ) : orders.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <p className="text-slate-500">Хайлтад тохирох захиалга олдсонгүй</p>
          <button onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter('') }}
            className="mt-4 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all">
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Захиалга байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6">Хэрэглэгчид chatbot-оор захиалга өгөхөд энд харагдана</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/products" className="px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all">Бүтээгдэхүүн</Link>
            <Link href="/dashboard/settings/integrations" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400">Messenger холбох</Link>
          </div>
        </div>
      )}
    </div>
  )
}
