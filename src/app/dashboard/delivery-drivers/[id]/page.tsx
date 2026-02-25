'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Driver {
  id: string
  name: string
  phone: string | null
  email: string | null
  vehicle_type: string | null
  vehicle_number: string | null
  status: string
  telegram_chat_id: number | null
  telegram_linked_at: string | null
  delivery_zones: string[]
  avg_rating: number
  rating_count: number
  created_at: string
  updated_at: string
}

interface Delivery {
  id: string
  delivery_number: string
  status: string
  delivery_type: string
  delivery_address: string | null
  customer_name: string | null
  customer_phone: string | null
  delivery_fee: number | null
  created_at: string
  estimated_delivery_time: string | null
  actual_delivery_time: string | null
  failure_reason: string | null
  notes: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null
  orders: { id: string; order_number: string; total_amount: number; payment_status: string | null } | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DELIVERY_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400',  icon: '⏳' },
  assigned:   { label: 'Оноосон',        color: 'bg-blue-500/20 text-blue-400',      icon: '👤' },
  at_store:   { label: 'Дэлгүүрт',       color: 'bg-cyan-500/20 text-cyan-400',      icon: '🏪' },
  picked_up:  { label: 'Авсан',          color: 'bg-indigo-500/20 text-indigo-400',  icon: '📦' },
  in_transit: { label: 'Замд яваа',      color: 'bg-purple-500/20 text-purple-400',  icon: '🚚' },
  delivered:  { label: 'Хүргэсэн',       color: 'bg-green-500/20 text-green-400',    icon: '✅' },
  failed:     { label: 'Амжилтгүй',      color: 'bg-red-500/20 text-red-400',        icon: '❌' },
  cancelled:  { label: 'Цуцлагдсан',     color: 'bg-slate-500/20 text-slate-400',    icon: '🚫' },
  delayed:    { label: 'Хоцорсон',       color: 'bg-orange-500/20 text-orange-400',  icon: '⚠️' },
}

const PAYMENT_BADGE: Record<string, { label: string; color: string }> = {
  paid:    { label: '✅ Төлсөн',    color: 'text-green-400' },
  pending: { label: '⏳ Хүлээгдэж', color: 'text-orange-400' },
  partial: { label: '💸 Дутуу',     color: 'text-yellow-400' },
  failed:  { label: '❌ Татгалзав', color: 'text-red-400' },
  unpaid:  { label: '💰 Аваагүй',   color: 'text-orange-400' },
}

const DRIVER_STATUS: Record<string, { label: string; color: string }> = {
  active:      { label: 'Идэвхтэй',       color: 'bg-green-500/20 text-green-400' },
  on_delivery: { label: 'Хүргэлтэнд',     color: 'bg-blue-500/20 text-blue-400' },
  offline:     { label: 'Офлайн',         color: 'bg-slate-500/20 text-slate-400' },
  suspended:   { label: 'Түтгэлзүүлсэн', color: 'bg-red-500/20 text-red-400' },
}

const ACTIVE_STATUSES = ['assigned', 'at_store', 'picked_up', 'in_transit', 'delayed']
const TERMINAL_STATUSES = ['delivered', 'cancelled', 'failed']

const TZ = 'Asia/Ulaanbaatar'

function toLocalDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) // "2026-02-25"
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('mn-MN', { timeZone: TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDay(iso: string) {
  // "2026-02-25" → "2/25"
  const [, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function fmtPrice(n: number | null) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('mn-MN').format(n) + '₮'
}

type QuickFilter = 'delayed' | 'complaint' | 'unpaid' | 'refused' | 'cancelled' | null

function matchesQuick(d: Delivery, qf: QuickFilter): boolean {
  if (!qf) return true
  switch (qf) {
    case 'delayed':   return d.status === 'delayed'
    case 'complaint': return !!(d.notes?.includes('гомдол') || d.metadata?.refusal_reason || d.metadata?.customer_refused)
    case 'unpaid':    return d.status === 'delivered' && ['pending', 'unpaid', null].includes(d.orders?.payment_status ?? null)
    case 'refused':   return !!(d.metadata?.customer_refused || d.notes?.includes('татгалзав'))
    case 'cancelled': return d.status === 'cancelled' || d.status === 'failed'
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DriverDetailPage() {
  const params = useParams()
  const driverId = params.id as string
  const supabase = createClient()

  const [driver, setDriver]           = useState<Driver | null>(null)
  const [deliveries, setDeliveries]   = useState<Delivery[]>([])
  const [loading, setLoading]         = useState(true)
  const [deliveryLoading, setDeliveryLoading] = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // Edit profile
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData]   = useState<Record<string, unknown>>({})
  const [saving, setSaving]       = useState(false)

  // Filters
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedDay, setSelectedDay]   = useState<string>('') // 'all' | YYYY-MM-DD
  const [quickFilter, setQuickFilter]   = useState<QuickFilter>(null)
  const [deliveryTab, setDeliveryTab]   = useState<'all' | 'active' | 'done'>('all')

  // Delivery actions
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Load driver profile ──────────────────────────────────────────────────
  const loadDriver = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('delivery_drivers')
      .select('*')
      .eq('id', driverId)
      .single()
    if (error || !data) setError('Жолооч олдсонгүй')
    else setDriver(data as unknown as Driver)
    setLoading(false)
  }, [driverId, supabase])

  // ── Load deliveries ──────────────────────────────────────────────────────
  const loadDeliveries = useCallback(async () => {
    setDeliveryLoading(true)
    const { data } = await supabase
      .from('deliveries')
      .select(`
        id, delivery_number, status, delivery_type,
        delivery_address, customer_name, customer_phone,
        delivery_fee, created_at, estimated_delivery_time,
        actual_delivery_time, failure_reason, notes, metadata,
        orders(id, order_number, total_amount, payment_status)
      `)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(300)
    setDeliveries((data as Delivery[]) ?? [])
    setDeliveryLoading(false)
  }, [driverId, supabase])

  useEffect(() => {
    loadDriver()
    loadDeliveries()
  }, [loadDriver, loadDeliveries])

  // ── All-deliveries stats (ignores active filters) ────────────────────────
  const stats = useMemo(() => {
    const terminal  = deliveries.filter(d => TERMINAL_STATUSES.includes(d.status))
    const delivered = deliveries.filter(d => d.status === 'delivered')
    const cancelled = deliveries.filter(d => ['cancelled', 'failed'].includes(d.status))
    const active    = deliveries.filter(d => ACTIVE_STATUSES.includes(d.status))
    const delayed   = deliveries.filter(d => d.status === 'delayed')
    const complained= deliveries.filter(d => d.notes?.includes('гомдол') || d.metadata?.customer_refused)
    const unpaid    = deliveries.filter(d =>
      d.status === 'delivered' && ['pending', 'unpaid', null].includes(d.orders?.payment_status ?? null)
    )
    const earnings  = delivered.reduce((s, d) => s + (d.delivery_fee ?? 0), 0)

    const successPct = terminal.length > 0
      ? Math.round((delivered.length / (terminal.length)) * 100) : 0
    const cancelPct  = terminal.length > 0
      ? Math.round((cancelled.length / (terminal.length)) * 100) : 0

    // Daily payment breakdown — group delivered by local day
    const dailyMap: Record<string, { fee: number; count: number }> = {}
    for (const d of delivered) {
      const day = toLocalDay(d.created_at)
      if (!dailyMap[day]) dailyMap[day] = { fee: 0, count: 0 }
      dailyMap[day].fee   += d.delivery_fee ?? 0
      dailyMap[day].count += 1
    }
    const dailyBreakdown = Object.entries(dailyMap)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .slice(0, 14)

    return {
      total: deliveries.length,
      active: active.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      delayed: delayed.length,
      complained: complained.length,
      unpaid: unpaid.length,
      earnings,
      successPct,
      cancelPct,
      dailyBreakdown,
    }
  }, [deliveries])

  // ── Distinct days (for day picker) ──────────────────────────────────────
  const distinctDays = useMemo(() => {
    const days = new Set(deliveries.map(d => toLocalDay(d.created_at)))
    return [...days].sort((a, b) => b.localeCompare(a)).slice(0, 7)
  }, [deliveries])

  // ── Today string ────────────────────────────────────────────────────────
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: TZ }), [])

  // ── Filtered deliveries ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return deliveries.filter(d => {
      // Tab filter
      if (deliveryTab === 'active' && !ACTIVE_STATUSES.includes(d.status)) return false
      if (deliveryTab === 'done'   && !TERMINAL_STATUSES.includes(d.status)) return false

      // Day filter
      if (selectedDay && toLocalDay(d.created_at) !== selectedDay) return false

      // Quick filter
      if (!matchesQuick(d, quickFilter)) return false

      // Search
      if (q) {
        const haystack = [
          d.customer_name, d.customer_phone,
          d.delivery_number, d.orders?.order_number,
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [deliveries, searchQuery, selectedDay, quickFilter, deliveryTab])

  // ── Profile edit ─────────────────────────────────────────────────────────
  function startEdit() {
    if (!driver) return
    setEditData({
      name: driver.name || '',
      phone: driver.phone || '',
      email: driver.email || '',
      vehicle_type: driver.vehicle_type || '',
      vehicle_number: driver.vehicle_number || '',
      delivery_zones: (driver.delivery_zones ?? []).join(', '),
    })
    setIsEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const zones = String(editData.delivery_zones || '')
      .split(',').map((z: string) => z.trim()).filter(Boolean)
    const res = await fetch(`/api/delivery-drivers/${driverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editData.name || undefined,
        phone: editData.phone || undefined,
        email: editData.email || undefined,
        vehicle_type: editData.vehicle_type || undefined,
        vehicle_number: editData.vehicle_number || undefined,
        delivery_zones: zones,
      }),
    })
    setSaving(false)
    if (res.ok) { setIsEditing(false); loadDriver() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'Алдаа гарлаа') }
  }

  // ── Delivery actions ─────────────────────────────────────────────────────
  async function patchDelivery(deliveryId: string, body: Record<string, unknown>) {
    setActionLoading(deliveryId)
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setDeliveries(prev => prev.map(d =>
        d.id === deliveryId ? { ...d, ...body, status: (body.status as string) ?? d.status } : d
      ))
    } else {
      const e = await res.json().catch(() => ({}))
      alert(e.error || 'Алдаа гарлаа')
    }
    setActionLoading(null)
  }

  async function handleUnassign(deliveryId: string) {
    if (!confirm('Энэ хүргэлтээс жолоочийг чөлөөлөх үү?')) return
    await patchDelivery(deliveryId, { driver_id: null, status: 'pending' })
    setDeliveries(prev => prev.filter(d => d.id !== deliveryId))
  }

  async function handleCancel(deliveryId: string) {
    if (!confirm('Хүргэлт цуцлах уу?')) return
    await patchDelivery(deliveryId, { status: 'cancelled' })
  }

  function toggleQuickFilter(qf: QuickFilter) {
    setQuickFilter(prev => prev === qf ? null : qf)
  }

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )
  if (error || !driver) return (
    <div className="text-center py-12">
      <p className="text-slate-400">{error || 'Жолооч олдсонгүй'}</p>
      <Link href="/dashboard/delivery-drivers" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">← Буцах</Link>
    </div>
  )

  const dsc = DRIVER_STATUS[driver.status] ?? { label: driver.status, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/delivery-drivers" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {driver.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{driver.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dsc.color}`}>{dsc.label}</span>
              {driver.telegram_chat_id && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/20 text-sky-400">✈️ Telegram холбогдсон</span>
              )}
              {driver.avg_rating > 0 && (
                <span className="text-yellow-400 text-sm">⭐ {driver.avg_rating.toFixed(1)} ({driver.rating_count})</span>
              )}
            </div>
          </div>
        </div>
        {!isEditing
          ? <button onClick={startEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all">✏️ Засах</button>
          : <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl transition-all">Цуцлах</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50">
                {saving ? 'Хадгалж байна...' : '✅ Хадгалах'}
              </button>
            </div>
        }
      </div>

      {/* ── Profile + Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Profile card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Мэдээлэл</h2>
          {isEditing ? (
            <div className="space-y-3">
              {[
                { key: 'name',           label: 'Нэр' },
                { key: 'phone',          label: 'Утас' },
                { key: 'email',          label: 'И-мэйл' },
                { key: 'vehicle_type',   label: 'Тээврийн хэрэгсэл' },
                { key: 'vehicle_number', label: 'Дугаарын тэмдэг' },
                { key: 'delivery_zones', label: 'Хүргэлтийн бүс (таслалаар)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400">{label}</label>
                  <input
                    value={String(editData[key] ?? '')}
                    onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              {[
                { label: '📞 Утас',            value: driver.phone },
                { label: '📧 И-мэйл',          value: driver.email },
                { label: '🚗 Тээврийн хэрэгсэл', value: driver.vehicle_type },
                { label: '🔢 Дугаарын тэмдэг',  value: driver.vehicle_number },
                { label: '✈️ Telegram',         value: driver.telegram_chat_id ? `ID: ${driver.telegram_chat_id}` : 'Холбогдоогүй' },
                { label: '📅 Бүртгэсэн',        value: fmt(driver.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white">{value ?? '—'}</span>
                </div>
              ))}
              {driver.delivery_zones.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">📍 Хүргэлтийн бүс</span>
                  <span className="text-white text-right">{driver.delivery_zones.join(', ')}</span>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-3">
          {/* Performance grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-slate-400 text-xs">✅ Амжилттай хүргэлт</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.delivered}</p>
              <p className="text-green-300 text-sm">{stats.successPct}%</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-slate-400 text-xs">❌ Цуцлагдсан</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.cancelled}</p>
              <p className="text-red-300 text-sm">{stats.cancelPct}%</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
              <p className="text-slate-400 text-xs">⚠️ Хоцорсон</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">{stats.delayed}</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
              <p className="text-slate-400 text-xs">💰 Төлбөр аваагүй</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{stats.unpaid}</p>
            </div>
          </div>
          {/* Total earnings */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <p className="text-slate-400 text-xs">💰 Нийт орлого (хүргэсэн)</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{fmtPrice(stats.earnings)}</p>
          </div>
        </div>
      </div>

      {/* ── Daily payment breakdown ────────────────────────────────────────── */}
      {stats.dailyBreakdown.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">💵 Өдрийн орлого</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {stats.dailyBreakdown.map(([day, { fee, count }]) => {
              const isToday     = day === todayStr
              const isYesterday = day === new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: TZ })
              const label = isToday ? 'Өнөөдөр' : isYesterday ? 'Өчигдөр' : fmtDay(day)
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(prev => prev === day ? '' : day)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm border transition-all text-center min-w-[80px] ${
                    selectedDay === day
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : isToday
                        ? 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20'
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <p className="font-medium">{label}</p>
                  <p className="text-xs mt-0.5 font-bold">{fmtPrice(fee)}</p>
                  <p className="text-xs opacity-60">{count} хүргэлт</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Deliveries section ────────────────────────────────────────────── */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">

        {/* Tab bar + search */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-700 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-white">Хүргэлтүүд</h2>
            {/* Tab buttons */}
            <div className="flex gap-1">
              {([
                { key: 'all',    label: `Бүгд (${stats.total})` },
                { key: 'active', label: `🚚 Идэвхтэй (${stats.active})` },
                { key: 'done',   label: `✅ Дууссан (${stats.delivered + stats.cancelled})` },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDeliveryTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    deliveryTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + day picker row */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Хайх: нэр, утас, дугаар…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {/* Day picker */}
            <div className="flex gap-1 items-center flex-wrap">
              <button
                onClick={() => setSelectedDay('')}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${!selectedDay ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                Бүгд
              </button>
              {distinctDays.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(prev => prev === day ? '' : day)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                    selectedDay === day
                      ? 'bg-blue-600 text-white'
                      : day === todayStr
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {day === todayStr ? 'Өнөөдөр' : fmtDay(day)}
                </button>
              ))}
              <input
                type="date"
                value={selectedDay}
                onChange={e => setSelectedDay(e.target.value)}
                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Quick filter buttons */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'delayed',   label: '⚠️ Хоцорсон',         count: stats.delayed,    color: 'orange' },
              { key: 'complaint', label: '💬 Гомдол',            count: stats.complained, color: 'pink' },
              { key: 'unpaid',    label: '💰 Төлбөр аваагүй',    count: stats.unpaid,     color: 'rose' },
              { key: 'refused',   label: '🚫 Харилцагч татгалзсан', count: deliveries.filter(d => d.metadata?.customer_refused).length, color: 'purple' },
              { key: 'cancelled', label: '❌ Цуцлагдсан',        count: stats.cancelled,  color: 'slate' },
            ] as const).map(({ key, label, count, color }) => {
              const active = quickFilter === key
              const colorMap: Record<string, string> = {
                orange: active ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20',
                pink:   active ? 'bg-pink-500 text-white border-pink-500'     : 'bg-pink-500/10 text-pink-400 border-pink-500/30 hover:bg-pink-500/20',
                rose:   active ? 'bg-rose-500 text-white border-rose-500'     : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20',
                purple: active ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20',
                slate:  active ? 'bg-slate-500 text-white border-slate-500'   : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600',
              }
              if (count === 0 && !active) return null
              return (
                <button
                  key={key}
                  onClick={() => toggleQuickFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all font-medium ${colorMap[color]}`}
                >
                  {label} {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        {deliveryLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {searchQuery || selectedDay || quickFilter ? 'Тохирох хүргэлт байхгүй' : 'Хүргэлт байхгүй байна'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Хүргэлт</th>
                  <th className="px-5 py-3">Захиалга</th>
                  <th className="px-5 py-3">Хүлээн авагч</th>
                  <th className="px-5 py-3">Хаяг</th>
                  <th className="px-5 py-3">Төлөв</th>
                  <th className="px-5 py-3">Огноо</th>
                  <th className="px-5 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(del => {
                  const ds = DELIVERY_STATUS[del.status] ?? { label: del.status, color: 'bg-slate-500/20 text-slate-400', icon: '❓' }
                  const isActive  = ACTIVE_STATUSES.includes(del.status)
                  const isLoading = actionLoading === del.id
                  const payBadge  = del.orders?.payment_status ? PAYMENT_BADGE[del.orders.payment_status] : null
                  return (
                    <tr key={del.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-all">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/deliveries/${del.id}`} className="text-blue-400 hover:text-blue-300 font-medium text-sm">
                          #{del.delivery_number}
                        </Link>
                        {del.delivery_fee != null && (
                          <p className="text-xs text-slate-400 mt-0.5">{fmtPrice(del.delivery_fee)}</p>
                        )}
                        {payBadge && (
                          <p className={`text-xs mt-0.5 ${payBadge.color}`}>{payBadge.label}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {del.orders ? (
                          <Link href={`/dashboard/orders/${del.orders.id}`} className="text-slate-300 hover:text-white text-sm">
                            #{del.orders.order_number}
                          </Link>
                        ) : <span className="text-slate-500 text-sm">—</span>}
                        {del.orders?.total_amount != null && (
                          <p className="text-xs text-slate-400 mt-0.5">{fmtPrice(del.orders.total_amount)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-white text-sm">{del.customer_name || '—'}</p>
                        {del.customer_phone && <p className="text-xs text-slate-400">{del.customer_phone}</p>}
                      </td>
                      <td className="px-5 py-4 max-w-[160px]">
                        <p className="text-slate-300 text-sm truncate" title={del.delivery_address ?? ''}>{del.delivery_address || '—'}</p>
                        {del.estimated_delivery_time && (
                          <p className="text-xs text-orange-400 mt-0.5">⏰ {fmt(del.estimated_delivery_time)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ds.color}`}>
                          {ds.icon} {ds.label}
                        </span>
                        {del.failure_reason && <p className="text-xs text-red-400 mt-1">{del.failure_reason}</p>}
                        {del.notes && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[120px]">{del.notes}</p>}
                        {del.metadata?.customer_refused && (
                          <p className="text-xs text-purple-400 mt-0.5">🚫 Татгалзсан</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-400 text-xs">{fmt(del.created_at)}</p>
                        {del.actual_delivery_time && (
                          <p className="text-xs text-green-400 mt-0.5">✅ {fmt(del.actual_delivery_time)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {isActive && (
                            <>
                              <button
                                onClick={() => handleUnassign(del.id)}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all disabled:opacity-40"
                              >
                                {isLoading ? '...' : '👤 Чөлөөлөх'}
                              </button>
                              <button
                                onClick={() => handleCancel(del.id)}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all disabled:opacity-40"
                              >
                                {isLoading ? '...' : '🚫 Цуцлах'}
                              </button>
                            </>
                          )}
                          <Link
                            href={`/dashboard/deliveries/${del.id}`}
                            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                          >
                            →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 text-center py-3">
              {filtered.length} / {deliveries.length} хүргэлт харагдаж байна
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
