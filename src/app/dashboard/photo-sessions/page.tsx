'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import CalendarView from '@/components/ui/CalendarView'
import type { CalendarEvent } from '@/components/ui/CalendarView'

interface Customer {
  id: string
  name: string | null
}

interface Staff {
  id: string
  name: string
}

interface PhotoSession {
  id: string
  store_id: string
  customer_id: string | null
  photographer_id: string | null
  session_type: 'portrait' | 'wedding' | 'event' | 'product' | 'family' | 'maternity' | 'newborn' | 'corporate' | 'other'
  location: string | null
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  total_amount: number
  deposit_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  scheduled: { label: 'Товлосон', color: 'bg-blue-500/20 text-blue-400', icon: '📅' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-purple-500/20 text-purple-400', icon: '📸' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400', icon: '❌' },
  no_show: { label: 'Ирээгүй', color: 'bg-orange-500/20 text-orange-400', icon: '⚠️' },
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  portrait: 'Хөрөг зураг',
  wedding: 'Хуримын зураг',
  event: 'Арга хэмжээ',
  product: 'Бүтээгдэхүүний зураг',
  family: 'Гэр бүлийн зураг',
  maternity: 'Жирэмсний зураг',
  newborn: 'Нярайн зураг',
  corporate: 'Корпоратив зураг',
  other: 'Бусад',
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('mn-MN') + ' ' + d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
}

