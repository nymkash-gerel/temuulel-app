'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import CalendarView from '@/components/ui/CalendarView'
import type { CalendarEvent } from '@/components/ui/CalendarView'

interface StaffMember {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string | null
}

interface Consultation {
  id: string
  consultation_type: string
  scheduled_at: string | null
  duration_minutes: number | null
  fee: number | null
  location: string | null
  meeting_url: string | null
  status: string
  notes: string | null
  customer_id: string | null
  consultant_id: string | null
  created_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string } | null
}

interface NewConsultationForm {
  consultation_type: string
  scheduled_at: string
  duration_minutes: string
  fee: string
  location: string
  meeting_url: string
  status: string
  notes: string
  customer_id: string
  consultant_id: string
}

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  business: 'Бизнесийн',
  financial: 'Санхүүгийн',
  legal: 'Хууль зүйн',
  tax: 'Татварын',
  marketing: 'Маркетингийн',
  it: 'Мэдээллийн технологи',
  hr: 'Хүний нөөцийн',
  strategy: 'Стратегийн',
  management: 'Менежментийн',
  other: 'Бусад',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Товлосон', color: 'bg-blue-500/20 text-blue-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-cyan-500/20 text-cyan-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцалсан', color: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Ирээгүй', color: 'bg-gray-500/20 text-gray-400' },
}

