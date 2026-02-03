'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

interface Delivery {
  id: string
  delivery_number: string
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled' | 'delayed'
  delivery_type: 'own_driver' | 'external_provider'
  provider_name: string | null
  delivery_address: string
  customer_name: string | null
  customer_phone: string | null
  estimated_delivery_time: string | null
  actual_delivery_time: string | null
  delivery_fee: number | null
  failure_reason: string | null
  notes: string | null
  ai_assignment: { recommended_driver_id?: string; confidence?: number; ranked_drivers?: { driver_id: string; score: number; reasons: string[] }[] } | null
  created_at: string
  orders: { id: string; order_number: string; total_amount: number } | null
  delivery_drivers: { id: string; name: string; phone: string; vehicle_type: string } | null
}

interface Driver {
  id: string
  name: string
  phone: string
  status: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' },
  assigned: { label: 'Оноосон', color: 'bg-blue-500/20 text-blue-400', icon: '👤' },
  picked_up: { label: 'Авсан', color: 'bg-indigo-500/20 text-indigo-400', icon: '📦' },
  in_transit: { label: 'Зам дээр', color: 'bg-purple-500/20 text-purple-400', icon: '🚚' },
  delivered: { label: 'Хүргэсэн', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  failed: { label: 'Амжилтгүй', color: 'bg-red-500/20 text-red-400', icon: '❌' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-slate-500/20 text-slate-400', icon: '🚫' },
  delayed: { label: 'Хоцорсон', color: 'bg-orange-500/20 text-orange-400', icon: '⚠️' },
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function DeliveriesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [, setStoreId] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formAddress, setFormAddress] = useState('')
  const [formCustomerName, setFormCustomerName] = useState('')
  const [formCustomerPhone, setFormCustomerPhone] = useState('')
  const [formDriverId, setFormDriverId] = useState('')
  const [formDeliveryType, setFormDeliveryType] = useState('own_driver')
  const [formDeliveryFee, setFormDeliveryFee] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)

