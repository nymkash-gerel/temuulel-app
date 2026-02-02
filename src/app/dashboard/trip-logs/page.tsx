'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TripLog {
  id: string
  start_location: string
  end_location: string | null
  start_time: string
  end_time: string | null
  distance_km: number | null
  fuel_cost: number | null
  status: string
  notes: string | null
  created_at: string
  fleet_vehicles: { id: string; plate_number: string } | null
  staff: { id: string; name: string } | null
}

interface FleetVehicle {
  id: string
  plate_number: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_progress: { label: 'Зам дээр', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function TripLogsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [trips, setTrips] = useState<TripLog[]>([])
  const [vehicleList, setVehicleList] = useState<FleetVehicle[]>([])
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formVehicleId, setFormVehicleId] = useState('')
  const [formStartLocation, setFormStartLocation] = useState('')
  const [formEndLocation, setFormEndLocation] = useState('')
  const [formStartTime, setFormStartTime] = useState('')
  const [formEndTime, setFormEndTime] = useState('')
  const [formDistanceKm, setFormDistanceKm] = useState('')
  const [formFuelCost, setFormFuelCost] = useState('')
  const [formNotes, setFormNotes] = useState('')

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

        const [tripsRes, vehiclesRes] = await Promise.all([
          supabase
            .from('trip_logs')
            .select(`
              id, start_location, end_location, start_time, end_time,
              distance_km, fuel_cost, status, notes, created_at,
              fleet_vehicles(id, plate_number),
              staff(id, name)
            `)
            .eq('store_id', store.id)
            .order('start_time', { ascending: false })
            .limit(200),
          supabase
            .from('fleet_vehicles')
            .select('id, plate_number')
            .eq('store_id', store.id)
            .order('plate_number'),
        ])

        if (tripsRes.data) setTrips(tripsRes.data as unknown as TripLog[])
        if (vehiclesRes.data) setVehicleList(vehiclesRes.data as FleetVehicle[])
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    let result = trips

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(t =>
        t.start_location.toLowerCase().includes(q) ||
        t.end_location?.toLowerCase().includes(q) ||
        t.fleet_vehicles?.plate_number?.toLowerCase().includes(q) ||
        t.staff?.name?.toLowerCase().includes(q)
      )
    }

    if (statusFilter) result = result.filter(t => t.status === statusFilter)
    if (vehicleFilter) result = result.filter(t => t.fleet_vehicles?.id === vehicleFilter)

    return result
  }, [trips, search, statusFilter, vehicleFilter])

  const stats = useMemo(() => ({
    total: trips.length,
    in_progress: trips.filter(t => t.status === 'in_progress').length,
    completed: trips.filter(t => t.status === 'completed').length,
    totalDistance: trips.reduce((sum, t) => sum + (t.distance_km || 0), 0),
  }), [trips])

  async function handleCreate() {
    if (!formVehicleId || !formStartLocation.trim() || !formStartTime) return
    setCreating(true)

    try {
      const { data, error } = await supabase
        .from('trip_logs')
        .insert({
          store_id: storeId,
          vehicle_id: formVehicleId,
          start_location: formStartLocation.trim(),
          end_location: formEndLocation.trim() || null,
          start_time: formStartTime,
          end_time: formEndTime || null,
          distance_km: formDistanceKm ? Number(formDistanceKm) : null,
          fuel_cost: formFuelCost ? Number(formFuelCost) : null,
          notes: formNotes.trim() || null,
          status: formEndTime ? 'completed' : 'in_progress',
        })
        .select(`
          id, start_location, end_location, start_time, end_time,
          distance_km, fuel_cost, status, notes, created_at,
          fleet_vehicles(id, plate_number),
          staff(id, name)
        `)
        .single()

      if (error) throw error

      if (data) {
        setTrips(prev => [data as unknown as TripLog, ...prev])
        setShowCreateForm(false)
        setFormVehicleId('')
        setFormStartLocation('')
        setFormEndLocation('')
        setFormStartTime('')
        setFormEndTime('')
        setFormDistanceKm('')
        setFormFuelCost('')
        setFormNotes('')
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
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Аялалын бүртгэл</h1>
          <p className="text-slate-400 mt-1">
            Нийт {trips.length} аялал
            {filtered.length !== trips.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          + Аялал нэмэх
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт аялал</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Зам дээр</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.in_progress}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Нийт зай (км)</p>
          <p className="text-2xl font-bold text-white mt-1">
            {new Intl.NumberFormat('mn-MN').format(Math.round(stats.totalDistance))}
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
                placeholder="Байршил, тээвэр, жолооч хайх..."
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
            <option value="in_progress">Зам дээр</option>
            <option value="completed">Дууссан</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх тээвэр</option>
            {vehicleList.map(v => (
              <option key={v.id} value={v.id}>{v.plate_number}</option>
            ))}
          </select>
        </div>
        {(statusFilter || vehicleFilter) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setStatusFilter(''); setVehicleFilter('') }}
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
            <h2 className="text-xl font-bold text-white mb-4">Шинэ аялал бүртгэх</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тээврийн хэрэгсэл *</label>
                <select
                  value={formVehicleId}
                  onChange={(e) => setFormVehicleId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Сонгох...</option>
                  {vehicleList.map(v => (
                    <option key={v.id} value={v.id}>{v.plate_number}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Эхлэх байршил *</label>
                  <input
                    type="text"
                    value={formStartLocation}
                    onChange={(e) => setFormStartLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Агуулах"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Дуусах байршил</label>
                  <input
                    type="text"
                    value={formEndLocation}
                    onChange={(e) => setFormEndLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Хэрэглэгч"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Эхлэх цаг *</label>
                  <input
                    type="datetime-local"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Дуусах цаг</label>
                  <input
                    type="datetime-local"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Зай (км)</label>
                  <input
                    type="number"
                    value={formDistanceKm}
                    onChange={(e) => setFormDistanceKm(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Шатахууны зардал</label>
                  <input
                    type="number"
                    value={formFuelCost}
                    onChange={(e) => setFormFuelCost(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="5000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Нэмэлт мэдээлэл..."
                />
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
                disabled={creating || !formVehicleId || !formStartLocation.trim() || !formStartTime}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Аялал бүртгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Тээвэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Жолооч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Эхлэх</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дуусах</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Эхлэх цаг</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дуусах цаг</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зай (км)</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Шатахуун</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trip) => {
                const sc = STATUS_CONFIG[trip.status] || { label: trip.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={trip.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-mono text-sm">
                        {trip.fleet_vehicles?.plate_number || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{trip.staff?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-slate-300 text-sm truncate max-w-[140px]" title={trip.start_location}>
                        {trip.start_location}
                      </p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-slate-300 text-sm truncate max-w-[140px]" title={trip.end_location || ''}>
                        {trip.end_location || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(trip.start_time).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {trip.end_time
                          ? new Date(trip.end_time).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white">
                        {trip.distance_km != null ? trip.distance_km.toFixed(1) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300 text-sm">
                        {trip.fuel_cost != null ? formatPrice(trip.fuel_cost) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : trips.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох аялал олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setVehicleFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128668;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Аялалын бүртгэл байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Тээврийн хэрэгслийн аялалуудыг бүртгэж, шатахуун болон зайн тооцоо хөтлөөрэй
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            Эхний аялалаа бүртгэх
          </button>
        </div>
      )}
    </div>
  )
}
