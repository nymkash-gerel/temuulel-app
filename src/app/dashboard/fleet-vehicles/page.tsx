'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface FleetVehicle {
  id: string
  plate_number: string
  vehicle_type: string
  brand: string | null
  model: string | null
  year: number | null
  status: string
  mileage: number | null
  insurance_expiry: string | null
  notes: string | null
  created_at: string
  staff: { id: string; name: string } | null
}

interface StaffMember {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Чөлөөтэй', color: 'bg-green-500/20 text-green-400' },
  in_use: { label: 'Ашиглагдаж буй', color: 'bg-blue-500/20 text-blue-400' },
  maintenance: { label: 'Засварт', color: 'bg-orange-500/20 text-orange-400' },
  retired: { label: 'Ашиглалтаас гарсан', color: 'bg-slate-500/20 text-slate-400' },
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: 'Суудлын',
  suv: 'Жийп',
  van: 'Микро автобус',
  truck: 'Ачааны',
  motorcycle: 'Мотоцикл',
  bicycle: 'Дугуй',
  other: 'Бусад',
}

export default function FleetVehiclesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formPlate, setFormPlate] = useState('')
  const [formVehicleType, setFormVehicleType] = useState('sedan')
  const [formBrand, setFormBrand] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formYear, setFormYear] = useState('')
  const [formMileage, setFormMileage] = useState('')
  const [formInsuranceExpiry, setFormInsuranceExpiry] = useState('')
  const [formDriverId, setFormDriverId] = useState('')
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

        const results: any = await Promise.all([
          supabase
            .from('fleet_vehicles')
            .select(`
              id, plate_number, vehicle_type, brand, model, year,
              status, mileage, insurance_expiry, notes, created_at,
              staff(id, name)
            `)
            .eq('store_id', store.id)
            .order('created_at', { ascending: false })
            .limit(200),
          // @ts-expect-error - Deep type instantiation
          supabase
            .from('staff')
            .select('id, name')
            .eq('store_id', store.id)
            .eq('is_active', true)
            .order('name'),
        ])

        const [vehiclesRes, staffRes] = results
        if (vehiclesRes.data) setVehicles(vehiclesRes.data as unknown as FleetVehicle[])
        if (staffRes.data) setStaffList(staffRes.data as StaffMember[])
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    let result = vehicles

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(v =>
        v.plate_number.toLowerCase().includes(q) ||
        v.brand?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q) ||
        v.staff?.name?.toLowerCase().includes(q)
      )
    }

    if (statusFilter) result = result.filter(v => v.status === statusFilter)
    if (vehicleTypeFilter) result = result.filter(v => v.vehicle_type === vehicleTypeFilter)

    return result
  }, [vehicles, search, statusFilter, vehicleTypeFilter])

  const stats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'available').length,
    in_use: vehicles.filter(v => v.status === 'in_use').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  }), [vehicles])

  async function handleCreate() {
    if (!formPlate.trim()) return
    setCreating(true)

    try {
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .insert({
          store_id: storeId,
          plate_number: formPlate.trim().toUpperCase(),
          vehicle_type: formVehicleType,
          brand: formBrand.trim() || null,
          model: formModel.trim() || null,
          year: formYear ? Number(formYear) : null,
          mileage: formMileage ? Number(formMileage) : null,
          insurance_expiry: formInsuranceExpiry || null,
          driver_id: formDriverId || null,
          notes: formNotes.trim() || null,
          status: 'available',
        })
        .select(`
          id, plate_number, vehicle_type, brand, model, year,
          status, mileage, insurance_expiry, notes, created_at,
          staff(id, name)
        `)
        .single()

      if (error) throw error

      if (data) {
        setVehicles(prev => [data as unknown as FleetVehicle, ...prev])
        setShowCreateForm(false)
        setFormPlate('')
        setFormVehicleType('sedan')
        setFormBrand('')
        setFormModel('')
        setFormYear('')
        setFormMileage('')
        setFormInsuranceExpiry('')
        setFormDriverId('')
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
          <h1 className="text-2xl font-bold text-white">Тээврийн хэрэгсэл</h1>
          <p className="text-slate-400 mt-1">
            Нийт {vehicles.length} тээврийн хэрэгсэл
            {filtered.length !== vehicles.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          + Тээврийн хэрэгсэл нэмэх
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Чөлөөтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.available}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Ашиглагдаж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.in_use}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-orange-400 text-sm">Засварт</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.maintenance}</p>
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
                placeholder="Улсын дугаар, марк, загвар, жолооч хайх..."
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
            <option value="in_use">Ашиглагдаж буй</option>
            <option value="maintenance">Засварт</option>
            <option value="retired">Ашиглалтаас гарсан</option>
          </select>
          <select
            value={vehicleTypeFilter}
            onChange={(e) => setVehicleTypeFilter(e.target.value)}
            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төрөл</option>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {(statusFilter || vehicleTypeFilter) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setStatusFilter(''); setVehicleTypeFilter('') }}
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
            <h2 className="text-xl font-bold text-white mb-4">Шинэ тээврийн хэрэгсэл</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Улсын дугаар *</label>
                  <input
                    type="text"
                    value={formPlate}
                    onChange={(e) => setFormPlate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="1234 УНА"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Төрөл</label>
                  <select
                    value={formVehicleType}
                    onChange={(e) => setFormVehicleType(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Марк</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Загвар</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Prius"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Он</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="2022"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Гүйлт (км)</label>
                  <input
                    type="number"
                    value={formMileage}
                    onChange={(e) => setFormMileage(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="50000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Даатгал дуусах</label>
                  <input
                    type="date"
                    value={formInsuranceExpiry}
                    onChange={(e) => setFormInsuranceExpiry(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Жолооч</label>
                  <select
                    value={formDriverId}
                    onChange={(e) => setFormDriverId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Сонгоогүй</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
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
                disabled={creating || !formPlate.trim()}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Тээвэр нэмэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Улсын дугаар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Марк / Загвар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Он</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Гүйлт (км)</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Даатгал дуусах</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Жолооч</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const sc = STATUS_CONFIG[v.status] || { label: v.status, color: 'bg-slate-500/20 text-slate-400' }
                const isInsuranceExpiring = v.insurance_expiry && new Date(v.insurance_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                return (
                  <tr key={v.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium font-mono">{v.plate_number}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {VEHICLE_TYPE_LABELS[v.vehicle_type] || v.vehicle_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">
                        {[v.brand, v.model].filter(Boolean).join(' ') || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{v.year || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">
                        {v.mileage != null ? new Intl.NumberFormat('mn-MN').format(v.mileage) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {v.insurance_expiry ? (
                        <span className={`text-sm ${isInsuranceExpiring ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                          {new Date(v.insurance_expiry).toLocaleDateString('mn-MN')}
                          {isInsuranceExpiring && ' !'}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{v.staff?.name || '-'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : vehicles.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох тээврийн хэрэгсэл олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setVehicleTypeFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128663;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Тээврийн хэрэгсэл байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Флотын тээврийн хэрэгслүүдээ бүртгэж эхлээрэй
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            Эхний тээврээ нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
