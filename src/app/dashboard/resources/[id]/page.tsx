'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

export default function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [capacity, setCapacity] = useState(2)
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [status, setStatus] = useState<'available' | 'occupied' | 'maintenance' | 'reserved'>('available')
  const [features, setFeatures] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) return

      const { data } = await supabase
        .from('bookable_resources')
        .select('*')
        .eq('id', id)
        .eq('store_id', store.id)
        .single()

      if (data) {
        const r = data as Resource
        setResource(r)
        setName(r.name)
        setDescription(r.description || '')
        setCapacity(r.capacity)
        setPricePerUnit(r.price_per_unit)
        setStatus(r.status as typeof status)
        setFeatures(r.features || {})
      }
      setLoading(false)
    }
    load()
  }, [id, supabase])

  async function handleSave() {
    if (!resource) return
    setSaving(true)
    setSaved(false)

    await supabase
      .from('bookable_resources')
      .update({
        name,
        description: description || null,
        capacity,
        price_per_unit: pricePerUnit,
        status,
        features: features as unknown as Record<string, never>,
      })
      .eq('id', resource.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleDelete() {
    if (!resource || !confirm('Устгахдаа итгэлтэй байна уу?')) return
    await supabase.from('bookable_resources').delete().eq('id', resource.id)
    router.push('/dashboard/resources')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Нөөц олдсонгүй</p>
        <Link href="/dashboard/resources" className="text-blue-400 mt-2 inline-block">Буцах</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/resources" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{resource.name}</h1>
          <p className="text-slate-400 mt-1">{TYPE_LABELS[resource.type] || resource.type}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Мэдээлэл</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Нэр</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Тайлбар</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Багтаамж (хүн)</label>
              <input
                type="number"
                value={capacity}
                onChange={e => setCapacity(parseInt(e.target.value) || 1)}
                min={1}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Үнэ (₮)</label>
              <input
                type="number"
                value={pricePerUnit}
                onChange={e => setPricePerUnit(parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Статус</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as typeof status)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="available">Чөлөөтэй</option>
              <option value="occupied">Завгүй</option>
              <option value="maintenance">Засвартай</option>
              <option value="reserved">Захиалсан</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Онцлог</label>
            <div className="flex flex-wrap gap-2">
              {getFeatureOptions(resource.type).map(feat => (
                <label key={feat} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!features[feat]}
                    onChange={e => setFeatures({ ...features, [feat]: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-300">{feat.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          {saved && (
            <span className="text-emerald-400 text-sm">Амжилттай хадгаллаа</span>
          )}
          <button
            onClick={handleDelete}
            className="ml-auto px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            Устгах
          </button>
        </div>
      </div>
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
