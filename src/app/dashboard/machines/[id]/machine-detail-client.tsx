'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface MachineDetail {
  id: string
  name: string
  machine_type: string | null
  model: string | null
  serial_number: string | null
  status: string
  capacity: number | null
  current_load: number | null
  last_maintenance: string | null
  next_maintenance: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Боломжтой', color: 'bg-green-500/20 text-green-400' },
  in_use: { label: 'Ашиглагдаж буй', color: 'bg-blue-500/20 text-blue-400' },
  maintenance: { label: 'Засвар', color: 'bg-yellow-500/20 text-yellow-400' },
  out_of_order: { label: 'Эвдэрсэн', color: 'bg-red-500/20 text-red-400' },
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

interface MachineDetailClientProps {
  initialMachine: MachineDetail
  machineId: string
}

export default function MachineDetailClient({ initialMachine, machineId }: MachineDetailClientProps) {
  const router = useRouter()
  const [machine, setMachine] = useState<MachineDetail>(initialMachine)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/machines/${machineId}`)
      if (!res.ok) { router.push('/dashboard/machines'); return }
      const data = await res.json()
      setMachine(data)
    } catch { router.push('/dashboard/machines') }
  }, [machineId, router])

  function startEdit() {
    if (!machine) return
    setEditData({
      name: machine.name || '',
      status: machine.status || 'available',
      capacity: machine.capacity ?? '',
      notes: machine.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!machine) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: machine.name || '',
        status: machine.status || 'available',
        capacity: machine.capacity ?? '',
        notes: machine.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'capacity') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
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

      const res = await fetch(`/api/machines/${machineId}`, {
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

  const sc = STATUS_CONFIG[machine.status] || { label: machine.status, color: 'bg-slate-500/20 text-slate-400' }
  const loadPercent = machine.capacity && machine.current_load
    ? Math.round((machine.current_load / machine.capacity) * 100)
    : null
  const inputClassName = 'w-full px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/machines"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
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
                  machine.name
                )}
              </h1>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="available">Боломжтой</option>
                  <option value="in_use">Ашиглагдаж буй</option>
                  <option value="maintenance">Засвар</option>
                  <option value="out_of_order">Эвдэрсэн</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
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
            <p className="text-slate-400 mt-1">{machine.machine_type || 'Төрөл тодорхойгүй'} - {machine.model || 'Загвар тодорхойгүй'}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Machine Info Card */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Машины мэдээлэл</h3>
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
                <p className="text-white mt-1">{machine.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төрөл</p>
              <p className="text-white mt-1">{machine.machine_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Загвар</p>
              <p className="text-white mt-1">{machine.model || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Серийн дугаар</p>
              <p className="text-white font-mono mt-1">{machine.serial_number || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Багтаамж</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.capacity as string | number}
                  onChange={e => setEditData({ ...editData, capacity: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                />
              ) : (
                <p className="text-white mt-1">{machine.capacity ?? '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Одоогийн ачаалал</p>
              <p className="text-white mt-1">{machine.current_load ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(machine.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(machine.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Status & Load */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Төлөв</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                machine.status === 'available' ? 'bg-green-500' :
                machine.status === 'in_use' ? 'bg-blue-500' :
                machine.status === 'maintenance' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <span className="text-white font-medium">{sc.label}</span>
            </div>
          </div>

          {/* Load Card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Ачаалал</h3>
            {loadPercent !== null ? (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{machine.current_load} / {machine.capacity}</span>
                  <span>{loadPercent}%</span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      loadPercent > 80 ? 'bg-red-500' :
                      loadPercent > 50 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, loadPercent)}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Мэдээлэл байхгүй</p>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-4">Засвар үйлчилгээ</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">Сүүлийн засвар</p>
            <p className="text-white mt-1">{formatDate(machine.last_maintenance)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Дараагийн засвар</p>
            <p className={`mt-1 ${machine.next_maintenance ? 'text-blue-400 font-medium' : 'text-white'}`}>
              {formatDate(machine.next_maintenance)}
            </p>
          </div>
        </div>
      </div>

      {/* Notes Card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
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
            {machine.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(machine.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(machine.updated_at)}</span>
      </div>
    </div>
  )
}
