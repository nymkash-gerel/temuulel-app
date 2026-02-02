'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  name: string
}

interface Vehicle {
  id: string
  plate_number: string
  make: string | null
  model: string | null
  color: string | null
  vehicle_type: string | null
  notes: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
  customers: Customer | null
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: 'Седан',
  suv: 'SUV',
  truck: 'Ачааны',
  van: 'Микро автобус',
  motorcycle: 'Мотоцикл',
}

export default function VehiclesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState<boolean>(true)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [search, setSearch] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('vehicles')
        .select(`
          id, plate_number, make, model, color, vehicle_type, notes,
          customer_id, created_at, updated_at,
          customers(id, name)
        `)
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (data) {
        setVehicles(data as unknown as Vehicle[])
      }

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return vehicles

    const q = search.trim().toLowerCase()
    return vehicles.filter((v) =>
      v.plate_number.toLowerCase().includes(q)
    )
  }, [vehicles, search])

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <div className="h-8 w-64 bg-slate-700/50 rounded-lg animate-pulse" />
          <div className="h-4 w-40 bg-slate-700/30 rounded mt-2 animate-pulse" />
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
          <div className="h-12 bg-slate-700/30 rounded-xl animate-pulse" />
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4">
            <div className="flex gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 w-24 bg-slate-700/30 rounded animate-pulse" />
              ))}
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-slate-700/50 px-6 py-4">
              <div className="flex gap-6">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-4 w-20 bg-slate-700/20 rounded animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
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
      </div>

      {/* Search */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Улсын дугаараар хайх..."
            className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Улсын дугаар
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Марк
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Загвар
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Өнгө
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Төрөл
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                  Эзэмшигч
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                >
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium font-mono">
                      {v.plate_number}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">{v.make || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">{v.model || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">{v.color || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">
                      {v.vehicle_type
                        ? VEHICLE_TYPE_LABELS[v.vehicle_type] || v.vehicle_type
                        : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">
                      {v.customers?.name || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : vehicles.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">
            Хайлтад тохирох тээврийн хэрэгсэл олдсонгүй
          </p>
          <button
            onClick={() => setSearch('')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Хайлт цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 17h8M8 17v-4m8 4v-4m-8 0h8m-8 0V9a1 1 0 011-1h6a1 1 0 011 1v4M6 21h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Тээврийн хэрэгсэл байхгүй
          </h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Бүртгэгдсэн тээврийн хэрэгсэл одоогоор алга байна.
          </p>
        </div>
      )}
    </div>
  )
}
