'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TableLayoutDetail {
  id: string
  name: string
  description: string | null
  table_number: number | null
  capacity: number | null
  section: string | null
  shape: string | null
  position_x: number | null
  position_y: number | null
  status: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Сул', color: 'bg-green-500/20 text-green-400' },
  occupied: { label: 'Дүүрсэн', color: 'bg-red-500/20 text-red-400' },
  reserved: { label: 'Захиалсан', color: 'bg-blue-500/20 text-blue-400' },
  cleaning: { label: 'Цэвэрлэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
}

const SHAPE_LABELS: Record<string, string> = {
  round: 'Дугуй',
  square: 'Дөрвөлжин',
  rectangle: 'Тэгш өнцөгт',
  oval: 'Зууван',
}

function formatDateTime(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TableLayoutDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [table, setTable] = useState<TableLayoutDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    const { data } = await (supabase as any)
      .from('table_layouts')
      .select(`
        id, name, description, table_number, capacity, section, shape,
        position_x, position_y, status, is_active, notes, created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/table-layouts')
      return
    }

    setTable(data as unknown as TableLayoutDetail)
    setLoading(false)
  }

  function startEdit() {
    if (!table) return
    setEditData({
      name: table.name || '',
      table_number: table.table_number ?? '',
      capacity: table.capacity ?? '',
      section: table.section || '',
      shape: table.shape || 'square',
      status: table.status || 'available',
      is_active: table.is_active ?? true,
      notes: table.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!table) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: table.name || '',
        table_number: table.table_number ?? '',
        capacity: table.capacity ?? '',
        section: table.section || '',
        shape: table.shape || 'square',
        status: table.status || 'available',
        is_active: table.is_active ?? true,
        notes: table.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'table_number' || key === 'capacity') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else if (key === 'is_active') {
            changes[key] = editData[key]
          } else {
            changes[key] = editData[key]
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/table-layouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Алдаа гарлаа' }))
        throw new Error(err.error || 'Алдаа гарлаа')
      }

      setIsEditing(false)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!table) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Ширээ олдсонгүй</p>
        <Link href="/dashboard/table-layouts" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[table.status] || { label: table.status, color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/table-layouts"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name as string}
                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                    className={inputClassName}
                  />
                ) : (
                  table.name
                )}
              </h1>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="available">Сул</option>
                  <option value="occupied">Дүүрсэн</option>
                  <option value="reserved">Захиалсан</option>
                  <option value="cleaning">Цэвэрлэж буй</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${table.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {table.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
              </span>
              {!isEditing ? (
                <button
                  onClick={startEdit}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Засах
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              )}
            </div>
            <p className="text-slate-400 mt-1">
              Ширээ #{table.table_number ?? '-'} - {table.section || 'Хэсэг тодорхойгүй'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Ширээний мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Нэр</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name as string}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{table.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Ширээний дугаар</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.table_number as string | number}
                  onChange={e => setEditData({ ...editData, table_number: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="1"
                />
              ) : (
                <p className="text-white font-mono mt-1">#{table.table_number ?? '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Багтаамж</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.capacity as string | number}
                  onChange={e => setEditData({ ...editData, capacity: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="1"
                />
              ) : (
                <p className="text-white mt-1">{table.capacity != null ? `${table.capacity} хүн` : '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Хэсэг</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.section as string}
                  onChange={e => setEditData({ ...editData, section: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{table.section || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Хэлбэр</p>
              {isEditing ? (
                <select
                  value={editData.shape as string}
                  onChange={e => setEditData({ ...editData, shape: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="round">Дугуй</option>
                  <option value="square">Дөрвөлжин</option>
                  <option value="rectangle">Тэгш өнцөгт</option>
                  <option value="oval">Зууван</option>
                </select>
              ) : (
                <p className="text-white mt-1">{SHAPE_LABELS[table.shape || ''] || table.shape || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Идэвхтэй</p>
              {isEditing ? (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editData.is_active as boolean}
                    onChange={e => setEditData({ ...editData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-white">{editData.is_active ? 'Тийм' : 'Үгүй'}</span>
                </label>
              ) : (
                <p className={`mt-1 font-medium ${table.is_active ? 'text-green-400' : 'text-slate-400'}`}>
                  {table.is_active ? 'Тийм' : 'Үгүй'}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(table.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(table.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Төлөв</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                table.status === 'available' ? 'bg-green-500' :
                table.status === 'occupied' ? 'bg-red-500' :
                table.status === 'reserved' ? 'bg-blue-500' :
                'bg-yellow-500'
              }`} />
              <span className="text-white font-medium">{sc.label}</span>
            </div>
          </div>

          {/* Position Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Байрлал</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">X</span>
                <span className="text-white text-sm font-mono">{table.position_x ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Y</span>
                <span className="text-white text-sm font-mono">{table.position_y ?? '-'}</span>
              </div>
            </div>
          </div>

          {/* Capacity Visual Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Багтаамж</h3>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{table.capacity ?? '-'}</p>
              <p className="text-xs text-slate-500 mt-1">хүн</p>
            </div>
          </div>
        </div>
      </div>

      {/* Description Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тайлбар</h3>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {table.description || 'Тайлбар оруулаагүй'}
        </p>
      </div>

      {/* Notes Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тэмдэглэл</h3>
        {isEditing ? (
          <textarea
            value={editData.notes as string}
            onChange={e => setEditData({ ...editData, notes: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {table.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(table.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(table.updated_at)}</span>
      </div>
    </div>
  )
}
