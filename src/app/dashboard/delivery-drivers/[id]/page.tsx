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
  orders: { id: string; order_number: string; total_amount: number } | null
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

const DRIVER_STATUS: Record<string, { label: string; color: string }> = {
  active:      { label: 'Идэвхтэй',       color: 'bg-green-500/20 text-green-400' },
  on_delivery: { label: 'Хүргэлтэнд',     color: 'bg-blue-500/20 text-blue-400' },
  offline:     { label: 'Офлайн',         color: 'bg-slate-500/20 text-slate-400' },
  suspended:   { label: 'Түтгэлзүүлсэн', color: 'bg-red-500/20 text-red-400' },
}

const ACTIVE_STATUSES = ['assigned', 'at_store', 'picked_up', 'in_transit', 'delayed']
const TERMINAL_STATUSES = ['delivered', 'cancelled', 'failed']

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtPrice(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('mn-MN').format(n) + '₮'
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DriverDetailPage() {
  const params = useParams()
  const driverId = params.id as string
  const supabase = createClient()

  const [driver, setDriver] = useState<Driver | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [deliveryLoading, setDeliveryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit profile
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  // Delivery actions
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'active' | 'done'>('all')
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

  // ── Load driver's deliveries ─────────────────────────────────────────────
  const loadDeliveries = useCallback(async () => {
    setDeliveryLoading(true)
    const { data } = await supabase
      .from('deliveries')
      .select(`
        id, delivery_number, status, delivery_type,
        delivery_address, customer_name, customer_phone,
        delivery_fee, created_at, estimated_delivery_time,
        actual_delivery_time, failure_reason, notes,
        orders(id, order_number, total_amount)
      `)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(100)
    setDeliveries((data as Delivery[]) ?? [])
    setDeliveryLoading(false)
  }, [driverId, supabase])

  useEffect(() => {
    loadDriver()
    loadDeliveries()
  }, [loadDriver, loadDeliveries])

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = deliveries.length
    const active    = deliveries.filter(d => ACTIVE_STATUSES.includes(d.status)).length
    const delivered = deliveries.filter(d => d.status === 'delivered').length
    const failed    = deliveries.filter(d => ['failed', 'cancelled'].includes(d.status)).length
    const earnings  = deliveries
      .filter(d => d.status === 'delivered')
      .reduce((s, d) => s + (d.delivery_fee ?? 0), 0)
    return { total, active, delivered, failed, earnings }
  }, [deliveries])

  // ── Filtered deliveries ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (deliveryFilter === 'active') return deliveries.filter(d => ACTIVE_STATUSES.includes(d.status))
    if (deliveryFilter === 'done')   return deliveries.filter(d => TERMINAL_STATUSES.includes(d.status))
    return deliveries
  }, [deliveries, deliveryFilter])

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
      setDeliveries(prev => prev.map(d => d.id === deliveryId ? { ...d, ...body, status: (body.status as string) ?? d.status } : d))
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
      {/* ── Header ── */}
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
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50">{saving ? 'Хадгалж байна...' : '✅ Хадгалах'}</button>
            </div>
        }
      </div>

      {/* ── Profile card ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                { label: '📞 Утас',          value: driver.phone },
                { label: '📧 И-мэйл',        value: driver.email },
                { label: '🚗 Тээврийн хэрэгсэл', value: driver.vehicle_type },
                { label: '🔢 Дугаарын тэмдэг', value: driver.vehicle_number },
                { label: '✈️ Telegram',       value: driver.telegram_chat_id ? `ID: ${driver.telegram_chat_id}` : 'Холбогдоогүй' },
                { label: '📅 Бүртгэсэн',      value: fmt(driver.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white">{value ?? '—'}</span>
                </div>
              ))}
              {driver.delivery_zones.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">📍 Хүргэлтийн бүс</span>
                  <span className="text-white">{driver.delivery_zones.join(', ')}</span>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Нийт хүргэлт',  value: stats.total,     color: 'text-white',        bg: 'bg-slate-700/50 border-slate-600' },
            { label: 'Идэвхтэй',       value: stats.active,    color: 'text-blue-400',     bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Хүргэсэн',       value: stats.delivered, color: 'text-green-400',    bg: 'bg-green-500/10 border-green-500/20' },
            { label: 'Амжилтгүй',      value: stats.failed,    color: 'text-red-400',      bg: 'bg-red-500/10 border-red-500/20' },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
              <p className="text-slate-400 text-xs">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
          <div className="col-span-2 border rounded-xl p-4 bg-yellow-500/10 border-yellow-500/20">
            <p className="text-slate-400 text-xs">💰 Нийт орлого (хүргэсэн)</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{fmtPrice(stats.earnings)}</p>
          </div>
        </div>
      </div>

      {/* ── Deliveries ── */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Хүргэлтүүд</h2>
          <div className="flex gap-1">
            {([
              { key: 'all',    label: `Бүгд (${deliveries.length})` },
              { key: 'active', label: `🚚 Идэвхтэй (${stats.active})` },
              { key: 'done',   label: `✅ Дууссан (${stats.delivered + stats.failed})` },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setDeliveryFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${deliveryFilter === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {deliveryLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Хүргэлт байхгүй байна</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
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
                  const isActive = ACTIVE_STATUSES.includes(del.status)
                  const isLoading = actionLoading === del.id
                  return (
                    <tr key={del.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-all">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/deliveries/${del.id}`} className="text-blue-400 hover:text-blue-300 font-medium text-sm">
                          #{del.delivery_number}
                        </Link>
                        {del.delivery_fee != null && (
                          <p className="text-xs text-slate-400 mt-0.5">{fmtPrice(del.delivery_fee)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {del.orders ? (
                          <Link href={`/dashboard/orders/${del.orders.id}`} className="text-slate-300 hover:text-white text-sm">
                            #{del.orders.order_number}
                          </Link>
                        ) : <span className="text-slate-500 text-sm">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-white text-sm">{del.customer_name || '—'}</p>
                        {del.customer_phone && <p className="text-xs text-slate-400">{del.customer_phone}</p>}
                      </td>
                      <td className="px-5 py-4 max-w-[180px]">
                        <p className="text-slate-300 text-sm truncate">{del.delivery_address || '—'}</p>
                        {del.estimated_delivery_time && (
                          <p className="text-xs text-orange-400 mt-0.5">⏰ {fmt(del.estimated_delivery_time)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ds.color}`}>
                          {ds.icon} {ds.label}
                        </span>
                        {del.failure_reason && (
                          <p className="text-xs text-red-400 mt-1">{del.failure_reason}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-400 text-xs">{fmt(del.created_at)}</p>
                        {del.actual_delivery_time && (
                          <p className="text-xs text-green-400 mt-0.5">✅ {fmt(del.actual_delivery_time)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {isActive && (
                            <>
                              <button
                                onClick={() => handleUnassign(del.id)}
                                disabled={isLoading}
                                title="Жолоочийг чөлөөлөх"
                                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all disabled:opacity-40"
                              >
                                {isLoading ? '...' : '👤 Чөлөөлөх'}
                              </button>
                              <button
                                onClick={() => handleCancel(del.id)}
                                disabled={isLoading}
                                title="Хүргэлт цуцлах"
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
                            Дэлгэрэнгүй →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
