'use client'

import { useEffect, useState } from 'react'
import React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Pet {
  id: string
  name: string
  species: string | null
  breed: string | null
  weight: number | null
  date_of_birth: string | null
  medical_notes: string | null
  vaccinations: unknown
  is_active: boolean
  created_at: string
  updated_at: string
  customers: { id: string; name: string } | null
}

interface PetAppointment {
  id: string
  pet_id: string
  customer_id: string
  service_type: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Товлосон', color: 'bg-blue-500/20 text-blue-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-cyan-500/20 text-cyan-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const SPECIES_LABELS: Record<string, string> = {
  dog: 'Нохой',
  cat: 'Муур',
  bird: 'Шувуу',
  rabbit: 'Туулай',
  hamster: 'Хамстер',
  fish: 'Загас',
  reptile: 'Мөлхөгч',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PetDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [pet, setPet] = useState<Pet | null>(null)
  const [appointments, setAppointments] = useState<PetAppointment[]>([])

  useEffect(() => {
    loadPet()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPet() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { setLoading(false); return }

    const { data: petData } = await supabase
      .from('pets')
      .select(`
        id, name, species, breed, weight, date_of_birth, medical_notes,
        vaccinations, is_active, created_at, updated_at,
        customers(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    const loadedPet = petData as unknown as Pet
    setPet(loadedPet)

    if (loadedPet) {
      const { data: appointmentsData } = await supabase
        .from('pet_appointments')
        .select(`
          id, pet_id, customer_id, service_type, scheduled_at,
          duration_minutes, status, notes, created_at
        `)
        .eq('pet_id', loadedPet.id)
        .order('scheduled_at', { ascending: false })

      setAppointments((appointmentsData as unknown as PetAppointment[]) || [])
    }

    setLoading(false)
  }

  function renderVaccinations(): React.ReactNode {
    if (!pet?.vaccinations) {
      return <p className="text-slate-500 text-sm">Вакцины мэдээлэл байхгүй</p>
    }

    const vacc = pet.vaccinations

    if (Array.isArray(vacc)) {
      if (vacc.length === 0) {
        return <p className="text-slate-500 text-sm">Вакцины мэдээлэл байхгүй</p>
      }
      return (
        <div className="flex flex-wrap gap-2">
          {vacc.map((item: unknown, idx: number) => {
            const label = typeof item === 'string'
              ? item
              : typeof item === 'object' && item !== null && 'name' in item
                ? String((item as Record<string, unknown>).name)
                : JSON.stringify(item)
            return (
              <span
                key={idx}
                className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium"
              >
                {label}
              </span>
            )
          })}
        </div>
      )
    }

    if (typeof vacc === 'object' && vacc !== null) {
      const entries = Object.entries(vacc as Record<string, unknown>)
      if (entries.length === 0) {
        return <p className="text-slate-500 text-sm">Вакцины мэдээлэл байхгүй</p>
      }
      return (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                {key}
              </span>
              <span className="text-slate-400 text-xs">{String(value)}</span>
            </div>
          ))}
        </div>
      )
    }

    return <p className="text-slate-300 text-sm">{String(vacc)}</p>
  }

  function renderInfoRow(label: string, value: React.ReactNode): React.ReactNode {
    return (
      <div>
        <span className="text-sm text-slate-400">{label}</span>
        <div className="text-white mt-0.5">{value}</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-64 bg-slate-700 rounded" />
        </div>
      </div>
    )
  }

  if (!pet) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Тэжээвэр амьтан олдсонгүй.</p>
        <button
          onClick={() => router.push('/dashboard/pets')}
          className="mt-4 text-blue-400 hover:underline"
        >
          Буцах
        </button>
      </div>
    )
  }

  const speciesLabel = pet.species ? (SPECIES_LABELS[pet.species] || pet.species) : 'Тодорхойгүй'

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/pets')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          &larr; Буцах
        </button>
        <h1 className="text-2xl font-bold text-white">Тэжээвэр амьтны мэдээлэл</h1>
        {pet.is_active ? (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            Идэвхтэй
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
            Идэвхгүй
          </span>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Pet Info Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Ерөнхий мэдээлэл</h2>
          <div className="space-y-3">
            {renderInfoRow('Нэр', pet.name)}
            {renderInfoRow('Зүйл', speciesLabel)}
            {renderInfoRow('Үүлдэр', pet.breed || 'Тодорхойгүй')}
            {renderInfoRow('Жин', pet.weight != null ? `${pet.weight} кг` : 'Тодорхойгүй')}
            {renderInfoRow(
              'Төрсөн огноо',
              pet.date_of_birth ? formatDate(pet.date_of_birth) : 'Тодорхойгүй'
            )}
            {renderInfoRow(
              'Төлөв',
              pet.is_active ? (
                <span className="text-green-400">Идэвхтэй</span>
              ) : (
                <span className="text-slate-400">Идэвхгүй</span>
              )
            )}
          </div>
        </div>

        {/* Owner Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Эзэмшигч</h2>
          {pet.customers ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {pet.customers.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{pet.customers.name}</p>
                <p className="text-slate-400 text-sm">Харилцагч</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Эзэмшигч тодорхойгүй</p>
          )}
        </div>

        {/* Medical Notes Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Эмнэлгийн тэмдэглэл</h2>
          {pet.medical_notes ? (
            <p className="text-slate-300 whitespace-pre-wrap text-sm">{pet.medical_notes}</p>
          ) : (
            <p className="text-slate-500 text-sm">Тэмдэглэл байхгүй</p>
          )}
        </div>

        {/* Vaccinations Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Вакцин</h2>
          {renderVaccinations()}
        </div>
      </div>

      {/* Appointments Section */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Цаг захиалга
          <span className="ml-2 text-sm text-slate-400 font-normal">({appointments.length})</span>
        </h2>

        {appointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-3 px-2 font-medium">Үйлчилгээ</th>
                  <th className="text-left py-3 px-2 font-medium">Товлосон огноо</th>
                  <th className="text-left py-3 px-2 font-medium">Хугацаа</th>
                  <th className="text-left py-3 px-2 font-medium">Төлөв</th>
                  <th className="text-left py-3 px-2 font-medium">Тэмдэглэл</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const statusCfg = STATUS_CONFIG[appt.status] || {
                    label: appt.status,
                    color: 'bg-slate-500/20 text-slate-400',
                  }
                  return (
                    <tr key={appt.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-3 px-2 text-white">{appt.service_type}</td>
                      <td className="py-3 px-2 text-slate-300">
                        {formatDateTime(appt.scheduled_at)}
                      </td>
                      <td className="py-3 px-2 text-slate-300">{appt.duration_minutes} мин</td>
                      <td className="py-3 px-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-400 max-w-xs truncate">
                        {appt.notes || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Цаг захиалга байхгүй</p>
        )}
      </div>

      {/* Meta */}
      <div className="mt-6 text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(pet.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(pet.updated_at)}</span>
      </div>
    </div>
  )
}
