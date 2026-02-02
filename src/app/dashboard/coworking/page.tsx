'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CoworkingSpace {
  id: string
  store_id: string
  name: string
  space_type: 'hot_desk' | 'dedicated_desk' | 'private_office' | 'meeting_room' | 'event_space' | 'phone_booth'
  capacity: number
  hourly_rate: number | null
  daily_rate: number | null
  monthly_rate: number | null
  amenities: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  hot_desk: 'Чөлөөт ширээ',
  dedicated_desk: 'Тусгай ширээ',
  private_office: 'Хувийн өрөө',
  meeting_room: 'Хурлын өрөө',
  event_space: 'Арга хэмжээний зал',
  phone_booth: 'Утасны бүхээг',
}

const SPACE_TYPE_COLORS: Record<string, string> = {
  hot_desk: 'bg-cyan-500/20 text-cyan-400',
  dedicated_desk: 'bg-blue-500/20 text-blue-400',
  private_office: 'bg-purple-500/20 text-purple-400',
  meeting_room: 'bg-orange-500/20 text-orange-400',
  event_space: 'bg-pink-500/20 text-pink-400',
  phone_booth: 'bg-green-500/20 text-green-400',
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function CoworkingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [spaces, setSpaces] = useState<CoworkingSpace[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formName, setFormName] = useState('')
  const [formSpaceType, setFormSpaceType] = useState<string>('hot_desk')
  const [formCapacity, setFormCapacity] = useState('')
  const [formHourlyRate, setFormHourlyRate] = useState('')
  const [formDailyRate, setFormDailyRate] = useState('')
  const [formMonthlyRate, setFormMonthlyRate] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      try {
        const res = await fetch('/api/coworking-spaces')
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setSpaces(json.data as CoworkingSpace[])
          }
        }
      } catch {
        // silently fail
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = spaces

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q)
      )
    }

    if (typeFilter) {
      result = result.filter(s => s.space_type === typeFilter)
    }

    if (activeFilter) {
      result = result.filter(s =>
        activeFilter === 'active' ? s.is_active : !s.is_active
      )
    }

    return result
  }, [spaces, search, typeFilter, activeFilter])

  // KPI calculations
  const kpis = useMemo(() => {
    const total = spaces.length
    const active = spaces.filter(s => s.is_active).length
    const totalCapacity = spaces.reduce((sum, s) => sum + (s.capacity || 0), 0)
    const avgCapacity = total > 0 ? Math.round(totalCapacity / total) : 0

    return { total, active, avgCapacity }
  }, [spaces])

  async function handleCreate() {
    if (!formName.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/coworking-spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          space_type: formSpaceType,
          capacity: formCapacity ? Number(formCapacity) : 1,
          hourly_rate: formHourlyRate ? Number(formHourlyRate) : undefined,
          daily_rate: formDailyRate ? Number(formDailyRate) : undefined,
          monthly_rate: formMonthlyRate ? Number(formMonthlyRate) : undefined,
          is_active: formIsActive,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setSpaces(prev => [json.data, ...prev])
        }
        setShowCreateForm(false)
        setFormName('')
        setFormSpaceType('hot_desk')
        setFormCapacity('')
        setFormHourlyRate('')
        setFormDailyRate('')
        setFormMonthlyRate('')
        setFormIsActive(true)
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
          <h1 className="text-2xl font-bold text-white">Коворкинг зай</h1>
          <p className="text-slate-400 mt-1">
            Нийт {spaces.length} зай
            {filtered.length !== spaces.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
        >
          + Шинэ зай нэмэх
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Нийт зай</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.active}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Дундаж багтаамж</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.avgCapacity}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">&#x1F50D;</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Нэрээр хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="hot_desk">Чөлөөт ширээ</option>
              <option value="dedicated_desk">Тусгай ширээ</option>
              <option value="private_office">Хувийн өрөө</option>
              <option value="meeting_room">Хурлын өрөө</option>
              <option value="event_space">Арга хэмжээний зал</option>
              <option value="phone_booth">Утасны бүхээг</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="active">Идэвхтэй</option>
              <option value="inactive">Идэвхгүй</option>
            </select>
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ коворкинг зай</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Нэр *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Зайн нэр оруулах..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Төрөл *</label>
                  <select
                    value={formSpaceType}
                    onChange={(e) => setFormSpaceType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="hot_desk">Чөлөөт ширээ</option>
                    <option value="dedicated_desk">Тусгай ширээ</option>
                    <option value="private_office">Хувийн өрөө</option>
                    <option value="meeting_room">Хурлын өрөө</option>
                    <option value="event_space">Арга хэмжээний зал</option>
                    <option value="phone_booth">Утасны бүхээг</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Багтаамж *</label>
                  <input
                    type="number"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="1"
                    min="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Цагийн үнэ</label>
                  <input
                    type="number"
                    value={formHourlyRate}
                    onChange={(e) => setFormHourlyRate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="5,000"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Өдрийн үнэ</label>
                  <input
                    type="number"
                    value={formDailyRate}
                    onChange={(e) => setFormDailyRate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="30,000"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Сарын үнэ</label>
                  <input
                    type="number"
                    value={formMonthlyRate}
                    onChange={(e) => setFormMonthlyRate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="500,000"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
                <span className="text-sm text-slate-300">Идэвхтэй</span>
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
                disabled={creating || !formName.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Зай үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coworking Spaces Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Багтаамж</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Цагийн үнэ</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Өдрийн үнэ</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Сарын үнэ</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((space) => (
                <tr key={space.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{space.name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${SPACE_TYPE_COLORS[space.space_type] || 'bg-slate-500/20 text-slate-400'}`}>
                      {SPACE_TYPE_LABELS[space.space_type] || space.space_type}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white">{space.capacity} хүн</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">
                      {space.hourly_rate != null ? formatPrice(space.hourly_rate) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">
                      {space.daily_rate != null ? formatPrice(space.daily_rate) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">
                      {space.monthly_rate != null ? formatPrice(space.monthly_rate) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    {space.is_active ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        Идэвхтэй
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
                        Идэвхгүй
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(space.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : spaces.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох зай олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setActiveFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#x1F3E2;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Коворкинг зай байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Эхний коворкинг зайгаа нэмж эхлээрэй
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Эхний зайгаа нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