        const [deliveriesRes, driversRes] = await Promise.all([
          supabase
            .from('deliveries')
            .select(`
              id, delivery_number, status, delivery_type, provider_name,
              delivery_address, customer_name, customer_phone,
              estimated_delivery_time, actual_delivery_time,
              delivery_fee, failure_reason, notes, ai_assignment, created_at,
              orders(id, order_number, total_amount),
              delivery_drivers(id, name, phone, vehicle_type)
            `)
            .eq('store_id', store.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('delivery_drivers')
            .select('id, name, phone, status')
            .eq('store_id', store.id)
            .in('status', ['active', 'on_delivery'])
            .order('name'),
        ])

        if (deliveriesRes.data) setDeliveries(deliveriesRes.data as unknown as Delivery[])
        if (driversRes.data) setDrivers(driversRes.data as Driver[])
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = deliveries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(d =>
        d.delivery_number.toLowerCase().includes(q) ||
        d.customer_name?.toLowerCase().includes(q) ||
        d.customer_phone?.includes(q) ||
        d.orders?.order_number?.toLowerCase().includes(q) ||
        d.delivery_drivers?.name?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) result = result.filter(d => d.status === statusFilter)
    return result
  }, [deliveries, search, statusFilter])

  // Active counts
  const activeCount = deliveries.filter(d => ['assigned', 'picked_up', 'in_transit'].includes(d.status)).length
  const pendingCount = deliveries.filter(d => d.status === 'pending').length
  const completedCount = deliveries.filter(d => d.status === 'delivered').length
  const failedCount = deliveries.filter(d => ['failed', 'delayed'].includes(d.status)).length

  async function handleCreate() {
    if (!formAddress.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_address: formAddress.trim(),
          customer_name: formCustomerName.trim() || undefined,
          customer_phone: formCustomerPhone.trim() || undefined,
          driver_id: formDriverId || undefined,
          delivery_type: formDeliveryType,
          delivery_fee: formDeliveryFee ? Number(formDeliveryFee) : undefined,
          notes: formNotes.trim() || undefined,
        }),
      })

      if (res.ok) {
        const { delivery } = await res.json()
        setDeliveries(prev => [delivery, ...prev])
        setShowCreateForm(false)
        setFormAddress('')
        setFormCustomerName('')
        setFormCustomerPhone('')
        setFormDriverId('')
        setFormDeliveryFee('')
        setFormNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
  }

  async function handleAiAssign(deliveryId: string) {
    setAssigning(deliveryId)
    try {
      const res = await fetch('/api/deliveries/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: deliveryId }),
      })
      if (res.ok) {
        const data = await res.json()
        setDeliveries(prev => prev.map(d =>
          d.id === deliveryId
            ? {
                ...d,
                status: data.delivery?.status || d.status,
                delivery_drivers: data.delivery?.delivery_drivers || d.delivery_drivers,
                ai_assignment: data.assignment || d.ai_assignment,
              }
            : d
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'AI оноолт амжилтгүй')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setAssigning(null)
    }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filtered.map(d => ({
      'Дугаар': d.delivery_number,
      'Хаяг': d.delivery_address,
      'Харилцагч': d.customer_name || '',
      'Утас': d.customer_phone || '',
      'Жолооч': d.delivery_drivers?.name || '',
      'Төлөв': STATUS_CONFIG[d.status]?.label || d.status,
      'Хүргэлтийн төлбөр': d.delivery_fee != null ? d.delivery_fee : '',
      'Огноо': new Date(d.created_at).toLocaleDateString('mn-MN'),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Хүргэлт')
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hurguelt.csv'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      XLSX.writeFile(wb, 'hurguelt.xlsx')
    }
  }

  if (loading) {
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
          <h1 className="text-2xl font-bold text-white">Хүргэлт</h1>
          <p className="text-slate-400 mt-1">
            Нийт {deliveries.length} хүргэлт
            {filtered.length !== deliveries.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/orders"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Захиалга
          </Link>
          <Link
            href="/dashboard/deliveries/map"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Газрын зураг
          </Link>
          <Link
            href="/dashboard/delivery-drivers"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Жолоочууд
          </Link>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            + Хүргэлт нэмэх
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{pendingCount}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Хүргэсэн</p>
          <p className="text-2xl font-bold text-white mt-1">{completedCount}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Амжилтгүй / Хоцорсон</p>
          <p className="text-2xl font-bold text-white mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Хүргэлтийн дугаар, харилцагч, захиалга, жолооч хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төлөв</option>
            <option value="pending">Хүлээгдэж буй</option>
            <option value="assigned">Оноосон</option>
            <option value="picked_up">Авсан</option>
            <option value="in_transit">Зам дээр</option>
            <option value="delivered">Хүргэсэн</option>
            <option value="failed">Амжилтгүй</option>
            <option value="delayed">Хоцорсон</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
          <button onClick={() => handleExport('xlsx')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📥</span><span>Excel</span>
          </button>
          <button onClick={() => handleExport('csv')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📄</span><span>CSV</span>
          </button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ хүргэлт</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хүргэх хаяг *</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Баянзүрх дүүрэг, 3-р хороо..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүлээн авагч</label>
                  <input
                    type="text"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Нэр"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Утас</label>
                  <input
                    type="text"
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="99001122"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүргэлтийн төрөл</label>
                  <select
                    value={formDeliveryType}
                    onChange={(e) => setFormDeliveryType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="own_driver">Өөрийн жолооч</option>
                    <option value="external_provider">Гадны хүргэлт</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүргэлтийн төлбөр</label>
                  <input
                    type="number"
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="5000"
                  />
                </div>
              </div>
              {formDeliveryType === 'own_driver' && drivers.length > 0 && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Жолооч оноох</label>
                  <select
                    value={formDriverId}
                    onChange={(e) => setFormDriverId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Дараа оноох</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Нэмэлт мэдээлэл..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formAddress.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Хүргэлт үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүргэлт</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалга</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүлээн авагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Жолооч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((del) => {
                const sc = STATUS_CONFIG[del.status] || STATUS_CONFIG.pending
                return (
                  <tr key={del.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">#{del.delivery_number}</span>
                      {del.delivery_fee != null && (
                        <p className="text-slate-400 text-xs mt-0.5">{formatPrice(del.delivery_fee)}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {del.orders ? (
                        <Link href={`/dashboard/orders/${del.orders.id}`} className="text-blue-400 hover:text-blue-300 transition-all">
                          #{del.orders.order_number}
                        </Link>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white">{del.customer_name || '-'}</p>
                        {del.customer_phone && (
                          <p className="text-slate-400 text-sm">{del.customer_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {del.delivery_drivers ? (
                        <div>
                          <p className="text-white text-sm">{del.delivery_drivers.name}</p>
                          <p className="text-slate-400 text-xs">{del.delivery_drivers.phone}</p>
                          {del.ai_assignment?.recommended_driver_id && (
                            <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              AI оноосон
                            </span>
                          )}
                        </div>
                      ) : del.status === 'pending' ? (
                        <div className="space-y-1">
                          {del.ai_assignment?.ranked_drivers && del.ai_assignment.ranked_drivers.length > 0 ? (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded inline-block">
                              AI санал: {drivers.find(d => d.id === del.ai_assignment?.ranked_drivers?.[0]?.driver_id)?.name || 'Жолооч'}
                            </span>
                          ) : null}
                          <button
                            onClick={(e) => { e.preventDefault(); handleAiAssign(del.id) }}
                            disabled={assigning === del.id}
                            className="block text-xs px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-all disabled:opacity-50"
                          >
                            {assigning === del.id ? 'Оноож байна...' : 'AI оноох'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">Оноогоогүй</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        del.delivery_type === 'own_driver' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {del.delivery_type === 'own_driver' ? 'Өөрийн' : del.provider_name || 'Гадны'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(del.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/dashboard/deliveries/${del.id}`}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all inline-block"
                      >
                        👁️
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : deliveries.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох хүргэлт олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚚</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Хүргэлт байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Захиалга илгээхэд хүргэлт автоматаар үүснэ эсвэл гараар нэмнэ үү
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Эхний хүргэлтээ нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
