'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Venue {
  id: string
  store_id: string
  name: string
  description: string | null
  capacity: number
  hourly_rate: number
  daily_rate: number
  amenities: Record<string, unknown> | null
  images: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface NewVenueForm {
  name: string
  description: string
  capacity: string
  hourly_rate: string
  daily_rate: string
  is_active: boolean
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function VenuesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [venues, setVenues] = useState<Venue[]>([])
  const [total, setTotal] = useState(0)
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewVenueForm>({
    name: '',
    description: '',
    capacity: '',
    hourly_rate: '',
    daily_rate: '',
    is_active: true,
  })

  async function loadVenues() {
    try {
      const res = await fetch('/api/venues')
      if (res.ok) {
        const json = await res.json()
        setVenues(json.data || [])
        setTotal(json.total || 0)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVenues()
   
  }, [])

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return venues
    if (activeFilter === 'active') return venues.filter(v => v.is_active)
    return venues.filter(v => !v.is_active)
  }, [venues, activeFilter])

  const stats = useMemo(() => {
    const totalVenues = venues.length
    const activeVenues = venues.filter(v => v.is_active).length
    const avgCapacity = totalVenues > 0
      ? Math.round(venues.reduce((sum, v) => sum + v.capacity, 0) / totalVenues)
      : 0
    return { totalVenues, activeVenues, avgCapacity }
  }, [venues])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          capacity: parseInt(form.capacity) || 0,
          hourly_rate: parseFloat(form.hourly_rate) || 0,
          daily_rate: parseFloat(form.daily_rate) || 0,
          is_active: form.is_active,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        setForm({
          name: '',
          description: '',
          capacity: '',
          hourly_rate: '',
          daily_rate: '',
          is_active: true,
        })
        await loadVenues()
      } else {
        const err = await res.json()
        setError(err.error || 'Алдаа гарлаа')
      }
    } catch {
      setError('Алдаа гарлаа')
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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Заалууд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {total} заал
            {filtered.length !== venues.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/venues/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Заал нэмэх
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт заал</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalVenues}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Идэвхтэй заал</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.activeVenues}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Дундаж багтаамж</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.avgCapacity} хүн</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Төлөв:</span>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                activeFilter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              Бүгд ({venues.length})
            </button>
            <button
              onClick={() => setActiveFilter('active')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                activeFilter === 'active'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              Идэвхтэй ({venues.filter(v => v.is_active).length})
            </button>
            <button
              onClick={() => setActiveFilter('inactive')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                activeFilter === 'inactive'
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              Идэвхгүй ({venues.filter(v => !v.is_active).length})
            </button>
          </div>
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Шинэ заал нэмэх</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Нэр *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Жиш: Их заал, VIP өрөө"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Багтаамж *</label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="100"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Цагийн үнэ (₮)</label>
                <input
                  type="number"
                  min="0"
                  value={form.hourly_rate}
                  onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                  placeholder="50000"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Өдрийн үнэ (₮)</label>
                <input
                  type="number"
                  min="0"
                  value={form.daily_rate}
                  onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                  placeholder="300000"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">Идэвхтэй эсэх</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`w-full px-4 py-3 rounded-xl border transition-all text-left ${
                    form.is_active
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-slate-700/50 border-slate-600 text-slate-400'
                  }`}
                >
                  {form.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                </button>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Тайлбар</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Заалны тайлбар, онцлог шинж чанарууд..."
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || !form.name.trim() || !form.capacity}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Хадгалж байна...' : 'Үүсгэх'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Болих
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Venues Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Багтаамж</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Цагийн үнэ</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Өдрийн үнэ</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((venue) => (
                <tr key={venue.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <div>
                      <p className="text-white font-medium">{venue.name}</p>
                      {venue.description && (
                        <p className="text-slate-400 text-sm mt-0.5 line-clamp-1">{venue.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-slate-300">{venue.capacity} хүн</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-white font-medium">
                      {venue.hourly_rate > 0 ? formatPrice(venue.hourly_rate) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-white font-medium">
                      {venue.daily_rate > 0 ? formatPrice(venue.daily_rate) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      venue.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {venue.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(venue.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : venues.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Шүүлтүүрт тохирох заал олдсонгүй</p>
          <button
            onClick={() => setActiveFilter('all')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#127963;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Заал бүртгэгдээгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Арга хэмжээ, уулзалтын заалуудаа нэмж бүртгэн удирдаарай
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Эхний заалаа нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
