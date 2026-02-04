'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ServiceArea {
  id: string
  name: string
  description: string | null
  zip_codes: string[] | null
  is_active: boolean
  created_at: string
}

export default function ServiceAreasPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [areas, setAreas] = useState<ServiceArea[]>([])
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formZipCodes, setFormZipCodes] = useState('')
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
          .from('service_areas')
          .select('id, name, description, zip_codes, is_active, created_at')
          .eq('store_id', store.id)
          .order('name', { ascending: true })

        if (data) {
          setAreas(data as unknown as ServiceArea[])
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = areas

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.zip_codes?.some(z => z.includes(q))
      )
    }

    if (activeFilter === 'active') result = result.filter(a => a.is_active)
    if (activeFilter === 'inactive') result = result.filter(a => !a.is_active)

    return result
  }, [areas, search, activeFilter])

  const stats = useMemo(() => ({
    total: areas.length,
    active: areas.filter(a => a.is_active).length,
  }), [areas])

  async function handleCreate() {
    if (!formName.trim()) return
    setCreating(true)

    try {
      const zipCodesArray = formZipCodes.trim()
        ? formZipCodes.split(',').map(z => z.trim()).filter(Boolean)
        : null

      const { data, error } = await supabase
        .from('service_areas')
        .insert({
          store_id: storeId,
          name: formName.trim(),
          description: formDescription.trim() || null,
          zip_codes: zipCodesArray,
          is_active: formIsActive,
        })
        .select('id, name, description, zip_codes, is_active, created_at')
        .single()

      if (error) throw error

      if (data) {
        setAreas(prev => [data as unknown as ServiceArea, ...prev])
        setShowCreateForm(false)
        setFormName('')
        setFormDescription('')
        setFormZipCodes('')
        setFormIsActive(true)
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(area: ServiceArea) {
    const { error } = await supabase
      .from('service_areas')
      .update({ is_active: !area.is_active })
      .eq('id', area.id)

    if (!error) {
      setAreas(prev => prev.map(a =>
        a.id === area.id ? { ...a, is_active: !a.is_active } : a
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
          <h1 className="text-2xl font-bold text-white">Үйлчилгээний бүсүүд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {areas.length} бүс
            {filtered.length !== areas.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          + Бүс нэмэх
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт бүс</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Идэвхгүй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total - stats.active}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Хамрах хувь</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
          </p>
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
                placeholder="Бүсийн нэр, тайлбар, zip код хайх..."
                className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүгд</option>
            <option value="active">Идэвхтэй</option>
            <option value="inactive">Идэвхгүй</option>
          </select>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ үйлчилгээний бүс</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Бүсийн нэр *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Баянзүрх дүүрэг"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тайлбар</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Бүсийн тайлбар..."
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">ZIP кодууд (таслалаар тусгаарлана)</label>
                <input
                  type="text"
                  value={formZipCodes}
                  onChange={(e) => setFormZipCodes(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="13350, 13360, 13370"
                />
              </div>
              <div className="flex items-center gap-3">
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

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formName.trim()}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Бүс үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Тайлбар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">ZIP кодууд</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((area) => (
                <tr key={area.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{area.name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <p className="text-slate-300 text-sm truncate max-w-[200px]" title={area.description || ''}>
                      {area.description || '-'}
                    </p>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <div className="flex flex-wrap gap-1">
                      {area.zip_codes && area.zip_codes.length > 0 ? (
                        area.zip_codes.slice(0, 5).map((zip, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-700 text-slate-300 rounded text-xs">
                            {zip}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                      {area.zip_codes && area.zip_codes.length > 5 && (
                        <span className="px-2 py-0.5 bg-gray-700 text-slate-400 rounded text-xs">
                          +{area.zip_codes.length - 5}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      area.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {area.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(area.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <button
                      onClick={() => toggleActive(area)}
                      className={`px-3 py-1 text-xs rounded-lg transition-all ${
                        area.is_active
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      }`}
                    >
                      {area.is_active ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : areas.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох бүс олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setActiveFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#127759;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Үйлчилгээний бүс байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Үйлчилгээ үзүүлэх газар зүйн бүсүүдээ тодорхойлно уу
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            Эхний бүсээ нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
