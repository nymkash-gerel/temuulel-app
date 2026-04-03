'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface MachinesClientProps {
  initialMachines: Machine[]
  storeId: string
}

export default function MachinesClient({ initialMachines, storeId }: MachinesClientProps) {
  const supabase = useMemo(() => createClient(), [])

  const [machines, setMachines] = useState<Machine[]>(initialMachines)
  const [typeFilter, setTypeFilter] = useState<MachineType | ''>('')
  const [statusFilter, setStatusFilter] = useState<MachineStatus | ''>('')

  const fetchMachines = useCallback(
    async () => {
      let query = supabase
        .from('machines')
        .select('id, name, machine_type, status, capacity_kg, created_at, updated_at')
        .eq('store_id', storeId)
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
    [supabase, storeId, typeFilter, statusFilter],
  )

  useEffect(() => {
    if (typeFilter || statusFilter) {
      fetchMachines()
    }
  }, [typeFilter, statusFilter, fetchMachines])

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
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
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
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төрөл</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MachineType | '')}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
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
                    className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-all"
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
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-6">
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
              className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