export default function PhotoSessionsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<PhotoSession[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  // Create form state
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formPhotographerId, setFormPhotographerId] = useState('')
  const [formSessionType, setFormSessionType] = useState('portrait')
  const [formLocation, setFormLocation] = useState('')
  const [formScheduledAt, setFormScheduledAt] = useState('')
  const [formDuration, setFormDuration] = useState('60')
  const [formTotalAmount, setFormTotalAmount] = useState('')
  const [formDepositAmount, setFormDepositAmount] = useState('')
  const [formNotes, setFormNotes] = useState('')

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
        const [sessionsRes, customersRes, staffRes] = await Promise.all([
          fetch('/api/photo-sessions').then(r => r.json()),
          supabase
            .from('customers')
            .select('id, name')
            .eq('store_id', store.id)
            .order('name'),
          supabase
            .from('staff')
            .select('id, name')
            .eq('store_id', store.id)
            .order('name'),
        ])

        if (sessionsRes.data) setSessions(sessionsRes.data as PhotoSession[])
        if (customersRes.data) setCustomers(customersRes.data as Customer[])
        if (staffRes.data) setStaff(staffRes.data as Staff[])
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = sessions

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(s => {
        const customer = customers.find(c => c.id === s.customer_id)
        const photographer = staff.find(st => st.id === s.photographer_id)
        return (
          s.location?.toLowerCase().includes(q) ||
          customer?.name?.toLowerCase().includes(q) ||
          photographer?.name?.toLowerCase().includes(q) ||
          SESSION_TYPE_LABELS[s.session_type]?.toLowerCase().includes(q)
        )
      })
    }

    if (statusFilter) {
      result = result.filter(s => s.status === statusFilter)
    }

    if (typeFilter) {
      result = result.filter(s => s.session_type === typeFilter)
    }

    return result
  }, [sessions, customers, staff, search, statusFilter, typeFilter])

  const stats = useMemo(() => ({
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    in_progress: sessions.filter(s => s.status === 'in_progress').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
    no_show: sessions.filter(s => s.status === 'no_show').length,
    totalRevenue: sessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0),
  }), [sessions])

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return filtered.map(s => {
      const dt = new Date(s.scheduled_at)
      return {
        id: s.id,
        title: SESSION_TYPE_LABELS[s.session_type] || 'Зураг авалт',
        date: s.scheduled_at,
        time: dt.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }),
        meta: getCustomerName(s.customer_id),
        status: s.status,
        statusColor: STATUS_CONFIG[s.status]?.color || 'bg-slate-500/20 text-slate-400',
      }
    })
  }, [filtered, customers])

  function getCustomerName(customerId: string | null) {
    if (!customerId) return '-'
    const c = customers.find(c => c.id === customerId)
    return c?.name || '-'
  }

  function getPhotographerName(photographerId: string | null) {
    if (!photographerId) return '-'
    const s = staff.find(s => s.id === photographerId)
    return s?.name || '-'
  }

  async function handleCreate() {
    if (!formScheduledAt || !formTotalAmount) return
    setCreating(true)

    try {
      const res = await fetch('/api/photo-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: formCustomerId || undefined,
          photographer_id: formPhotographerId || undefined,
          session_type: formSessionType,
          location: formLocation.trim() || undefined,
          scheduled_at: formScheduledAt,
          duration_minutes: Number(formDuration) || 60,
          total_amount: Number(formTotalAmount),
          deposit_amount: formDepositAmount ? Number(formDepositAmount) : undefined,
          notes: formNotes.trim() || undefined,
        }),
      })

      if (res.ok) {
        const { data } = await res.json()
        if (data) {
          setSessions(prev => [data, ...prev])
        }
        setShowCreateForm(false)
        setFormCustomerId('')
        setFormPhotographerId('')
        setFormSessionType('portrait')
        setFormLocation('')
        setFormScheduledAt('')
        setFormDuration('60')
        setFormTotalAmount('')
        setFormDepositAmount('')
        setFormNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Зураг авалт</h1>
          <p className="text-slate-400 mt-1">
            Нийт {sessions.length} зураг авалт
            {filtered.length !== sessions.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/photo-sessions/new"
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
        >
          + Зураг авалт нэмэх
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Товлосон</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.scheduled}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Явагдаж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.in_progress}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Цуцлагдсан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.cancelled}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-orange-400 text-sm">Ирээгүй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.no_show}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-400 text-sm">Нийт орлого</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalRevenue)}</p>
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
                placeholder="Харилцагч, гэрэл зурагчин, байршил хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="scheduled">Товлосон</option>
              <option value="in_progress">Явагдаж буй</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцлагдсан</option>
              <option value="no_show">Ирээгүй</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="portrait">Хөрөг зураг</option>
              <option value="wedding">Хуримын зураг</option>
              <option value="event">Арга хэмжээ</option>
              <option value="product">Бүтээгдэхүүний зураг</option>
              <option value="family">Гэр бүлийн зураг</option>
              <option value="maternity">Жирэмсний зураг</option>
              <option value="newborn">Нярайн зураг</option>
              <option value="corporate">Корпоратив зураг</option>
              <option value="other">Бусад</option>
            </select>
            <div className="flex bg-slate-700/50 border border-slate-600 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-3 text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Жагсаалт
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-3 text-sm font-medium transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Календар
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ зураг авалт</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Харилцагч</label>
                  <select
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Сонгох...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name || 'Нэргүй'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Гэрэл зурагчин</label>
                  <select
                    value={formPhotographerId}
                    onChange={(e) => setFormPhotographerId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Сонгох...</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Зураг авалтын төрөл *</label>
                  <select
                    value={formSessionType}
                    onChange={(e) => setFormSessionType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(SESSION_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Байршил</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Студи, гадаа..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Товлосон огноо *</label>
                  <input
                    type="datetime-local"
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Үргэлжлэх хугацаа (мин)</label>
                  <input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="60"
                    min="15"
                    step="15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Нийт дүн *</label>
                  <input
                    type="number"
                    value={formTotalAmount}
                    onChange={(e) => setFormTotalAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="150000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Урьдчилгаа</label>
                  <input
                    type="number"
                    value={formDepositAmount}
                    onChange={(e) => setFormDepositAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
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
                disabled={creating || !formScheduledAt || !formTotalAmount}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Зураг авалт үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Table / Calendar View */}
      {viewMode === 'calendar' ? (
        <CalendarView
          events={calendarEvents}
          onEventClick={(e) => router.push(`/dashboard/photo-sessions/${e.id}`)}
        />
      ) : (
      <>
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Гэрэл зурагчин</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Байршил</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Товлосон огноо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хугацаа</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => {
                const sc = STATUS_CONFIG[session.status] || STATUS_CONFIG.scheduled
                return (
                  <tr key={session.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white text-sm">
                        {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">{getCustomerName(session.customer_id)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{getPhotographerName(session.photographer_id)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{session.location || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {formatDateTime(session.scheduled_at)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{session.duration_minutes} мин</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <span className="text-white font-medium text-sm">
                          {formatPrice(session.total_amount)}
                        </span>
                        {session.deposit_amount != null && session.deposit_amount > 0 && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            Урьдчилгаа: {formatPrice(session.deposit_amount)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : sessions.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох зураг авалт олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📷</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Зураг авалт байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Эхний зураг авалтаа нэмж, цагийн хуваарь удирдаарай
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Эхний зураг авалтаа нэмэх
          </button>
        </div>
      )}
      </>
      )}
    </div>
  )
}