function formatPrice(amount: number | null) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ConsultationsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Filters
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState<NewConsultationForm>({
    consultation_type: 'business',
    scheduled_at: '',
    duration_minutes: '60',
    fee: '',
    location: '',
    meeting_url: '',
    status: 'scheduled',
    notes: '',
    customer_id: '',
    consultant_id: '',
  })

  const loadConsultations = useCallback(async (sid: string) => {
    let query = supabase
      .from('consultations')
      .select(`
        id, consultation_type, scheduled_at, duration_minutes,
        fee, location, meeting_url, status, notes,
        customer_id, consultant_id, created_at,
        customers(id, name),
        staff!consultations_consultant_id_fkey(id, name)
      `)
      .eq('store_id', sid)
      .order('scheduled_at', { ascending: false })

    if (typeFilter) {
      query = query.eq('consultation_type', typeFilter)
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    if (data) {
      setConsultations(data as unknown as Consultation[])
    }
  }, [supabase, typeFilter, statusFilter])

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

        const [, customersRes, staffRes] = await Promise.all([
          loadConsultations(store.id),
          supabase.from('customers').select('id, name').eq('store_id', store.id).order('name'),
          supabase.from('staff').select('id, name').eq('store_id', store.id).order('name'),
        ])

        if (customersRes.data) setCustomers(customersRes.data)
        if (staffRes.data) setStaffList(staffRes.data)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router, loadConsultations])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadConsultations(storeId) }
    reload()
  }, [typeFilter, statusFilter, loadConsultations, storeId, loading])

  const filtered = useMemo(() => {
    if (!search.trim()) return consultations
    const q = search.trim().toLowerCase()
    return consultations.filter(c =>
      c.customers?.name?.toLowerCase().includes(q) ||
      c.staff?.name?.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q) ||
      c.notes?.toLowerCase().includes(q)
    )
  }, [consultations, search])

  const stats = useMemo(() => {
    const total = consultations.length
    const scheduled = consultations.filter(c =>
      c.status === 'scheduled' || c.status === 'confirmed'
    ).length
    const completed = consultations.filter(c => c.status === 'completed').length
    const revenue = consultations.reduce((sum, c) => sum + (c.fee || 0), 0)
    return { total, scheduled, completed, revenue }
  }, [consultations])

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return consultations.map(c => {
      const dt = new Date(c.scheduled_at || '')
      return {
        id: c.id,
        title: c.consultation_type || 'Зөвлөгөө',
        date: c.scheduled_at || '',
        time: dt.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }),
        meta: c.customers?.name || undefined,
        status: c.status,
        statusColor: STATUS_CONFIG[c.status]?.color || 'bg-slate-500/20 text-slate-400',
      }
    })
  }, [consultations])

  function resetForm() {
    setForm({
      consultation_type: 'business',
      scheduled_at: '',
      duration_minutes: '60',
      fee: '',
      location: '',
      meeting_url: '',
      status: 'scheduled',
      notes: '',
      customer_id: '',
      consultant_id: '',
    })
    setShowForm(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        store_id: storeId,
        consultation_type: form.consultation_type,
        scheduled_at: form.scheduled_at,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined,
        fee: form.fee ? parseFloat(form.fee) : null,
        location: form.location || null,
        meeting_url: form.meeting_url || null,
        status: form.status,
        notes: form.notes || null,
        customer_id: form.customer_id || null,
        consultant_id: form.consultant_id || null,
      }

      const { error: insertError } = await supabase
        .from('consultations')
        .insert(payload)

      if (insertError) throw insertError

      await loadConsultations(storeId)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-bold text-white">Зөвлөгөө</h1>
          <p className="text-gray-400 mt-1">
            Нийт {consultations.length} зөвлөгөө
            {filtered.length !== consultations.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/consultations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Шинэ зөвлөгөө
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Нийт зөвлөгөө</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Товлосон</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.scheduled}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-400 text-sm">Орлого</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatPrice(stats.revenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Харилцагч, зөвлөх, байршлаар хайх..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="business">Бизнесийн</option>
              <option value="financial">Санхүүгийн</option>
              <option value="legal">Хууль зүйн</option>
              <option value="tax">Татварын</option>
              <option value="marketing">Маркетингийн</option>
              <option value="it">Мэдээллийн технологи</option>
              <option value="hr">Хүний нөөцийн</option>
              <option value="strategy">Стратегийн</option>
              <option value="management">Менежментийн</option>
              <option value="other">Бусад</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="scheduled">Товлосон</option>
              <option value="confirmed">Баталгаажсан</option>
              <option value="in_progress">Явагдаж буй</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцалсан</option>
              <option value="no_show">Ирээгүй</option>
            </select>
          </div>
        </div>
        {(typeFilter || statusFilter || search) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setTypeFilter(''); setStatusFilter(''); setSearch('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Шинэ зөвлөгөө бүртгэх</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Зөвлөгөөний төрөл *</label>
                  <select
                    value={form.consultation_type}
                    onChange={(e) => setForm({ ...form, consultation_type: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                    required
                  >
                    <option value="business">Бизнесийн</option>
                    <option value="financial">Санхүүгийн</option>
                    <option value="legal">Хууль зүйн</option>
                    <option value="tax">Татварын</option>
                    <option value="marketing">Маркетингийн</option>
                    <option value="it">Мэдээллийн технологи</option>
                    <option value="hr">Хүний нөөцийн</option>
                    <option value="strategy">Стратегийн</option>
                    <option value="management">Менежментийн</option>
                    <option value="other">Бусад</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Төлөв</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="scheduled">Товлосон</option>
                    <option value="confirmed">Баталгаажсан</option>
                    <option value="in_progress">Явагдаж буй</option>
                    <option value="completed">Дууссан</option>
                    <option value="cancelled">Цуцалсан</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Товлосон цаг *</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Хугацаа (минут)</label>
                  <input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    placeholder="60"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Хураамж</label>
                  <input
                    type="number"
                    value={form.fee}
                    onChange={(e) => setForm({ ...form, fee: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Байршил</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Жишээ: Оффис 301, Төв оффис"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Онлайн уулзалтын линк</label>
                <input
                  type="url"
                  value={form.meeting_url}
                  onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                  placeholder="https://meet.google.com/..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Харилцагч</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">-- Сонгох --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name || 'N/A'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Зөвлөх</label>
                <select
                  value={form.consultant_id}
                  onChange={(e) => setForm({ ...form, consultant_id: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">-- Сонгох --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Нэмэлт тэмдэглэл"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
                >
                  {saving ? 'Хадгалж байна...' : 'Бүртгэх'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            viewMode === 'list'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          Жагсаалт
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            viewMode === 'calendar'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          Календар
        </button>
      </div>

      {/* Content */}
      {viewMode === 'calendar' ? (
        <CalendarView
          events={calendarEvents}
          onEventClick={(e) => router.push(`/dashboard/consultations/${e.id}`)}
        />
      ) : (
      <>
      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Зөвлөх</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Товлосон цаг</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Хугацаа</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Байршил</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Хураамж</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cons) => {
                const sc = STATUS_CONFIG[cons.status] || { label: cons.status, color: 'bg-gray-500/20 text-gray-400' }
                return (
                  <tr key={cons.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        cons.consultation_type === 'business' ? 'bg-blue-500/20 text-blue-400' :
                        cons.consultation_type === 'financial' ? 'bg-green-500/20 text-green-400' :
                        cons.consultation_type === 'legal' ? 'bg-purple-500/20 text-purple-400' :
                        cons.consultation_type === 'tax' ? 'bg-orange-500/20 text-orange-400' :
                        cons.consultation_type === 'marketing' ? 'bg-pink-500/20 text-pink-400' :
                        cons.consultation_type === 'it' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {CONSULTATION_TYPE_LABELS[cons.consultation_type] || cons.consultation_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-300 text-sm">{cons.customers?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-300 text-sm">{cons.staff?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white text-sm">{formatDateTime(cons.scheduled_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-gray-300 text-sm">
                        {cons.duration_minutes ? `${cons.duration_minutes} мин` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        {cons.location && (
                          <p className="text-gray-300 text-sm">{cons.location}</p>
                        )}
                        {cons.meeting_url && (
                          <a
                            href={cons.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                          >
                            Онлайн линк
                          </a>
                        )}
                        {!cons.location && !cons.meeting_url && (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white text-sm">{formatPrice(cons.fee)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : consultations.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-400">Хайлтад тохирох зөвлөгөө олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128188;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Зөвлөгөө бүртгэгдээгүй байна</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Зөвлөгөөний цагаа товлож, хянана уу
          </p>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Эхний зөвлөгөө бүртгэх
          </button>
        </div>
      )}
      </>
      )}
    </div>
  )
}
