'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Equipment {
  id: string
  name: string
  equipment_type: string
  serial_number: string | null
  status: string
  location: string | null
  purchase_date: string | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  created_at: string
}

interface NewEquipmentForm {
  name: string
  equipment_type: string
  serial_number: string
  status: string
  location: string
  purchase_date: string
  last_maintenance_date: string
  next_maintenance_date: string
}

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  cardio: 'Кардио',
  strength: 'Хүч чадал',
  free_weights: 'Чөлөөт жин',
  flexibility: 'Уян хатан',
  machine: 'Машин',
  accessory: 'Дагалдах хэрэгсэл',
  other: 'Бусад',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Ашиглах боломжтой', color: 'bg-green-500/20 text-green-400' },
  in_use: { label: 'Ашиглагдаж буй', color: 'bg-blue-500/20 text-blue-400' },
  maintenance: { label: 'Засвар дээр', color: 'bg-yellow-500/20 text-yellow-400' },
  out_of_order: { label: 'Эвдэрсэн', color: 'bg-red-500/20 text-red-400' },
  retired: { label: 'Хасагдсан', color: 'bg-gray-500/20 text-gray-400' },
}

export default function EquipmentPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState<NewEquipmentForm>({
    name: '',
    equipment_type: 'cardio',
    serial_number: '',
    status: 'available',
    location: '',
    purchase_date: '',
    last_maintenance_date: '',
    next_maintenance_date: '',
  })

  async function loadEquipment(sid: string) {
    let query = supabase
      .from('equipment')
      .select(`
        id, name, equipment_type, serial_number, status,
        location, purchase_date, last_maintenance_date,
        next_maintenance_date, created_at
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })

    if (typeFilter) {
      query = query.eq('equipment_type', typeFilter)
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    if (data) {
      setEquipment(data as unknown as Equipment[])
    }
  }

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
        await loadEquipment(store.id)
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storeId || loading) return
    loadEquipment(storeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter])

  const filtered = useMemo(() => {
    if (!search.trim()) return equipment
    const q = search.trim().toLowerCase()
    return equipment.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.serial_number?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q)
    )
  }, [equipment, search])

  const stats = useMemo(() => {
    const total = equipment.length
    const available = equipment.filter(e => e.status === 'available').length
    const inMaintenance = equipment.filter(e => e.status === 'maintenance').length
    const outOfOrder = equipment.filter(e => e.status === 'out_of_order').length
    return { total, available, inMaintenance, outOfOrder }
  }, [equipment])

  function startEdit(eq: Equipment) {
    setEditingId(eq.id)
    setForm({
      name: eq.name,
      equipment_type: eq.equipment_type,
      serial_number: eq.serial_number || '',
      status: eq.status,
      location: eq.location || '',
      purchase_date: eq.purchase_date || '',
      last_maintenance_date: eq.last_maintenance_date || '',
      next_maintenance_date: eq.next_maintenance_date || '',
    })
    setShowForm(true)
    setError('')
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      name: '',
      equipment_type: 'cardio',
      serial_number: '',
      status: 'available',
      location: '',
      purchase_date: '',
      last_maintenance_date: '',
      next_maintenance_date: '',
    })
    setShowForm(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: form.name,
        equipment_type: form.equipment_type,
        serial_number: form.serial_number || null,
        status: form.status,
        location: form.location || null,
        purchase_date: form.purchase_date || null,
        last_maintenance_date: form.last_maintenance_date || null,
        next_maintenance_date: form.next_maintenance_date || null,
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('equipment')
          .update(payload)
          .eq('id', editingId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('equipment')
          .insert({ ...payload, store_id: storeId })

        if (insertError) throw insertError
      }

      await loadEquipment(storeId)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-bold text-white">Тоног төхөөрөмж</h1>
          <p className="text-gray-400 mt-1">
            Нийт {equipment.length} төхөөрөмж
            {filtered.length !== equipment.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/equipment/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Шинэ төхөөрөмж
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Нийт төхөөрөмж</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Ашиглах боломжтой</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.available}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Засвар дээр</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inMaintenance}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Эвдэрсэн</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.outOfOrder}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Нэр, серийн дугаар, байршлаар хайх..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="cardio">Кардио</option>
              <option value="strength">Хүч чадал</option>
              <option value="free_weights">Чөлөөт жин</option>
              <option value="flexibility">Уян хатан</option>
              <option value="machine">Машин</option>
              <option value="accessory">Дагалдах хэрэгсэл</option>
              <option value="other">Бусад</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="available">Ашиглах боломжтой</option>
              <option value="in_use">Ашиглагдаж буй</option>
              <option value="maintenance">Засвар дээр</option>
              <option value="out_of_order">Эвдэрсэн</option>
              <option value="retired">Хасагдсан</option>
            </select>
          </div>
        </div>
        {(typeFilter || statusFilter || search) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setTypeFilter(''); setStatusFilter(''); setSearch('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Төхөөрөмж засах' : 'Шинэ төхөөрөмж нэмэх'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Нэр *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Жишээ: Гүйдэг зам Technogym"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Төрөл *</label>
                  <select
                    value={form.equipment_type}
                    onChange={(e) => setForm({ ...form, equipment_type: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="cardio">Кардио</option>
                    <option value="strength">Хүч чадал</option>
                    <option value="free_weights">Чөлөөт жин</option>
                    <option value="flexibility">Уян хатан</option>
                    <option value="machine">Машин</option>
                    <option value="accessory">Дагалдах хэрэгсэл</option>
                    <option value="other">Бусад</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Төлөв *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="available">Ашиглах боломжтой</option>
                    <option value="in_use">Ашиглагдаж буй</option>
                    <option value="maintenance">Засвар дээр</option>
                    <option value="out_of_order">Эвдэрсэн</option>
                    <option value="retired">Хасагдсан</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Серийн дугаар</label>
                  <input
                    type="text"
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                    placeholder="SN-12345"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Байршил</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="1-р давхар, Кардио зал"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Худалдан авсан огноо</label>
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Сүүлийн засвар</label>
                  <input
                    type="date"
                    value={form.last_maintenance_date}
                    onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Дараагийн засвар</label>
                  <input
                    type="date"
                    value={form.next_maintenance_date}
                    onChange={(e) => setForm({ ...form, next_maintenance_date: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
                >
                  {saving ? 'Хадгалж байна...' : editingId ? 'Шинэчлэх' : 'Нэмэх'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Серийн дугаар</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Байршил</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Худалдан авсан</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Дараагийн засвар</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((eq) => {
                const sc = STATUS_CONFIG[eq.status] || { label: eq.status, color: 'bg-gray-500/20 text-gray-400' }
                return (
                  <tr key={eq.id} onClick={() => router.push(`/dashboard/equipment/${eq.id}`)} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all cursor-pointer">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{eq.name}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-300 text-sm">
                        {EQUIPMENT_TYPE_LABELS[eq.equipment_type] || eq.equipment_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-400 font-mono text-sm">{eq.serial_number || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-300 text-sm">{eq.location || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-400 text-sm">
                        {eq.purchase_date ? new Date(eq.purchase_date).toLocaleDateString('mn-MN') : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {eq.next_maintenance_date ? (
                        <span className={`text-sm ${
                          new Date(eq.next_maintenance_date) < new Date()
                            ? 'text-red-400 font-medium'
                            : 'text-gray-400'
                        }`}>
                          {new Date(eq.next_maintenance_date).toLocaleDateString('mn-MN')}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <button
                        onClick={() => startEdit(eq)}
                        className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                      >
                        Засах
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : equipment.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-400">Хайлтад тохирох төхөөрөмж олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#9881;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Төхөөрөмж бүртгэгдээгүй байна</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Тоног төхөөрөмжөө бүртгэж, засвар үйлчилгээг хянана уу
          </p>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Эхний төхөөрөмж нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
