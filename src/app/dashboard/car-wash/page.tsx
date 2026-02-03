'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Vehicle {
  id: string
  plate_number: string
  make: string | null
  model: string | null
}

interface WashOrder {
  id: string
  order_number: string
  vehicle_id: string
  service_type: string
  status: string
  bay_number: number | null
  total_amount: number
  notes: string | null
  created_at: string
  vehicles?: {
    plate_number: string
    make: string | null
    model: string | null
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  in_progress: { label: 'Угааж байна', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const SERVICE_TYPES: Record<string, string> = {
  basic: 'Энгийн',
  standard: 'Стандарт',
  premium: 'Премиум',
  deluxe: 'Люкс',
  interior_only: 'Дотор',
  exterior_only: 'Гадна',
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getVehicleDisplay(order: WashOrder): string {
  const v = order.vehicles
  if (!v) return '-'
  const parts = [v.plate_number]
  if (v.make || v.model) {
    parts.push(`${v.make || ''} ${v.model || ''}`.trim())
  }
  return parts.join(' - ')
}

export default function CarWashPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [orders, setOrders] = useState<WashOrder[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Form fields
  const [vehicleId, setVehicleId] = useState('')
  const [serviceType, setServiceType] = useState('basic')
  const [bayNumber, setBayNumber] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [notes, setNotes] = useState('')

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
      }
      setLoading(false)
    }
    init()
  }, [supabase, router])

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      let url = `/api/wash-orders?limit=50`
      if (statusFilter !== 'all') url += `&status=${statusFilter}`
      if (serviceFilter !== 'all') url += `&service_type=${serviceFilter}`
      const res = await fetch(url)
      if (cancelled) return
      if (res.ok) {
        const json = await res.json()
        setOrders(json.data || [])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [storeId, statusFilter, serviceFilter])

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('vehicles')
        .select('id, plate_number, make, model')
        .eq('store_id', storeId)
        .order('plate_number', { ascending: true })
      if (cancelled) return
      if (data) setVehicles(data)
    }
    load()
    return () => { cancelled = true }
  }, [storeId, supabase])

  async function fetchOrders() {
    if (!storeId) return
    setLoading(true)
    let url = `/api/wash-orders?limit=50`
    if (statusFilter !== 'all') url += `&status=${statusFilter}`
    if (serviceFilter !== 'all') url += `&service_type=${serviceFilter}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setOrders(json.data || [])
    }
    setLoading(false)
  }

  const stats = useMemo(() => {
    const total = orders.length
    const pending = orders.filter(o => o.status === 'pending').length
    const inProgress = orders.filter(o => o.status === 'in_progress').length
    const completed = orders.filter(o => o.status === 'completed').length

    const today = new Date().toISOString().slice(0, 10)
    const todayRevenue = orders
      .filter(o => o.status === 'completed' && o.created_at.slice(0, 10) === today)
      .reduce((sum, o) => sum + Number(o.total_amount), 0)

    return { total, pending, inProgress, completed, todayRevenue }
  }, [orders])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/wash-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          service_type: serviceType,
          bay_number: bayNumber ? parseInt(bayNumber, 10) : null,
          total_amount: parseFloat(totalAmount) || 0,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Захиалга үүсгэхэд алдаа гарлаа')
      }

      await fetchOrders()
      setShowForm(false)
      setVehicleId('')
      setServiceType('basic')
      setBayNumber('')
      setTotalAmount('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Захиалга үүсгэхэд алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateStatus(orderId: string, newStatus: string) {
    setUpdating(orderId)
    setError('')

    try {
      const res = await fetch(`/api/wash-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Төлөв шинэчлэхэд алдаа гарлаа')
      }

      await fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Төлөв шинэчлэхэд алдаа гарлаа')
    } finally {
      setUpdating(null)
    }
  }

  if (loading && orders.length === 0) {
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
          <h1 className="text-2xl font-bold text-white">Автомашин угаалга</h1>
          <p className="text-slate-400 mt-1">{orders.length} захиалга</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Шинэ захиалга
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">Нийт захиалга</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.pending}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
          <p className="text-blue-400 text-sm">Угааж байна</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
          <p className="text-green-400 text-sm">Дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">Өнөөдрийн орлого</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.todayRevenue)}</p>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Шинэ угаалгын захиалга</h2>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Тээврийн хэрэгсэл *</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  required
                >
                  <option value="">Сонгоно уу...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number}{v.make || v.model ? ` - ${v.make || ''} ${v.model || ''}`.trim() : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Үйлчилгээний төрөл *</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  required
                >
                  {Object.entries(SERVICE_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Зогсоолын дугаар</label>
                <input
                  type="number"
                  value={bayNumber}
                  onChange={(e) => setBayNumber(e.target.value)}
                  placeholder="1"
                  min="1"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Нийт дүн *</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Тэмдэглэл</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Нэмэлт мэдээлэл..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Үүсгэж байна...' : 'Захиалга үүсгэх'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Болих
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">Бүх төлөв</option>
              <option value="pending">Хүлээгдэж буй</option>
              <option value="in_progress">Угааж байна</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Үйлчилгээний төрөл</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">Бүх төрөл</option>
              {Object.entries(SERVICE_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {(statusFilter !== 'all' || serviceFilter !== 'all') && (
            <div className="flex items-end">
              <button
                onClick={() => { setStatusFilter('all'); setServiceFilter('all') }}
                className="text-sm text-blue-400 hover:text-blue-300 transition-all pb-3"
              >
                Шүүлтүүр цэвэрлэх
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      {orders.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалга #</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Тээврийн хэрэгсэл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлчилгээ</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зогсоол</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const sc = STATUS_CONFIG[order.status] || { label: order.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">#{order.order_number}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">{getVehicleDisplay(order)}</span>
                      {order.notes && (
                        <p className="text-slate-400 text-sm mt-0.5 truncate max-w-[200px]">{order.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{SERVICE_TYPES[order.service_type] || order.service_type}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-slate-300">{order.bay_number || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(Number(order.total_amount))}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">{formatDate(order.created_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex gap-1 justify-end">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                            disabled={updating === order.id}
                            className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === order.id ? '...' : 'Эхлүүлэх'}
                          </button>
                        )}
                        {order.status === 'in_progress' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                            disabled={updating === order.id}
                            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === order.id ? '...' : 'Дуусгах'}
                          </button>
                        )}
                        {(order.status === 'pending' || order.status === 'in_progress') && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                            disabled={updating === order.id}
                            className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === order.id ? '...' : 'Цуцлах'}
                          </button>
                        )}
                        {(order.status === 'completed' || order.status === 'cancelled') && (
                          <span className="text-xs text-slate-500">
                            {sc.label}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128663;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Захиалга байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {(statusFilter !== 'all' || serviceFilter !== 'all')
              ? 'Шүүлтүүрт тохирох захиалга олдсонгүй. Шүүлтүүрийг өөрчилнө үү.'
              : 'Угаалгын захиалга үүсгэсэн тохиолдолд энд харагдана.'}
          </p>
          {(statusFilter !== 'all' || serviceFilter !== 'all') ? (
            <button
              onClick={() => { setStatusFilter('all'); setServiceFilter('all') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all"
            >
              <span>+</span> Эхний захиалга үүсгэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
