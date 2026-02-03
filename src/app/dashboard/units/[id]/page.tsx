'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Unit {
  id: string
  unit_number: string
  unit_type: string | null
  floor: number | null
  max_occupancy: number | null
  base_rate: number | null
  amenities: string[] | null
  status: string
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Сул', color: 'bg-green-500/20 text-green-400' },
  occupied: { label: 'Захиалгатай', color: 'bg-blue-500/20 text-blue-400' },
  maintenance: { label: 'Засварт', color: 'bg-yellow-500/20 text-yellow-400' },
  out_of_service: { label: 'Ашиглахгүй', color: 'bg-red-500/20 text-red-400' },
}

const TYPE_LABELS: Record<string, string> = {
  single: 'Нэг хүний',
  double: 'Хоёр хүний',
  suite: 'Люкс',
  deluxe: 'Дэлюкс',
  studio: 'Студи',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function UnitDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formUnitNumber, setFormUnitNumber] = useState('')
  const [formUnitType, setFormUnitType] = useState('')
  const [formFloor, setFormFloor] = useState('')
  const [formMaxOccupancy, setFormMaxOccupancy] = useState('')
  const [formBaseRate, setFormBaseRate] = useState('')
  const [formAmenities, setFormAmenities] = useState('')
  const [formStatus, setFormStatus] = useState('available')

  const loadUnit = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/units/${id}`)
      if (res.ok) {
        const data = await res.json()
        setUnit(data)
        setFormUnitNumber(data.unit_number || '')
        setFormUnitType(data.unit_type || '')
        setFormFloor(data.floor?.toString() || '')
        setFormMaxOccupancy(data.max_occupancy?.toString() || '')
        setFormBaseRate(data.base_rate?.toString() || '')
        setFormAmenities(Array.isArray(data.amenities) ? data.amenities.join(', ') : '')
        setFormStatus(data.status || 'available')
      }
    } catch { /* */ }
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadUnit()
  }, [loadUnit])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/units/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: formUnitNumber,
          unit_type: formUnitType || null,
          floor: formFloor ? parseInt(formFloor) : null,
          max_occupancy: formMaxOccupancy ? parseInt(formMaxOccupancy) : null,
          base_rate: formBaseRate ? parseFloat(formBaseRate) : null,
          amenities: formAmenities ? formAmenities.split(',').map(s => s.trim()).filter(Boolean) : [],
          status: formStatus,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setUnit(data)
        setEditing(false)
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Өрөөг устгах уу?')) return
    const res = await fetch(`/api/units/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/dashboard/units')
    else alert('Устгах үед алдаа гарлаа')
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-64 bg-slate-700 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Өрөө олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/units')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  const sc = STATUS_CONFIG[unit.status] || STATUS_CONFIG.available

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/units')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">Өрөө #{unit.unit_number}</h1>
            <p className="text-slate-400 text-sm mt-1">Өрөөний дэлгэрэнгүй</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all">Засах</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl text-sm transition-all">Устгах</button>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        {editing ? (
          <div className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Өрөөний дугаар *</label>
                <input value={formUnitNumber} onChange={e => setFormUnitNumber(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төрөл</label>
                <select value={formUnitType} onChange={e => setFormUnitType(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                  <option value="">Сонгоогүй</option>
                  <option value="single">Нэг хүний</option>
                  <option value="double">Хоёр хүний</option>
                  <option value="suite">Люкс</option>
                  <option value="deluxe">Дэлюкс</option>
                  <option value="studio">Студи</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Давхар</label>
                <input type="number" value={formFloor} onChange={e => setFormFloor(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хүний тоо</label>
                <input type="number" value={formMaxOccupancy} onChange={e => setFormMaxOccupancy(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Үнэ (₮)</label>
                <input type="number" value={formBaseRate} onChange={e => setFormBaseRate(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Тохижилт (таслалаар)</label>
              <input value={formAmenities} onChange={e => setFormAmenities(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Төлөв</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                <option value="available">Сул</option>
                <option value="occupied">Захиалгатай</option>
                <option value="maintenance">Засварт</option>
                <option value="out_of_service">Ашиглахгүй</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">Болих</button>
              <button onClick={handleSave} disabled={saving || !formUnitNumber.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-slate-400">Өрөөний дугаар</span>
                <p className="text-white text-lg font-semibold">#{unit.unit_number}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төрөл</span>
                <p className="text-white">{unit.unit_type ? (TYPE_LABELS[unit.unit_type] || unit.unit_type) : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төлөв</span>
                <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span></p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-slate-400">Давхар</span>
                <p className="text-white">{unit.floor ?? '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Хамгийн их хүний тоо</span>
                <p className="text-white">{unit.max_occupancy ?? '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Суурь үнэ</span>
                <p className="text-white font-medium">{unit.base_rate != null ? `₮${unit.base_rate.toLocaleString()}` : '-'}</p>
              </div>
            </div>
            {unit.amenities && unit.amenities.length > 0 && (
              <div>
                <span className="text-sm text-slate-400">Тохижилт</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {unit.amenities.map((a, i) => (
                    <span key={i} className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs">{a}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-slate-700 text-sm text-slate-500 flex gap-6">
              <span>Үүсгэсэн: {formatDate(unit.created_at)}</span>
              <span>Шинэчилсэн: {formatDate(unit.updated_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
