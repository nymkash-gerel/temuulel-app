'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TableReservation {
  id: string
  party_size: number
  reservation_time: string
  duration_minutes: number | null
  status: string
  notes: string | null
  created_at: string
  table_layouts: { id: string; name: string; section: string | null; capacity: number } | null
  customers: { id: string; name: string | null } | null
}

interface TableOption {
  id: string
  name: string
  section: string | null
  capacity: number
}

interface CustomerOption {
  id: string
  name: string | null
  phone: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  seated: { label: 'Суусан', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Дууссан', color: 'bg-slate-500/20 text-slate-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Ирээгүй', color: 'bg-orange-500/20 text-orange-400' },
}

export default function TableReservationsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState<TableReservation[]>([])
  const [tableOptions, setTableOptions] = useState<TableOption[]>([])
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formTableId, setFormTableId] = useState('')
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formPartySize, setFormPartySize] = useState('')
  const [formReservationTime, setFormReservationTime] = useState('')
  const [formDuration, setFormDuration] = useState('60')
  const [formSpecialRequests, setFormSpecialRequests] = useState('')

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

        const [reservationsRes, tablesRes, customersRes] = await Promise.all([
          supabase
            .from('table_reservations')
            .select(`
              id, party_size, reservation_time, duration_minutes, status,
              notes, created_at,
              table_layouts(id, name, section, capacity),
              customers(id, name)
            `)
            .eq('store_id', store.id)
            .order('reservation_time', { ascending: false })
            .limit(200),
          supabase
            .from('table_layouts')
            .select('id, name, section, capacity')
            .eq('store_id', store.id)
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('customers')
            .select('id, name, phone')
            .eq('store_id', store.id)
            .order('name')
            .limit(500),
        ])

        if (reservationsRes.data) setReservations(reservationsRes.data as unknown as TableReservation[])
        if (tablesRes.data) setTableOptions(tablesRes.data as TableOption[])
        if (customersRes.data) setCustomerOptions(customersRes.data as CustomerOption[])
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = reservations

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r =>
        r.table_layouts?.name?.toLowerCase().includes(q) ||
        r.customers?.name?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      )
    }

    if (statusFilter) result = result.filter(r => r.status === statusFilter)
    if (tableFilter) result = result.filter(r => r.table_layouts?.id === tableFilter)

    return result
  }, [reservations, search, statusFilter, tableFilter])

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return {
      total: reservations.length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      seated: reservations.filter(r => r.status === 'seated').length,
      today: reservations.filter(r => {
        const rt = new Date(r.reservation_time)
        return rt >= today && rt < tomorrow
      }).length,
    }
  }, [reservations])

  async function handleCreate() {
    if (!formTableId || !formPartySize || !formReservationTime) return
    setCreating(true)

    try {
      const { data, error } = await supabase
        .from('table_reservations')
        .insert({
          store_id: storeId,
          table_id: formTableId,
          customer_id: formCustomerId || null,
          party_size: Number(formPartySize),
          reservation_time: formReservationTime,
          duration_minutes: formDuration ? Number(formDuration) : undefined,
          notes: formSpecialRequests.trim() || null,
          status: 'confirmed',
        })
        .select(`
          id, party_size, reservation_time, duration_minutes, status,
          notes, created_at,
          table_layouts(id, name, section, capacity),
          customers(id, name)
        `)
        .single()

      if (error) throw error

      if (data) {
        setReservations(prev => [data as unknown as TableReservation, ...prev])
        setShowCreateForm(false)
        setFormTableId('')
        setFormCustomerId('')
        setFormPartySize('')
        setFormReservationTime('')
        setFormDuration('60')
        setFormSpecialRequests('')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
  }

  async function updateReservationStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('table_reservations')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setReservations(prev => prev.map(r =>
        r.id === id ? { ...r, status: newStatus } : r
      ))
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
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Ширээний захиалга</h1>
          <p className="text-slate-400 mt-1">
            Нийт {reservations.length} захиалга
            {filtered.length !== reservations.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          + Захиалга нэмэх
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт захиалга</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Баталгаажсан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Суусан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.seated}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Өнөөдрийн</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.today}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">&#128269;</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ширээ, харилцагч, тусгай хүсэлт хайх..."
                className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төлөв</option>
            <option value="pending">Хүлээгдэж буй</option>
            <option value="confirmed">Баталгаажсан</option>
            <option value="seated">Суусан</option>
            <option value="completed">Дууссан</option>
            <option value="cancelled">Цуцлагдсан</option>
            <option value="no_show">Ирээгүй</option>
          </select>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх ширээ</option>
            {tableOptions.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.section ? `(${t.section})` : ''} - {t.capacity} суудал
              </option>
            ))}
          </select>
        </div>
        {(statusFilter || tableFilter) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setStatusFilter(''); setTableFilter('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ ширээний захиалга</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ширээ *</label>
                <select
                  value={formTableId}
                  onChange={(e) => setFormTableId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Ширээ сонгох...</option>
                  {tableOptions.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.section ? `(${t.section})` : ''} - {t.capacity} суудал
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Харилцагч</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Сонгоогүй (шинэ зочин)</option>
                  {customerOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Нэргүй'} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүний тоо *</label>
                  <input
                    type="number"
                    value={formPartySize}
                    onChange={(e) => setFormPartySize(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="4"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хугацаа (мин)</label>
                  <input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="60"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Захиалгын цаг *</label>
                <input
                  type="datetime-local"
                  value={formReservationTime}
                  onChange={(e) => setFormReservationTime(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тусгай хүсэлт</label>
                <textarea
                  value={formSpecialRequests}
                  onChange={(e) => setFormSpecialRequests(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Цонхны хажуу, хүүхдийн суудал..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formTableId || !formPartySize || !formReservationTime}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Захиалга нэмэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Ширээ</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүний тоо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалсан цаг</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хугацаа</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Тусгай хүсэлт</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((res) => {
                const sc = STATUS_CONFIG[res.status] || { label: res.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={res.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <span className="text-white font-medium">
                          {res.table_layouts?.name || '-'}
                        </span>
                        {res.table_layouts?.section && (
                          <p className="text-slate-400 text-xs">{res.table_layouts.section}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">{res.customers?.name || 'Зочин'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-white font-medium">{res.party_size}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {new Date(res.reservation_time).toLocaleString('mn-MN', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-slate-300 text-sm">
                        {res.duration_minutes ? `${res.duration_minutes} мин` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-slate-400 text-sm truncate max-w-[150px]" title={res.notes || ''}>
                        {res.notes || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex gap-1 justify-end">
                        {res.status === 'pending' && (
                          <button
                            onClick={() => updateReservationStatus(res.id, 'confirmed')}
                            className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all"
                          >
                            Батлах
                          </button>
                        )}
                        {res.status === 'confirmed' && (
                          <button
                            onClick={() => updateReservationStatus(res.id, 'seated')}
                            className="px-2 py-1 text-xs bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-all"
                          >
                            Суулгах
                          </button>
                        )}
                        {res.status === 'seated' && (
                          <button
                            onClick={() => updateReservationStatus(res.id, 'completed')}
                            className="px-2 py-1 text-xs bg-slate-500/10 text-slate-400 rounded-lg hover:bg-slate-500/20 transition-all"
                          >
                            Дуусгах
                          </button>
                        )}
                        {(res.status === 'pending' || res.status === 'confirmed') && (
                          <button
                            onClick={() => updateReservationStatus(res.id, 'cancelled')}
                            className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                          >
                            Цуцлах
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : reservations.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох захиалга олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTableFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128213;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Ширээний захиалга байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Зочдын ширээний захиалгыг бүртгэж, үйлчилгээгээ зохион байгуулаарай
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            Эхний захиалгаа нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
