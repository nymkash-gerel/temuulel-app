'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MachineType = 'washer' | 'dryer' | 'iron_press' | 'steam'
type MachineStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_order'

interface Machine {
  id: string
  name: string
  machine_type: MachineType
  status: MachineStatus
  capacity_kg: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Constants – Mongolian labels & color mappings
// ---------------------------------------------------------------------------

const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  washer: 'Угаалгын машин',
  dryer: 'Хатаагч',
  iron_press: 'Индүү',
  steam: 'Уурын',
}

const STATUS_CONFIG: Record<MachineStatus, { label: string; color: string }> = {
  available: { label: 'Чөлөөтэй', color: 'bg-green-500/20 text-green-400' },
  in_use: { label: 'Ашиглаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  maintenance: { label: 'Засварт', color: 'bg-orange-500/20 text-orange-400' },
  out_of_order: { label: 'Эвдэрсэн', color: 'bg-red-500/20 text-red-400' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MachinesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Data
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [storeId, setStoreId] = useState<string>('')

  // Filters
  const [typeFilter, setTypeFilter] = useState<MachineType | ''>('')
  const [statusFilter, setStatusFilter] = useState<MachineStatus | ''>('')

  // --------------------------------------------------
  // Data fetching
  // --------------------------------------------------

  const fetchMachines = useCallback(
    async (sid: string) => {
      let query = supabase
        .from('machines')
        .select('id, name, machine_type, status, capacity_kg, created_at, updated_at')
        .eq('store_id', sid)
        .order('created_at', { ascending: false })

      if (typeFilter) {
        query = query.eq('machine_type', typeFilter)
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data } = await query
      if (data) {
        setMachines(data as unknown as Machine[])
      }
    },
    [supabase, typeFilter, statusFilter],
  )

  // Initial auth + store resolution
  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        await fetchMachines(store.id)
      }

      setLoading(false)
    }

    init()
  }, [supabase, router, fetchMachines])

  // Re-fetch when filters change
  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await fetchMachines(storeId) }
    reload()
  }, [typeFilter, statusFilter, fetchMachines, storeId, loading])

  // --------------------------------------------------
  // Derived data
  // --------------------------------------------------

  const stats = useMemo(() => {
    const available = machines.filter((m) => m.status === 'available').length
    const inUse = machines.filter((m) => m.status === 'in_use').length
    const maintenance = machines.filter((m) => m.status === 'maintenance').length
    const outOfOrder = machines.filter((m) => m.status === 'out_of_order').length
    return { total: machines.length, available, inUse, maintenance, outOfOrder }
  }, [machines])

  const hasActiveFilters = typeFilter !== '' || statusFilter !== ''

  function clearFilters(): void {
    setTypeFilter('')
    setStatusFilter('')
  }

  // --------------------------------------------------
  // Loading state
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Машинууд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {machines.length} машин
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Чөлөөтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.available}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Ашиглаж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inUse}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Эвдэрсэн / Засварт</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.outOfOrder + stats.maintenance}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төрөл</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MachineType | '')}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="washer">Угаалгын машин</option>
              <option value="dryer">Хатаагч</option>
              <option value="iron_press">Индүү</option>
              <option value="steam">Уурын</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MachineStatus | '')}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="available">Чөлөөтэй</option>
              <option value="in_use">Ашиглаж буй</option>
              <option value="maintenance">Засварт</option>
              <option value="out_of_order">Эвдэрсэн</option>
            </select>
          </div>
          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="text-sm text-blue-400 hover:text-blue-300 transition-all pb-3"
              >
                Шүүлтүүр цэвэрлэх
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {machines.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Нэр
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Төрөл
                </th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Төлөв
                </th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Багтаамж (кг)
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Бүртгэсэн
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Шинэчилсэн
                </th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => {
                const sc =
                  STATUS_CONFIG[machine.status] ?? {
                    label: machine.status,
                    color: 'bg-slate-500/20 text-slate-400',
                  }

                return (
                  <tr
                    key={machine.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                  >
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{machine.name}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {MACHINE_TYPE_LABELS[machine.machine_type] ?? machine.machine_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}
                      >
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">
                        {machine.capacity_kg} кг
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {formatDate(machine.created_at)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {formatDate(machine.updated_at)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#129529;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Машин бүртгэгдээгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {hasActiveFilters
              ? 'Шүүлтүүрт тохирох машин олдсонгүй. Шүүлтүүрээ өөрчилж үзнэ үү.'
              : 'Угаалгын машинууд энд харагдана.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
