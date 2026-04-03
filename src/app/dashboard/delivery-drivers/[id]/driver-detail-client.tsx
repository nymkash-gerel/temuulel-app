'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TgAccountEntry {
  chat_id: number
  first_name: string
  last_name?: string
  username?: string
  linked_at: string
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TZ = 'Asia/Ulaanbaatar'

function toLocalDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}
function yesterdayStr() {
  return new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ })
}
function fmtDay(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
function fmt(d: string | null) {
  if (!d) return '\u2014'
  return new Date(d).toLocaleString('mn-MN', { timeZone: TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(d: string | null) {
  if (!d) return '\u2014'
  return new Date(d).toLocaleString('mn-MN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

const ACTIVE_STATUSES = ['assigned', 'at_store', 'picked_up', 'in_transit', 'delayed']
const TERMINAL = ['delivered', 'cancelled', 'failed']

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: '\u0425\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439', color: 'bg-yellow-500/20 text-yellow-400',  icon: '\u23F3' },
  assigned:   { label: '\u041E\u043D\u043E\u043E\u0441\u043E\u043D',        color: 'bg-blue-500/20 text-blue-400',      icon: '\uD83D\uDC64' },
  at_store:   { label: '\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440\u0442',       color: 'bg-cyan-500/20 text-cyan-400',      icon: '\uD83C\uDFEA' },
  picked_up:  { label: '\u0410\u0432\u0441\u0430\u043D',          color: 'bg-indigo-500/20 text-indigo-400',  icon: '\uD83D\uDCE6' },
  in_transit: { label: '\u0417\u0430\u043C\u0434 \u044F\u0432\u0430\u0430',      color: 'bg-purple-500/20 text-purple-400',  icon: '\uD83D\uDE9A' },
  delivered:  { label: '\u0425\u04AF\u0440\u0433\u044D\u0441\u044D\u043D',       color: 'bg-green-500/20 text-green-400',    icon: '\u2705' },
  failed:     { label: '\u0410\u043C\u0436\u0438\u043B\u0442\u0433\u04AF\u0439',      color: 'bg-red-500/20 text-red-400',        icon: '\u274C' },
  cancelled:  { label: '\u0426\u0443\u0446\u043B\u0430\u0433\u0434\u0441\u0430\u043D',     color: 'bg-slate-500/20 text-slate-400',    icon: '\uD83D\uDEAB' },
  delayed:    { label: '\u0425\u043E\u0446\u043E\u0440\u0441\u043E\u043D',       color: 'bg-orange-500/20 text-orange-400',  icon: '\u26A0\uFE0F' },
}
const DRIVER_STATUS: Record<string, { label: string; dot: string }> = {
  active:      { label: '\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439',       dot: 'bg-green-400' },
  on_delivery: { label: '\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u044D\u043D\u0434',     dot: 'bg-blue-400' },
  offline:     { label: '\u041E\u0444\u043B\u0430\u0439\u043D',         dot: 'bg-slate-400' },
  suspended:   { label: '\u0422\u04AF\u0442\u0433\u044D\u043B\u0437\u04AF\u04AF\u043B\u0441\u044D\u043D', dot: 'bg-red-400' },
}
const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  paid:    { label: '\u2705 \u0422\u04E9\u043B\u0441\u04E9\u043D',    color: 'text-green-400' },
  pending: { label: '\u23F3 \u0425\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436', color: 'text-orange-400' },
  partial: { label: '\uD83D\uDCB8 \u0414\u0443\u0442\u0443\u0443',     color: 'text-yellow-400' },
  failed:  { label: '\u274C \u0422\u0430\u0442\u0433\u0430\u043B\u0437\u0430\u0432', color: 'text-red-400' },
  unpaid:  { label: '\uD83D\uDCB0 \u0410\u0432\u0430\u0430\u0433\u04AF\u0439',   color: 'text-rose-400' },
}

type QuickFilter = 'delayed' | 'complaint' | 'unpaid' | 'refused' | 'cancelled' | null

function passesQuick(d: Delivery, qf: QuickFilter) {
  if (!qf) return true
  switch (qf) {
    case 'delayed':   return d.status === 'delayed'
    case 'complaint': return !!(d.notes?.includes('\u0433\u043E\u043C\u0434\u043E\u043B') || d.metadata?.customer_refused || d.metadata?.refusal_reason)
    case 'unpaid':    return d.status === 'delivered' && !d.orders?.payment_status?.includes('paid')
    case 'refused':   return !!(d.metadata?.customer_refused)
    case 'cancelled': return d.status === 'cancelled' || d.status === 'failed'
  }
}

// ─── CSS ring component ───────────────────────────────────────────────────────

function RingChart({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface DriverDetailClientProps {
  driverId: string
}

export default function DriverDetailClient({ driverId }: DriverDetailClientProps) {
  const supabase = createClient()

  const [driver, setDriver]         = useState<Driver | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading]       = useState(true)
  const [dlLoading, setDlLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)

  // edit
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData]   = useState<Record<string, unknown>>({})
  const [saving, setSaving]       = useState(false)

  // table filters
  const [searchQ, setSearchQ]         = useState('')
  const [selDay, setSelDay]           = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)
  const [tableTab, setTableTab]       = useState<'all' | 'active' | 'done'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [switchingTg, setSwitchingTg] = useState<number | null>(null)
  const [syncingTg, setSyncingTg]   = useState(false)

  // load
  const loadDriver = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('delivery_drivers').select('*').eq('id', driverId).single()
    if (error || !data) setError('\u0416\u043E\u043B\u043E\u043E\u0447 \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439')
    else setDriver(data as unknown as Driver)
    setLoading(false)
  }, [driverId, supabase])

  const loadDeliveries = useCallback(async () => {
    setDlLoading(true)
    const { data } = await supabase
      .from('deliveries')
      .select(`id, delivery_number, status, delivery_type,
        delivery_address, customer_name, customer_phone,
        delivery_fee, created_at, estimated_delivery_time,
        actual_delivery_time, failure_reason, notes, metadata,
        orders(id, order_number, total_amount, payment_status)`)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(300)
    setDeliveries((data as Delivery[]) ?? [])
    setDlLoading(false)
  }, [driverId, supabase])

  useEffect(() => { loadDriver(); loadDeliveries() }, [loadDriver, loadDeliveries])

  // ── Analytics ─────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const today     = todayStr()
    const yesterday = yesterdayStr()

    const todayDels = deliveries.filter(d => toLocalDay(d.created_at) === today)
    const terminal  = deliveries.filter(d => TERMINAL.includes(d.status))
    const delivered = deliveries.filter(d => d.status === 'delivered')
    const cancelled = deliveries.filter(d => ['cancelled', 'failed'].includes(d.status))
    const active    = deliveries.filter(d => ACTIVE_STATUSES.includes(d.status))
    const delayed   = deliveries.filter(d => d.status === 'delayed')
    const complained= deliveries.filter(d => d.notes?.includes('\u0433\u043E\u043C\u0434\u043E\u043B') || d.metadata?.customer_refused)
    const refused   = deliveries.filter(d => d.metadata?.customer_refused)
    const unpaid    = deliveries.filter(d => d.status === 'delivered' && !d.orders?.payment_status?.includes('paid') && d.orders?.payment_status !== null)

    const successPct = terminal.length > 0 ? Math.round(delivered.length / terminal.length * 100) : 0
    const cancelPct  = terminal.length > 0 ? Math.round(cancelled.length / terminal.length * 100) : 0

    const totalEarnings   = delivered.reduce((s, d) => s + (d.delivery_fee ?? 0), 0)
    const todayEarnings   = todayDels.filter(d => d.status === 'delivered').reduce((s, d) => s + (d.delivery_fee ?? 0), 0)

    // Last 7 days bar chart
    const last7: { day: string; label: string; count: number; fee: number; maxCount?: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
      const dayStr = d.toLocaleDateString('en-CA', { timeZone: TZ })
      const label  = i === 0 ? '\u04E8\u043D\u04E9\u04E9\u0434\u04E9\u0440' : i === 1 ? '\u04E8\u0447\u0438\u0433\u0434\u04E9\u0440' : fmtDay(dayStr)
      const dels   = deliveries.filter(x => toLocalDay(x.created_at) === dayStr)
      const fee    = dels.filter(x => x.status === 'delivered').reduce((s, x) => s + (x.delivery_fee ?? 0), 0)
      last7.push({ day: dayStr, label, count: dels.length, fee })
    }
    const maxCount = Math.max(...last7.map(x => x.count), 1)
    last7.forEach(x => { x.maxCount = maxCount })

    // yesterday stats for comparison
    const yesterdayDels = deliveries.filter(d => toLocalDay(d.created_at) === yesterday)
    const yesterdayDelivered = yesterdayDels.filter(d => d.status === 'delivered').length

    // Distinct days for day picker
    const daySet = new Set(deliveries.map(d => toLocalDay(d.created_at)))
    const distinctDays = [...daySet].sort((a, b) => b.localeCompare(a)).slice(0, 7)

    return {
      today: todayDels,
      todayDelivered: todayDels.filter(d => d.status === 'delivered').length,
      todayActive:    todayDels.filter(d => ACTIVE_STATUSES.includes(d.status)).length,
      todayEarnings,
      yesterdayDelivered,
      total: deliveries.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      active: active.length,
      delayed: delayed.length,
      complained: complained.length,
      refused: refused.length,
      unpaid: unpaid.length,
      successPct,
      cancelPct,
      totalEarnings,
      last7,
      distinctDays,
    }
  }, [deliveries])

  // ── Filtered table ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim()
    return deliveries.filter(d => {
      if (tableTab === 'active' && !ACTIVE_STATUSES.includes(d.status)) return false
      if (tableTab === 'done'   && !TERMINAL.includes(d.status)) return false
      if (selDay && toLocalDay(d.created_at) !== selDay) return false
      if (!passesQuick(d, quickFilter)) return false
      if (q) {
        const hay = [d.customer_name, d.customer_phone, d.delivery_number, d.orders?.order_number].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [deliveries, searchQ, selDay, quickFilter, tableTab])

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit() {
    if (!driver) return
    setEditData({ name: driver.name, phone: driver.phone ?? '', email: driver.email ?? '',
      vehicle_type: driver.vehicle_type ?? '', vehicle_number: driver.vehicle_number ?? '',
      delivery_zones: (driver.delivery_zones ?? []).join(', ') })
    setIsEditing(true)
  }
  async function handleSave() {
    setSaving(true)
    const zones = String(editData.delivery_zones ?? '').split(',').map(z => z.trim()).filter(Boolean)
    const res = await fetch(`/api/delivery-drivers/${driverId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editData.name, phone: editData.phone, email: editData.email,
        vehicle_type: editData.vehicle_type, vehicle_number: editData.vehicle_number, delivery_zones: zones }),
    })
    setSaving(false)
    if (res.ok) { setIsEditing(false); loadDriver() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '\u0410\u043B\u0434\u0430\u0430') }
  }

  async function handleSwitchTelegram(chatId: number) {
    setSwitchingTg(chatId)
    const res = await fetch(`/api/delivery-drivers/${driverId}/switch-telegram`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    })
    setSwitchingTg(null)
    if (res.ok) { loadDriver() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '\u0410\u043B\u0434\u0430\u0430') }
  }

  async function handleSyncTelegram() {
    setSyncingTg(true)
    const res = await fetch(`/api/delivery-drivers/${driverId}/sync-telegram`, { method: 'POST' })
    setSyncingTg(false)
    if (res.ok) { loadDriver() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '\u0410\u043B\u0434\u0430\u0430') }
  }

  // ── Delivery actions ──────────────────────────────────────────────────────
  async function patchDelivery(id: string, body: Record<string, unknown>) {
    setActionLoading(id)
    const res = await fetch(`/api/deliveries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) setDeliveries(p => p.map(d => d.id === id ? { ...d, ...body, status: (body.status as string) ?? d.status } : d))
    else { const e = await res.json().catch(() => ({})); alert(e.error || '\u0410\u043B\u0434\u0430\u0430') }
    setActionLoading(null)
  }
  async function handleUnassign(id: string) {
    if (!confirm('\u0416\u043E\u043B\u043E\u043E\u0447\u0438\u0439\u0433 \u0447\u04E9\u043B\u04E9\u04E9\u043B\u04E9\u0445 \u04AF\u04AF?')) return
    await patchDelivery(id, { driver_id: null, status: 'pending' })
    setDeliveries(p => p.filter(d => d.id !== id))
  }
  async function handleCancel(id: string) {
    if (!confirm('\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0446\u0443\u0446\u043B\u0430\u0445 \u0443\u0443?')) return
    await patchDelivery(id, { status: 'cancelled' })
  }
  function toggleQuick(qf: QuickFilter) { setQuickFilter(p => p === qf ? null : qf) }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"/></div>
  if (error || !driver) return (
    <div className="text-center py-12">
      <p className="text-slate-400">{error || '\u0416\u043E\u043B\u043E\u043E\u0447 \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439'}</p>
      <Link href="/dashboard/delivery-drivers" className="text-blue-400 mt-2 inline-block">\u2190 \u0411\u0443\u0446\u0430\u0445</Link>
    </div>
  )

  const dsc = DRIVER_STATUS[driver.status] ?? { label: driver.status, dot: 'bg-slate-400' }
  const today = todayStr()

  return (
    <div className="space-y-5">

      {/* ══════════════════════════════════════════════════════════════════
          HEADER — Driver identity + quick profile
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-800/60 border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
            {driver.name.charAt(0).toUpperCase()}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{driver.name}</h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] text-xs font-medium text-slate-300">
                <span className={`w-1.5 h-1.5 rounded-full ${dsc.dot}`}/>
                {dsc.label}
              </span>
              {driver.telegram_chat_id && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/20 text-sky-400">{'\u2708\uFE0F'} TG</span>
              )}
              {driver.avg_rating > 0 && (
                <span className="text-yellow-400 text-sm">{'\u2B50'} {driver.avg_rating.toFixed(1)}</span>
              )}
            </div>
            {/* Info row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-400">
              {driver.phone       && <span>{'\uD83D\uDCDE'} {driver.phone}</span>}
              {driver.vehicle_type && <span>{'\uD83D\uDE97'} {driver.vehicle_type} {driver.vehicle_number}</span>}
              {driver.delivery_zones?.length > 0 && <span>{'\uD83D\uDCCD'} {driver.delivery_zones.join(', ')}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            {!isEditing
              ? <button onClick={startEdit} className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-sm rounded-lg transition-all">{'\u270F\uFE0F'} \u0417\u0430\u0441\u0430\u0445</button>
              : <>
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 bg-white/[0.06] text-slate-300 text-sm rounded-lg">{'\u0426\u0443\u0446\u043B\u0430\u0445'}</button>
                  <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg disabled:opacity-50">
                    {saving ? '...' : '\u2705 \u0425\u0430\u0434\u0433\u0430\u043B\u0430\u0445'}
                  </button>
                </>
            }
          </div>
        </div>

        {/* Edit form */}
        {isEditing && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-3">
            {[
              { key: 'name',           label: '\u041D\u044D\u0440' },
              { key: 'phone',          label: '\u0423\u0442\u0430\u0441' },
              { key: 'email',          label: '\u0418-\u043C\u044D\u0439\u043B' },
              { key: 'vehicle_type',   label: '\u0422\u044D\u044D\u0432\u0440\u0438\u0439\u043D \u0445\u044D\u0440\u044D\u0433\u0441\u044D\u043B' },
              { key: 'vehicle_number', label: '\u0414\u0443\u0433\u0430\u0430\u0440\u044B\u043D \u0442\u044D\u043C\u0434\u044D\u0433' },
              { key: 'delivery_zones', label: '\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0431\u04AF\u0441 (\u0442\u0430\u0441\u043B\u0430\u043B\u0430\u0430\u0440)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-slate-400">{label}</label>
                <input value={String(editData[key] ?? '')}
                  onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full mt-0.5 px-3 py-1.5 bg-white/[0.06] border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TODAY'S SNAPSHOT  (most prominent — first thing manager sees)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/10 border border-blue-500/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">{'\uD83D\uDCC5'} \u04E8\u043D\u04E9\u04E9\u0434\u04E9\u0440</h2>
          <button
            onClick={() => { setSelDay(p => p === today ? '' : today); setTableTab('all') }}
            className={`text-xs px-3 py-1 rounded-full transition-all ${selDay === today ? 'bg-blue-500 text-white' : 'text-blue-400 hover:text-blue-300'}`}
          >
            {selDay === today ? '\u2713 \u0428\u04AF\u04AF\u043B\u0442 \u0438\u0434\u044D\u0432\u0445\u0442\u044D\u0439' : '\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u04AF\u04AF\u0434 \u0445\u0430\u0440\u0430\u0445 \u2192'}
          </button>
        </div>
        {dlLoading ? (
          <div className="flex gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-14 w-24 bg-slate-700/40 rounded-xl animate-pulse"/>)}
          </div>
        ) : analytics.today.length === 0 ? (
          <p className="text-slate-400 text-sm">{'\u04E8\u043D\u04E9\u04E9\u0434\u04E9\u0440 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442 \u0431\u0430\u0439\u0445\u0433\u04AF\u0439 \u0431\u0430\u0439\u043D\u0430.'}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '\u041D\u0438\u0439\u0442 \u0437\u0430\u0445\u0438\u0430\u043B\u0433\u0430',  value: analytics.today.length,         color: 'text-white',      sub: '\u04E8\u043D\u04E9\u04E9\u0434\u04E9\u0440' },
              { label: '\u0425\u04AF\u0440\u0433\u044D\u0441\u044D\u043D',       value: analytics.todayDelivered,        color: 'text-green-400',  sub: `${analytics.yesterdayDelivered} \u04E9\u0447\u0438\u0433\u0434\u04E9\u0440` },
              { label: '\u0417\u0430\u043C\u0434 \u044F\u0432\u0430\u0430',      value: analytics.todayActive,           color: 'text-blue-400',   sub: '\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439' },
              { label: '\u041E\u0440\u043B\u043E\u0433\u043E',         value: formatPrice(analytics.todayEarnings), color: 'text-yellow-400', sub: '\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0445\u04E9\u043B\u0441' },
            ].map(c => (
              <div key={c.label} className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-slate-400 text-xs">{c.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${c.color}`}>{c.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Today's active deliveries mini-list */}
        {analytics.today.filter(d => ACTIVE_STATUSES.includes(d.status)).length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{'\u041E\u0434\u043E\u043E \u044F\u0432\u0436 \u0431\u0443\u0439 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u04AF\u04AF\u0434'}</p>
            {analytics.today.filter(d => ACTIVE_STATUSES.includes(d.status)).slice(0, 4).map(d => {
              const sm = STATUS_META[d.status] ?? STATUS_META.assigned
              return (
                <div key={d.id} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2">
                  <span className="text-base">{sm.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">#{d.delivery_number} {'\u2014'} {d.customer_name || '\u2014'}</p>
                    <p className="text-xs text-slate-400 truncate">{d.delivery_address || '\u2014'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${sm.color}`}>{sm.label}</span>
                  <Link href={`/dashboard/deliveries/${d.id}`} className="text-slate-500 hover:text-slate-300 text-xs">{'\u2192'}</Link>
                </div>
              )
            })}
            {analytics.today.filter(d => ACTIVE_STATUSES.includes(d.status)).length > 4 && (
              <p className="text-xs text-slate-500 text-center">+{analytics.today.filter(d => ACTIVE_STATUSES.includes(d.status)).length - 4} {'\u0434\u0430\u0445\u0438\u043D\u2026'}</p>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TELEGRAM ACCOUNT HISTORY
      ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const tgHistory: TgAccountEntry[] = driver.metadata?.telegram_history ?? []
        if (tgHistory.length === 0 && !driver.telegram_chat_id) return null
        // If no history but chat_id exists (old driver), synthesize one entry
        const entries: TgAccountEntry[] = tgHistory.length > 0
          ? tgHistory
          : [{ chat_id: driver.telegram_chat_id!, first_name: 'Unknown', linked_at: driver.telegram_linked_at ?? '' }]
        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sky-400 text-lg">{'\u2708\uFE0F'}</span>
              <p className="text-slate-300 text-sm font-semibold">Telegram {'\u0425\u043E\u043B\u0431\u043E\u0433\u0434\u0441\u043E\u043D \u0410\u043A\u043A\u0430\u0443\u043D\u0442\u0443\u0443\u0434'}</p>
              <span className="text-xs text-slate-500">{entries.length} {'\u0430\u043A\u043A\u0430\u0443\u043D\u0442'}</span>
              <button
                onClick={handleSyncTelegram}
                disabled={syncingTg}
                className="ml-auto px-2.5 py-1 text-xs rounded-lg bg-white/[0.06] hover:bg-sky-700/50 text-slate-400 hover:text-sky-300 transition-all disabled:opacity-40"
                title="Telegram-\u0430\u0430\u0441 \u043D\u044D\u0440, username \u0442\u0430\u0442\u0430\u0445"
              >
                {syncingTg ? '\u23F3 Sync...' : '\uD83D\uDD04 Sync'}
              </button>
            </div>
            <div className="space-y-2">
              {entries.map((entry, idx) => {
                const isCurrent = entry.chat_id === driver.telegram_chat_id
                const isLoading = switchingTg === entry.chat_id
                return (
                  <div
                    key={entry.chat_id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                      isCurrent
                        ? 'bg-sky-500/10 border-sky-500/30'
                        : 'bg-slate-800/60 border-white/[0.06]/50'
                    }`}
                  >
                    {/* Avatar placeholder */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isCurrent ? 'bg-sky-500/30 text-sky-300' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {(entry.first_name && entry.first_name !== 'Unknown') ? entry.first_name.charAt(0).toUpperCase() : '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium truncate ${isCurrent ? 'text-sky-300' : 'text-slate-300'}`}>
                          {entry.first_name && entry.first_name !== 'Unknown'
                            ? [entry.first_name, entry.last_name].filter(Boolean).join(' ')
                            : <span className="text-slate-500 italic">{'\u041D\u044D\u0440 \u0442\u043E\u0434\u043E\u0440\u0445\u043E\u0439\u0433\u04AF\u0439 \u2014 \uD83D\uDD04 Sync \u0434\u0430\u0440\u043D\u0430 \u0443\u0443'}</span>
                          }
                        </p>
                        {entry.username && (
                          <span className="text-xs text-slate-500">@{entry.username}</span>
                        )}
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-sky-500/20 text-sky-400 font-medium">{'\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439'}</span>
                        )}
                        {idx === 0 && !isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">{'\u0425\u0430\u043C\u0433\u0438\u0439\u043D \u0441\u04AF\u04AF\u043B\u0438\u0439\u043D'}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID: {entry.chat_id} {'\u00B7'} {entry.linked_at ? fmt(entry.linked_at) : '\u2014'}
                      </p>
                    </div>

                    {/* Switch button */}
                    {!isCurrent && (
                      <button
                        onClick={() => handleSwitchTelegram(entry.chat_id)}
                        disabled={!!switchingTg}
                        className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.06] hover:bg-sky-600/60 text-slate-300 hover:text-white transition-all disabled:opacity-40 flex-shrink-0"
                      >
                        {isLoading ? '...' : '\u21A9 \u0410\u0448\u0438\u0433\u043B\u0430\u0445'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-slate-600 mt-3">{'\u0416\u043E\u043B\u043E\u043E\u0447 \u0448\u0438\u043D\u044D Telegram \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430\u0430\u0441 \u0445\u043E\u043B\u0431\u043E\u0433\u0434\u043E\u0445 \u0431\u04AF\u0440\u0442 \u044D\u043D\u0434 \u0445\u0430\u0440\u0430\u0433\u0434\u0430\u043D\u0430.'}</p>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          PERFORMANCE OVERVIEW  — 3 columns
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Success rate ring */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <RingChart pct={analytics.successPct} color="#22c55e" size={88} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-green-400">{analytics.successPct}%</span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-slate-300 font-medium">{'\u0410\u043C\u0436\u0438\u043B\u0442\u044B\u043D \u0445\u0443\u0432\u044C'}</p>
            <div className="space-y-1">
              <p className="text-green-400">{'\u2705'} {analytics.delivered} {'\u0445\u04AF\u0440\u0433\u044D\u0441\u044D\u043D'}</p>
              <p className="text-red-400">{'\u274C'} {analytics.cancelled} {'\u0446\u0443\u0446\u043B\u0430\u0433\u0434\u0441\u0430\u043D'}</p>
              <p className="text-slate-400">{'\uD83D\uDCE6'} {analytics.total} {'\u043D\u0438\u0439\u0442'}</p>
            </div>
          </div>
        </div>

        {/* 7-day bar chart */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-slate-300 text-sm font-medium mb-3">{'\uD83D\uDCCA'} 7 {'\u0445\u043E\u043D\u043E\u0433\u0438\u0439\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442'}</p>
          <div className="flex items-end gap-1.5 h-16">
            {analytics.last7.map(({ day, label, count, maxCount }) => {
              const pct = maxCount! > 0 ? (count / maxCount!) * 100 : 0
              const isToday = day === today
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <button
                    onClick={() => setSelDay(p => p === day ? '' : day)}
                    className="w-full flex flex-col items-center justify-end"
                    style={{ height: '48px' }}
                    title={`${label}: ${count} \u0445\u04AF\u0440\u0433\u044D\u043B\u0442`}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${isToday ? 'bg-blue-500' : selDay === day ? 'bg-cyan-500' : 'bg-slate-600 hover:bg-slate-500'}`}
                      style={{ height: `${Math.max(pct, 8)}%` }}
                    />
                  </button>
                  <p className={`text-[10px] truncate w-full text-center ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>{label}</p>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>0</span>
            <span>{analytics.last7.reduce((s, x) => s + x.count, 0)} {'\u043D\u0438\u0439\u0442'}</span>
          </div>
        </div>

        {/* Payment health + earnings */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-3">
          <p className="text-slate-300 text-sm font-medium">{'\uD83D\uDCB0'} {'\u0422\u04E9\u043B\u0431\u04E9\u0440 & \u041E\u0440\u043B\u043E\u0433\u043E'}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">{'\u041D\u0438\u0439\u0442 \u043E\u0440\u043B\u043E\u0433\u043E'}</span>
              <span className="text-yellow-400 font-bold">{formatPrice(analytics.totalEarnings)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{'\u04E8\u043D\u04E9\u04E9\u0434\u0440\u0438\u0439\u043D \u043E\u0440\u043B\u043E\u0433\u043E'}</span>
              <span className="text-green-400 font-medium">{formatPrice(analytics.todayEarnings)}</span>
            </div>
            <div className="h-px bg-white/[0.06] my-1"/>
            <div className="flex justify-between">
              <span className="text-rose-400">{'\u26A0\uFE0F'} {'\u0410\u0432\u0430\u0430\u0433\u04AF\u0439 \u0442\u04E9\u043B\u0431\u04E9\u0440'}</span>
              <span className="text-rose-300 font-bold">{analytics.unpaid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{'\uD83D\uDEAB'} {'\u0425\u0430\u0440\u0438\u043B\u0446\u0430\u0433\u0447 \u0442\u0430\u0442\u0433\u0430\u043B\u0437\u0441\u0430\u043D'}</span>
              <span className="text-slate-300">{analytics.refused}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{'\uD83D\uDCAC'} {'\u0413\u043E\u043C\u0434\u043E\u043B'}</span>
              <span className="text-slate-300">{analytics.complained}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DAILY PAYMENT BREAKDOWN  (scrollable chips)
      ═══════════════════════════════════════════════════════════════════ */}
      {analytics.last7.some(x => x.fee > 0) && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">{'\uD83D\uDCB5'} {'\u04E8\u0434\u0440\u0438\u0439\u043D \u043E\u0440\u043B\u043E\u0433\u043E (\u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0445\u04E9\u043B\u0441)'}</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {analytics.last7.filter(x => x.fee > 0 || x.count > 0).map(({ day, label, fee, count }) => (
              <button key={day} onClick={() => setSelDay(p => p === day ? '' : day)}
                className={`flex-shrink-0 rounded-xl px-4 py-2.5 border text-left transition-all min-w-[100px] ${
                  selDay === day
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : day === today
                      ? 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20'
                      : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <p className="text-xs font-medium">{label}</p>
                <p className="text-sm font-bold mt-0.5">{formatPrice(fee)}</p>
                <p className="text-xs opacity-60 mt-0.5">{count} {'\u0445\u04AF\u0440\u0433\u044D\u043B\u0442'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ALERT STRIP  (only when problems exist)
      ═══════════════════════════════════════════════════════════════════ */}
      {(analytics.delayed > 0 || analytics.unpaid > 0 || analytics.refused > 0 || analytics.complained > 0) && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">{'\u26A0\uFE0F'} {'\u0410\u043D\u0445\u0430\u0430\u0440'}</p>
          <div className="flex flex-wrap gap-2">
            {analytics.delayed > 0 && (
              <button onClick={() => { toggleQuick('delayed'); setTableTab('all') }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${quickFilter === 'delayed' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'}`}>
                {'\u26A0\uFE0F'} {analytics.delayed} {'\u0445\u043E\u0446\u043E\u0440\u0441\u043E\u043D'}
              </button>
            )}
            {analytics.unpaid > 0 && (
              <button onClick={() => { toggleQuick('unpaid'); setTableTab('all') }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${quickFilter === 'unpaid' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'}`}>
                {'\uD83D\uDCB0'} {analytics.unpaid} {'\u0442\u04E9\u043B\u0431\u04E9\u0440 \u0430\u0432\u0430\u0430\u0433\u04AF\u0439'}
              </button>
            )}
            {analytics.refused > 0 && (
              <button onClick={() => { toggleQuick('refused'); setTableTab('all') }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${quickFilter === 'refused' ? 'bg-purple-500 border-purple-500 text-white' : 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'}`}>
                {'\uD83D\uDEAB'} {analytics.refused} {'\u0445\u0430\u0440\u0438\u043B\u0446\u0430\u0433\u0447 \u0442\u0430\u0442\u0433\u0430\u043B\u0437\u0441\u0430\u043D'}
              </button>
            )}
            {analytics.complained > 0 && (
              <button onClick={() => { toggleQuick('complaint'); setTableTab('all') }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${quickFilter === 'complaint' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20'}`}>
                {'\uD83D\uDCAC'} {analytics.complained} {'\u0433\u043E\u043C\u0434\u043E\u043B'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DELIVERY HISTORY TABLE
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">

        {/* Controls */}
        <div className="px-5 pt-4 pb-3 border-b border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold text-white">{'\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0442\u04AF\u04AF\u0445'}</h2>
            {/* Tab buttons */}
            <div className="flex gap-1">
              {([
                { key: 'all',    label: `\u0411\u04AF\u0433\u0434 (${analytics.total})` },
                { key: 'active', label: `\uD83D\uDE9A (${analytics.active})` },
                { key: 'done',   label: `\u2705 (${analytics.delivered + analytics.cancelled})` },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setTableTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${tableTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + day picker */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[180px]">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="\u041D\u044D\u0440, \u0443\u0442\u0430\u0441, \u0434\u0443\u0433\u0430\u0430\u0440\u2026" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-white/[0.06] border border-white/[0.06] rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"/>
            </div>
            <div className="flex gap-1 items-center flex-wrap">
              <button onClick={() => { setSelDay(''); setQuickFilter(null) }}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${!selDay && !quickFilter ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'}`}>
                {'\u0411\u04AF\u0433\u0434'}
              </button>
              {analytics.distinctDays.map(day => (
                <button key={day} onClick={() => setSelDay(p => p === day ? '' : day)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${selDay === day ? 'bg-blue-600 text-white' : day === today ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'}`}>
                  {day === today ? '\u04E8\u043D\u04E9\u04E9\u0434\u04E9\u0440' : fmtDay(day)}
                </button>
              ))}
              <input type="date" value={selDay} onChange={e => setSelDay(e.target.value)}
                className="px-2 py-1 bg-white/[0.06] border border-white/[0.06] rounded-lg text-slate-300 text-xs focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"/>
            </div>
          </div>

          {/* Quick filter chips */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'delayed',   icon: '\u26A0\uFE0F', label: '\u0425\u043E\u0446\u043E\u0440\u0441\u043E\u043D',          count: analytics.delayed,    c: 'orange' },
              { key: 'complaint', icon: '\uD83D\uDCAC', label: '\u0413\u043E\u043C\u0434\u043E\u043B',             count: analytics.complained, c: 'pink' },
              { key: 'unpaid',    icon: '\uD83D\uDCB0', label: '\u0422\u04E9\u043B\u0431\u04E9\u0440 \u0430\u0432\u0430\u0430\u0433\u04AF\u0439',     count: analytics.unpaid,     c: 'rose' },
              { key: 'refused',   icon: '\uD83D\uDEAB', label: '\u0425\u0430\u0440\u0438\u043B\u0446\u0430\u0433\u0447 \u0442\u0430\u0442\u0433\u0430\u043B\u0437\u0441\u0430\u043D', count: analytics.refused,  c: 'purple' },
              { key: 'cancelled', icon: '\u274C', label: '\u0426\u0443\u0446\u043B\u0430\u0433\u0434\u0441\u0430\u043D',         count: analytics.cancelled,  c: 'slate' },
            ] as const).map(({ key, icon, label, count, c }) => {
              const on = quickFilter === key
              const cls: Record<string, string> = {
                orange: on ? 'bg-orange-500 border-orange-500 text-white' : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20',
                pink:   on ? 'bg-pink-500 border-pink-500 text-white'     : 'bg-pink-500/10 border-pink-500/20 text-pink-400 hover:bg-pink-500/20',
                rose:   on ? 'bg-rose-500 border-rose-500 text-white'     : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20',
                purple: on ? 'bg-purple-500 border-purple-500 text-white' : 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20',
                slate:  on ? 'bg-slate-500 border-slate-500 text-white'   : 'bg-slate-700 border-white/[0.08] text-slate-400 hover:bg-slate-600',
              }
              if (!on && count === 0) return null
              return (
                <button key={key} onClick={() => toggleQuick(key as QuickFilter)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-all font-medium ${cls[c]}`}>
                  {icon} {label} {count > 0 && <span className="opacity-75 ml-0.5">({count})</span>}
                </button>
              )
            })}
            {(quickFilter || selDay || searchQ) && (
              <button onClick={() => { setQuickFilter(null); setSelDay(''); setSearchQ('') }}
                className="px-3 py-1 rounded-lg text-xs border border-white/[0.06] text-slate-400 hover:bg-white/[0.08] transition-all">
                {'\u2715'} {'\u0428\u04AF\u04AF\u043B\u0442 \u0430\u0440\u0438\u043B\u0433\u0430\u0445'}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {dlLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">{'\uD83D\uDD0D'}</p>
            <p>{searchQ || selDay || quickFilter ? '\u0422\u043E\u0445\u0438\u0440\u043E\u0445 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442 \u0431\u0430\u0439\u0445\u0433\u04AF\u0439' : '\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0431\u0430\u0439\u0445\u0433\u04AF\u0439'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3">{'\u0425\u04AF\u0440\u0433\u044D\u043B\u0442'}</th>
                    <th className="px-5 py-3">{'\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0430\u0433\u0447'}</th>
                    <th className="px-5 py-3">{'\u0425\u0430\u044F\u0433'}</th>
                    <th className="px-5 py-3">{'\u0422\u04E9\u043B\u04E9\u0432'}</th>
                    <th className="px-5 py-3">{'\u041E\u0433\u043D\u043E\u043E'}</th>
                    <th className="px-5 py-3 text-right">{'\u04AE\u0439\u043B\u0434\u044D\u043B'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(del => {
                    const sm = STATUS_META[del.status] ?? { label: del.status, color: 'bg-slate-500/20 text-slate-400', icon: '\u2753' }
                    const isActive  = ACTIVE_STATUSES.includes(del.status)
                    const isLoading = actionLoading === del.id
                    const payBadge  = del.orders?.payment_status ? PAYMENT_LABEL[del.orders.payment_status] : null
                    return (
                      <tr key={del.id} className="border-b border-white/[0.06]/40 hover:bg-white/[0.08]/20 transition-all">
                        <td className="px-5 py-3.5">
                          <Link href={`/dashboard/deliveries/${del.id}`} className="text-blue-400 hover:text-blue-300 font-medium text-sm">
                            #{del.delivery_number}
                          </Link>
                          {del.orders && (
                            <p className="text-xs text-slate-500 mt-0.5">#{del.orders.order_number}</p>
                          )}
                          {del.delivery_fee != null && (
                            <p className="text-xs text-slate-400">{formatPrice(del.delivery_fee)}</p>
                          )}
                          {payBadge && <p className={`text-xs ${payBadge.color}`}>{payBadge.label}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-white text-sm">{del.customer_name || '\u2014'}</p>
                          {del.customer_phone && <p className="text-xs text-slate-400">{del.customer_phone}</p>}
                        </td>
                        <td className="px-5 py-3.5 max-w-[160px]">
                          <p className="text-slate-300 text-sm truncate" title={del.delivery_address ?? ''}>{del.delivery_address || '\u2014'}</p>
                          {del.estimated_delivery_time && (
                            <p className="text-xs text-orange-400 mt-0.5">{'\u23F0'} {fmtTime(del.estimated_delivery_time)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sm.color}`}>
                            {sm.icon} {sm.label}
                          </span>
                          {del.metadata?.customer_refused && <p className="text-xs text-purple-400 mt-0.5">{'\uD83D\uDEAB'} {'\u0422\u0430\u0442\u0433\u0430\u043B\u0437\u0441\u0430\u043D'}</p>}
                          {del.notes && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[120px]" title={del.notes}>{del.notes}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-slate-400 text-xs">{fmt(del.created_at)}</p>
                          {del.actual_delivery_time && <p className="text-xs text-green-400 mt-0.5">{'\u2705'} {fmtTime(del.actual_delivery_time)}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end gap-1.5">
                            {isActive && (
                              <>
                                <button onClick={() => handleUnassign(del.id)} disabled={isLoading}
                                  className="px-2.5 py-1 text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-lg transition-all disabled:opacity-40">
                                  {isLoading ? '\u2026' : '\uD83D\uDC64'}
                                </button>
                                <button onClick={() => handleCancel(del.id)} disabled={isLoading}
                                  className="px-2.5 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all disabled:opacity-40">
                                  {isLoading ? '\u2026' : '\uD83D\uDEAB'}
                                </button>
                              </>
                            )}
                            <Link href={`/dashboard/deliveries/${del.id}`}
                              className="px-2.5 py-1 text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-lg transition-all">
                              {'\u2192'}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 text-center py-3 border-t border-white/[0.06]/40">
              {filtered.length} / {analytics.total} {'\u0445\u04AF\u0440\u0433\u044D\u043B\u0442'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
