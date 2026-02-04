'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ServiceRequest {
  id: string
  request_number: string
  service_type: string
  address: string
  scheduled_at: string | null
  duration_estimate: number | null
  status: string
  priority: string
  estimated_cost: number | null
  notes: string | null
  created_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Гүйцэтгэж буй', color: 'bg-indigo-500/20 text-indigo-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  normal: { label: 'Энгийн', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  plumbing: 'Сантехник',
  electrical: 'Цахилгаан',
  cleaning: 'Цэвэрлэгээ',
  painting: 'Будаг',
  carpentry: 'Мужаан',
  hvac: 'Агааржуулалт',
  landscaping: 'Тохижилт',
  appliance_repair: 'Гэр ахуйн засвар',
  general: 'Ерөнхий',
  other: 'Бусад',
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function ServiceRequestsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formServiceType, setFormServiceType] = useState('general')
  const [formAddress, setFormAddress] = useState('')
  const [formScheduledAt, setFormScheduledAt] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formPriority, setFormPriority] = useState('normal')
  const [formEstimatedCost, setFormEstimatedCost] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (store) {
      setStoreId(store.id)

      const { data } = await supabase
        .from('service_requests')
        .select(`
          id, request_number, service_type, address, scheduled_at,
          duration_estimate, status, priority, estimated_cost, notes, created_at,
          customers(id, name),
          staff(id, name)
        `)
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (data) {
        setRequests(data as unknown as ServiceRequest[])
      }
    }
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const filtered = useMemo(() => {
    let result = requests

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r =>
        r.request_number.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q) ||
        r.customers?.name?.toLowerCase().includes(q)
      )
    }

    if (statusFilter) result = result.filter(r => r.status === statusFilter)
    if (serviceTypeFilter) result = result.filter(r => r.service_type === serviceTypeFilter)
    if (priorityFilter) result = result.filter(r => r.priority === priorityFilter)

    return result
  }, [requests, search, statusFilter, serviceTypeFilter, priorityFilter])

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  }), [requests])

  async function handleCreate() {
    if (!formAddress.trim()) return
    setCreating(true)

    try {
      const reqNum = 'SR-' + Date.now().toString(36).toUpperCase()

      const { data, error } = await supabase
        .from('service_requests')
        .insert({
          store_id: storeId,
          request_number: reqNum,
          service_type: formServiceType,
          address: formAddress.trim(),
          scheduled_at: formScheduledAt || null,
          duration_estimate: formDuration ? Number(formDuration) : null,
          priority: formPriority,
          estimated_cost: formEstimatedCost ? Number(formEstimatedCost) : null,
          notes: formNotes.trim() || null,
          status: 'pending',
        })
        .select(`
          id, request_number, service_type, address, scheduled_at,
          duration_estimate, status, priority, estimated_cost, notes, created_at,
          customers(id, name),
          staff(id, name)
        `)
        .single()

      if (error) throw error

      if (data) {
        setRequests(prev => [data as unknown as ServiceRequest, ...prev])
        setShowCreateForm(false)
        setFormServiceType('general')
        setFormAddress('')
        setFormScheduledAt('')
        setFormDuration('')
        setFormPriority('normal')
        setFormEstimatedCost('')
        setFormNotes('')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
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
          <h1 className="text-2xl font-bold text-white">Үйлчилгээний хүсэлтүүд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {requests.length} хүсэлт
            {filtered.length !== requests.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/service-requests/new"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          + Хүсэлт нэмэх
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт хүсэлт</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.pending}</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-indigo-400 text-sm">Гүйцэтгэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.in_progress}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
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
                placeholder="Хүсэлтийн дугаар, хаяг, харилцагч хайх..."
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
            <option value="in_progress">Гүйцэтгэж буй</option>
            <option value="completed">Дууссан</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төрөл</option>
            {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх зэрэглэл</option>
            <option value="low">Бага</option>
            <option value="normal">Энгийн</option>
            <option value="high">Өндөр</option>
            <option value="urgent">Яаралтай</option>
          </select>
        </div>
        {(statusFilter || serviceTypeFilter || priorityFilter) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setStatusFilter(''); setServiceTypeFilter(''); setPriorityFilter('') }}
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
            <h2 className="text-xl font-bold text-white mb-4">Шинэ үйлчилгээний хүсэлт</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Үйлчилгээний төрөл *</label>
                <select
                  value={formServiceType}
                  onChange={(e) => setFormServiceType(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хаяг *</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Баянзүрх дүүрэг, 3-р хороо..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Товлосон огноо</label>
                  <input
                    type="datetime-local"
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хугацаа (минут)</label>
                  <input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Зэрэглэл</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="low">Бага</option>
                    <option value="normal">Энгийн</option>
                    <option value="high">Өндөр</option>
                    <option value="urgent">Яаралтай</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Төсөвт зардал</label>
                  <input
                    type="number"
                    value={formEstimatedCost}
                    onChange={(e) => setFormEstimatedCost(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="50000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Нэмэлт мэдээлэл..."
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
                disabled={creating || !formAddress.trim()}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Хүсэлт үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дугаар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хаяг</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Товлосон</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хугацаа</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зэрэглэл</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төсөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хариуцагч</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const sc = STATUS_CONFIG[req.status] || { label: req.status, color: 'bg-slate-500/20 text-slate-400' }
                const pc = PRIORITY_CONFIG[req.priority] || { label: req.priority, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={req.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">#{req.request_number}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {SERVICE_TYPE_LABELS[req.service_type] || req.service_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">{req.customers?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-slate-300 text-sm truncate max-w-[180px]" title={req.address}>
                        {req.address}
                      </p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {req.scheduled_at
                          ? new Date(req.scheduled_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {req.duration_estimate ? `${req.duration_estimate} мин` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${pc.color}`}>
                        {pc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white">
                        {req.estimated_cost != null ? formatPrice(req.estimated_cost) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{req.staff?.name || '-'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : requests.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох хүсэлт олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setServiceTypeFilter(''); setPriorityFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128736;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Үйлчилгээний хүсэлт байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Шинэ үйлчилгээний хүсэлт нэмж эхлээрэй
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            Эхний хүсэлтээ нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
