'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveStoreId } from '@/lib/resolve-store'

interface Resource {
  id: string
  type: string
  name: string
  description: string | null
  capacity: number
  price_per_unit: number
  features: Record<string, boolean>
  status: string
  sort_order: number
}

const TYPE_LABELS: Record<string, string> = {
  table: 'Ширээ',
  room: 'Өрөө',
  tent_site: 'Майхны талбай',
  rv_site: 'RV талбай',
  ger: 'Монгол гэр',
  cabin: 'Модон байшин',
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Чөлөөтэй',
  occupied: 'Завгүй',
  maintenance: 'Засвартай',
  reserved: 'Захиалсан',
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-500/20 text-green-400',
  occupied: 'bg-red-500/20 text-red-400',
  maintenance: 'bg-yellow-500/20 text-yellow-400',
  reserved: 'bg-blue-500/20 text-blue-400',
}

export default function ResourcesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'table' as 'table' | 'room' | 'tent_site' | 'rv_site' | 'ger' | 'cabin',
    name: '',
    description: '',
    capacity: 2,
    price_per_unit: 0,
    features: {} as Record<string, boolean>,
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const storeId = await resolveStoreId(supabase, user.id)
    const store = storeId ? { id: storeId } : null

    if (!store) return
    setStoreId(store.id)

    const { data } = await supabase
      .from('bookable_resources')
      .select('*')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true })

    if (data) setResources(data as Resource[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)

    const { error } = await supabase.from('bookable_resources').insert({
      store_id: storeId,
      type: form.type,
      name: form.name.trim(),
      description: form.description || null,
      capacity: form.capacity,
      price_per_unit: form.price_per_unit,
      features: form.features as unknown as Record<string, never>,
      status: 'available' as const,
      sort_order: resources.length,
    })

    if (!error) {
      setShowModal(false)
      setForm({ type: 'table', name: '', description: '', capacity: 2, price_per_unit: 0, features: {} })
      loadData()
    }
    setSaving(false)
  }

  async function toggleStatus(id: string, current: string) {
    const next = (current === 'available' ? 'maintenance' : 'available') as 'available' | 'maintenance'
    await supabase.from('bookable_resources').update({ status: next }).eq('id', id)
    loadData()
  }

  async function deleteResource(id: string) {
    if (!confirm('Устгахдаа итгэлтэй байна уу?')) return
    await supabase.from('bookable_resources').delete().eq('id', id)
    loadData()
  }

  const filtered = filterType === 'all' ? resources : resources.filter(r => r.type === filterType)
  const types = [...new Set(resources.map(r => r.type))]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Нөөц / Ширээ</h1>
          <p className="text-slate-400 mt-1">Ширээ, өрөө, гэр, майхны талбай удирдах</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
        >
          + Нэмэх
        </button>
      </div>

      {/* Filter */}
      {types.length > 1 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
              filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Бүгд ({resources.length})
          </button>
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                filterType === t ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {TYPE_LABELS[t] || t} ({resources.filter(r => r.type === t).length})
            </button>
          ))}
        </div>
      )}

      {/* Resource Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/50 border border-slate-700 rounded-2xl">
          <p className="text-4xl mb-3">🪑</p>
          <p className="text-slate-400">Нөөц нэмээгүй байна</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all"
          >
            Эхний нөөцөө нэмэх
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{TYPE_LABELS[r.type] || r.type}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[r.status] || 'bg-slate-600 text-slate-300'}`}>
                  {STATUS_LABELS[r.status] || r.status}
                </span>
              </div>

              {r.description && (
                <p className="text-sm text-slate-400 mb-3">{r.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                <span>👥 {r.capacity} хүн</span>
                {r.price_per_unit > 0 && (
                  <span>💰 {new Intl.NumberFormat('mn-MN').format(r.price_per_unit)}₮</span>
                )}
              </div>

              {/* Feature tags */}
              {Object.entries(r.features || {}).filter(([, v]) => v).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(r.features).filter(([, v]) => v).map(([key]) => (
                    <span key={key} className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                      {key.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-700">
                <Link
                  href={`/dashboard/resources/${r.id}`}
                  className="flex-1 py-2 text-center text-sm text-blue-400 hover:bg-slate-700 rounded-lg transition-all"
                >
                  Засах
                </Link>
                <button
                  onClick={() => toggleStatus(r.id, r.status)}
                  className="flex-1 py-2 text-center text-sm text-slate-400 hover:bg-slate-700 rounded-lg transition-all"
                >
                  {r.status === 'available' ? 'Засвар' : 'Чөлөөлөх'}
                </button>
                <button
                  onClick={() => deleteResource(r.id)}
                  className="py-2 px-3 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  Устгах
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Нөөц нэмэх</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Төрөл *</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as typeof form.type })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Нэр *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Жиш: Ширээ 4, VIP өрөө, Монгол гэр 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Тайлбар</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Цонхны хажуу, VIP өрөө гэх мэт"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Багтаамж *</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })}
                    min={1}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Үнэ (₮)</label>
                  <input
                    type="number"
                    value={form.price_per_unit}
                    onChange={e => setForm({ ...form, price_per_unit: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Feature checkboxes based on type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Онцлог</label>
                <div className="flex flex-wrap gap-2">
                  {getFeatureOptions(form.type).map(feat => (
                    <label key={feat} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.features[feat]}
                        onChange={e => setForm({
                          ...form,
                          features: { ...form.features, [feat]: e.target.checked },
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-300">{feat.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Болих
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Хадгалж байна...' : 'Үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getFeatureOptions(type: string): string[] {
  switch (type) {
    case 'table':
      return ['window_view', 'private_room', 'outdoor', 'vip']
    case 'room':
      return ['wifi', 'tv', 'minibar', 'balcony', 'bathroom']
    case 'ger':
      return ['heated', 'wifi', 'bathroom', 'traditional']
    case 'tent_site':
      return ['electricity', 'water', 'fire_pit', 'shade']
    case 'rv_site':
      return ['electricity', 'water', 'sewage', 'wifi']
    case 'cabin':
      return ['wifi', 'kitchen', 'bathroom', 'fireplace', 'porch']
    default:
      return []
  }
}
