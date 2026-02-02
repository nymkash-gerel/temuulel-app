'use client'

import { useEffect, useState, useCallback } from 'react'
import PushOptIn from '@/components/driver/PushOptIn'

interface DriverProfile {
  id: string
  name: string
  phone: string
  email: string | null
  vehicle_type: string | null
  vehicle_number: string | null
  status: string
  created_at: string
}

interface DriverStats {
  completed: number
  failed: number
  total: number
  completion_rate: number
}

const VEHICLE_LABELS: Record<string, { label: string; icon: string }> = {
  motorcycle: { label: 'Мотоцикл', icon: '🏍️' },
  car: { label: 'Машин', icon: '🚗' },
  bicycle: { label: 'Дугуй', icon: '🚲' },
  on_foot: { label: 'Явган', icon: '🚶' },
}

export default function DriverProfilePage() {
  const [driver, setDriver] = useState<DriverProfile | null>(null)
  const [stats, setStats] = useState<DriverStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editVehicleType, setEditVehicleType] = useState('')
  const [editVehicleNumber, setEditVehicleNumber] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/driver/profile')
      const data = await res.json()
      if (res.ok) {
        setDriver(data.driver)
        setStats(data.stats)
      }
    } catch {
      console.error('Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const startEditing = () => {
    if (!driver) return
    setEditName(driver.name)
    setEditVehicleType(driver.vehicle_type || '')
    setEditVehicleNumber(driver.vehicle_number || '')
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (editName && editName !== driver?.name) body.name = editName
      if (editVehicleType) body.vehicle_type = editVehicleType
      if (editVehicleNumber !== undefined) body.vehicle_number = editVehicleNumber || null

      const res = await fetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setEditing(false)
        await fetchProfile()
      }
    } catch {
      console.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !driver) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  const vehicleInfo = VEHICLE_LABELS[driver.vehicle_type || ''] || { label: 'Тодорхойгүй', icon: '🚗' }

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-2xl">
            {vehicleInfo.icon}
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">{driver.name}</h1>
            <p className="text-slate-400 text-sm">+976 {driver.phone}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-0.5">Тээврийн хэрэгсэл</p>
            <p className="text-white text-sm font-medium">{vehicleInfo.label}</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-0.5">Дугаар</p>
            <p className="text-white text-sm font-medium">{driver.vehicle_number || '—'}</p>
          </div>
        </div>

        <button
          onClick={startEditing}
          className="w-full mt-3 py-2.5 text-blue-400 text-sm font-medium hover:text-blue-300 border border-slate-600 rounded-xl hover:border-slate-500 transition-colors"
        >
          Засах
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Статистик</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
              <p className="text-slate-400 text-xs">Хүргэсэн</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
              <p className="text-slate-400 text-xs">Амжилтгүй</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-slate-400 text-xs">Нийт</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.completion_rate}%</p>
              <p className="text-slate-400 text-xs">Амжилт</p>
            </div>
          </div>
        </div>
      )}

      {/* Push Notifications */}
      <PushOptIn />

      {/* Member Since */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <p className="text-slate-400 text-sm">
          Бүртгүүлсэн: {new Date(driver.created_at).toLocaleDateString('mn-MN')}
        </p>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold text-lg mb-4">Профайл засах</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Нэр</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Тээврийн хэрэгсэл</label>
                <select
                  value={editVehicleType}
                  onChange={(e) => setEditVehicleType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Сонгоно уу</option>
                  <option value="motorcycle">🏍️ Мотоцикл</option>
                  <option value="car">🚗 Машин</option>
                  <option value="bicycle">🚲 Дугуй</option>
                  <option value="on_foot">🚶 Явган</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Тээврийн дугаар</label>
                <input
                  type="text"
                  value={editVehicleNumber}
                  onChange={(e) => setEditVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1234 УБА"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 px-4 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
              >
                Буцах
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
