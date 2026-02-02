'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TableLayout {
  id: string
  name: string
  section: string | null
  capacity: number
  shape: string
  status: string
  is_active: boolean
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Чөлөөтэй', color: 'bg-green-500/20 text-green-400' },
  occupied: { label: 'Зочинтой', color: 'bg-red-500/20 text-red-400' },
  reserved: { label: 'Захиалсан', color: 'bg-blue-500/20 text-blue-400' },
  cleaning: { label: 'Цэвэрлэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
}

const SHAPE_LABELS: Record<string, string> = {
  round: 'Дугуй',
  square: 'Дөрвөлжин',
  rectangular: 'Тэгш өнцөгт',
  oval: 'Зууван',
  bar: 'Бар',
}

export default function TableLayoutsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tables, setTables] = useState<TableLayout[]>([])
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formName, setFormName] = useState('')
  const [formSection, setFormSection] = useState('')
  const [formCapacity, setFormCapacity] = useState('')
  const [formShape, setFormShape] = useState('round')
  const [formIsActive, setFormIsActive] = useState(true)

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

        const { data } = await supabase
          .from('table_layouts')
          .select('id, name, section, capacity, shape, status, is_active, created_at')
          .eq('store_id', store.id)
          .order('name', { ascending: true })

        if (data) {
          setTables(data as unknown as TableLayout[])
        }
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sections = useMemo(() => {
    const set = new Set(tables.map(t => t.section).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [tables])

  const filtered = useMemo(() => {
    let result = tables

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.section?.toLowerCase().includes(q)
      )
    }

    if (statusFilter) result = result.filter(t => t.status === statusFilter)
    if (sectionFilter) result = result.filter(t => t.section === sectionFilter)

    return result
  }, [tables, search, statusFilter, sectionFilter])

  const stats = useMemo(() => ({
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  }), [tables])

  async function handleCreate() {
    if (!formName.trim() || !formCapacity) return
    setCreating(true)

    try {
      const { data, error } = await supabase
        .from('table_layouts')
        .insert({
          store_id: storeId,
          name: formName.trim(),
          section: formSection.trim() || null,
          capacity: Number(formCapacity),
          shape: formShape,
          status: 'available',
          is_active: formIsActive,
        })
        .select('id, name, section, capacity, shape, status, is_active, created_at')
        .single()

      if (error) throw error

      if (data) {
        setTables(prev => [data as unknown as TableLayout, ...prev])
        setShowCreateForm(false)
        setFormName('')
        setFormSection('')
        setFormCapacity('')
        setFormShape('round')
        setFormIsActive(true)
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(tableId: string, newStatus: string) {
    const { error } = await supabase
      .from('table_layouts')
      .update({ status: newStatus })
      .eq('id', tableId)

    if (!error) {
      setTables(prev => prev.map(t =>
        t.id === tableId ? { ...t, status: newStatus } : t
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
          <h1 className="text-2xl font-bold text-white">Ширээний зохион байгуулалт</h1>
          <p className="text-slate-400 mt-1">
            Нийт {tables.length} ширээ
            {filtered.length !== tables.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          + Ширээ нэмэх
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт ширээ</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Чөлөөтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.available}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Зочинтой</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.occupied}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Захиалсан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.reserved}</p>
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
                placeholder="Ширээний нэр, хэсэг хайх..."
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
            <option value="available">Чөлөөтэй</option>
            <option value="occupied">Зочинтой</option>
            <option value="reserved">Захиалсан</option>
            <option value="cleaning">Цэвэрлэж буй</option>
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх хэсэг</option>
            {sections.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {(statusFilter || sectionFilter) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setStatusFilter(''); setSectionFilter('') }}
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
            <h2 className="text-xl font-bold text-white mb-4">Шинэ ширээ нэмэх</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ширээний нэр *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="A1, VIP-1, Терас-3..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хэсэг / Зон</label>
                  <input
                    type="text"
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Дотор, Терас, VIP"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Суудлын тоо *</label>
                  <input
                    type="number"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="4"
                    min="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хэлбэр</label>
                  <select
                    value={formShape}
                    onChange={(e) => setFormShape(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(SHAPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-3 pb-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <span className="text-sm text-slate-300">Идэвхтэй</span>
                  </div>
                </div>
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
                disabled={creating || !formName.trim() || !formCapacity}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Ширээ нэмэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хэсэг</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Суудал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хэлбэр</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Идэвхтэй</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((table) => {
                const sc = STATUS_CONFIG[table.status] || { label: table.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={table.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{table.name}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{table.section || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-white font-medium">{table.capacity}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {SHAPE_LABELS[table.shape] || table.shape}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        table.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {table.is_active ? 'Тийм' : 'Үгүй'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex gap-1 justify-end">
                        {table.status === 'occupied' && (
                          <button
                            onClick={() => updateStatus(table.id, 'cleaning')}
                            className="px-2 py-1 text-xs bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-all"
                          >
                            Цэвэрлэх
                          </button>
                        )}
                        {table.status === 'cleaning' && (
                          <button
                            onClick={() => updateStatus(table.id, 'available')}
                            className="px-2 py-1 text-xs bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-all"
                          >
                            Чөлөөлөх
                          </button>
                        )}
                        {table.status === 'reserved' && (
                          <button
                            onClick={() => updateStatus(table.id, 'occupied')}
                            className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                          >
                            Суулгах
                          </button>
                        )}
                        {table.status === 'available' && (
                          <button
                            onClick={() => updateStatus(table.id, 'occupied')}
                            className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                          >
                            Суулгах
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
      ) : tables.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох ширээ олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setSectionFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#127869;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Ширээ байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Рестораны ширээнүүдийг бүртгэж, захиалга болон суудлын менежмент хийгээрэй
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            Эхний ширээгээ нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
