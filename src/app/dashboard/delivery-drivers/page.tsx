'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Driver {
  id: string
  name: string
  phone: string
  email: string | null
  vehicle_type: 'motorcycle' | 'car' | 'bicycle' | 'on_foot'
  vehicle_number: string | null
  status: 'active' | 'inactive' | 'on_delivery'
  user_id: string | null
  telegram_chat_id: number | null
  telegram_linked_at: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  inactive: { label: 'Идэвхгүй', color: 'bg-slate-500/20 text-slate-400' },
  on_delivery: { label: 'Хүргэлтэнд', color: 'bg-blue-500/20 text-blue-400' },
}

const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: 'Мотоцикл',
  car: 'Машин',
  bicycle: 'Дугуй',
  on_foot: 'Явган',
}

export default function DeliveryDriversPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formVehicle, setFormVehicle] = useState<string>('motorcycle')
  const [formVehicleNumber, setFormVehicleNumber] = useState('')
  const [formStatus, setFormStatus] = useState<string>('active')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedTgId, setCopiedTgId] = useState<string | null>(null)

  const BOT_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '').trim()

  function copyTelegramInvite(driver: Driver) {
    if (!BOT_USERNAME) {
      alert('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME тохируулаагүй байна.\nVercel → Environment Variables-д нэмнэ үү.')
      return
    }
    const link = `https://t.me/${BOT_USERNAME}?start=${driver.id}`
    navigator.clipboard.writeText(link)
    setCopiedTgId(driver.id)
    setTimeout(() => setCopiedTgId(null), 2000)
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
        const { data } = await supabase
          .from('delivery_drivers')
          .select('*')
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })

        if (data) setDrivers(data as unknown as Driver[])
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = drivers
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        d.email?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) result = result.filter(d => d.status === statusFilter)
    return result
  }, [drivers, search, statusFilter])

  function resetForm() {
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormVehicle('motorcycle')
    setFormVehicleNumber('')
    setFormStatus('active')
    setEditingDriver(null)
    setShowForm(false)
  }

  function openEdit(driver: Driver) {
    setFormName(driver.name)
    setFormPhone(driver.phone)
    setFormEmail(driver.email || '')
    setFormVehicle(driver.vehicle_type)
    setFormVehicleNumber(driver.vehicle_number || '')
    setFormStatus(driver.status)
    setEditingDriver(driver)
    setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formPhone.trim()) return
    setSaving(true)

    const payload = {
      name: formName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim() || undefined,
      vehicle_type: formVehicle,
      vehicle_number: formVehicleNumber.trim() || undefined,
      status: formStatus,
    }

    try {
      if (editingDriver) {
        const res = await fetch(`/api/delivery-drivers/${editingDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const { driver } = await res.json()
          setDrivers(prev => prev.map(d => d.id === editingDriver.id ? driver : d))
          resetForm()
        }
      } else {
        const res = await fetch('/api/delivery-drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const { driver } = await res.json()
          setDrivers(prev => [driver, ...prev])
          resetForm()
        } else {
          const err = await res.json()
          alert(err.error || 'Error')
        }
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Жолоочийг устгахдаа итгэлтэй байна уу?')) return
    const res = await fetch(`/api/delivery-drivers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDrivers(prev => prev.filter(d => d.id !== id))
    } else {
      const err = await res.json()
      alert(err.error || 'Error')
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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Жолоочууд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {drivers.length} жолооч
            {filtered.length !== drivers.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
        >
          + Жолооч нэмэх
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">
            {drivers.filter(d => d.status === 'active').length}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Хүргэлтэнд</p>
          <p className="text-2xl font-bold text-white mt-1">
            {drivers.filter(d => d.status === 'on_delivery').length}
          </p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Идэвхгүй</p>
          <p className="text-2xl font-bold text-white mt-1">
            {drivers.filter(d => d.status === 'inactive').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Жолоочийн нэр, утас хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төлөв</option>
            <option value="active">Идэвхтэй</option>
            <option value="on_delivery">Хүргэлтэнд</option>
            <option value="inactive">Идэвхгүй</option>
          </select>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">
              {editingDriver ? 'Жолооч засах' : 'Шинэ жолооч'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Нэр *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Болд"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Утас *</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="99001122"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">И-мэйл</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="bold@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Тээврийн хэрэгсэл</label>
                  <select
                    value={formVehicle}
                    onChange={(e) => setFormVehicle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="motorcycle">Мотоцикл</option>
                    <option value="car">Машин</option>
                    <option value="bicycle">Дугуй</option>
                    <option value="on_foot">Явган</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Улсын дугаар</label>
                  <input
                    type="text"
                    value={formVehicleNumber}
                    onChange={(e) => setFormVehicleNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="1234 УБА"
                  />
                </div>
              </div>
              {editingDriver && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Төлөв</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="active">Идэвхтэй</option>
                    <option value="inactive">Идэвхгүй</option>
                    <option value="on_delivery">Хүргэлтэнд</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => resetForm()}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formPhone.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? 'Хадгалж байна...' : editingDriver ? 'Хадгалах' : 'Нэмэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drivers List */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((driver) => {
            const sc = STATUS_CONFIG[driver.status] || STATUS_CONFIG.active
            return (
              <div key={driver.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                      <span className="text-xl">
                        {driver.vehicle_type === 'motorcycle' ? '🏍️' :
                         driver.vehicle_type === 'car' ? '🚗' :
                         driver.vehicle_type === 'bicycle' ? '🚲' : '🚶'}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{driver.name}</p>
                      <p className="text-slate-400 text-sm">{driver.phone}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                    {sc.label}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm mb-4">
                  {driver.email && (
                    <p className="text-slate-400">{driver.email}</p>
                  )}
                  <p className="text-slate-400">
                    {VEHICLE_LABELS[driver.vehicle_type]}
                    {driver.vehicle_number && ` — ${driver.vehicle_number}`}
                  </p>
                  <p className="text-slate-500 text-xs">
                    Нэмсэн: {new Date(driver.created_at).toLocaleDateString('mn-MN')}
                  </p>
                  {driver.user_id ? (
                    <p className="text-green-400 text-xs font-medium">Бүртгэлтэй</p>
                  ) : (
                    <p className="text-yellow-400 text-xs font-medium">Бүртгэлгүй</p>
                  )}
                  {/* Telegram status */}
                  {driver.telegram_chat_id ? (
                    <p className="text-[#29B6F6] text-xs font-medium flex items-center gap-1">
                      ✈️ Telegram холбогдсон
                    </p>
                  ) : (
                    <p className="text-slate-500 text-xs">Telegram холбогдоогүй</p>
                  )}
                </div>

                {/* Telegram invite link button */}
                {!driver.telegram_chat_id && (
                  <button
                    onClick={() => copyTelegramInvite(driver)}
                    className="w-full mb-2 px-3 py-2 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#29B6F6] text-sm rounded-lg transition-all border border-[#229ED9]/20 flex items-center justify-center gap-2"
                  >
                    {copiedTgId === driver.id ? '✅ Хуулагдлаа!' : '✈️ Telegram холбох линк'}
                  </button>
                )}

                {!driver.user_id && storeId && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/driver/register?store=${storeId}&phone=${driver.phone}`
                      navigator.clipboard.writeText(url)
                      setCopiedId(driver.id)
                      setTimeout(() => setCopiedId(null), 2000)
                    }}
                    className="w-full mb-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm rounded-lg transition-all border border-blue-500/20"
                  >
                    {copiedId === driver.id ? 'Хуулагдлаа!' : 'Бүртгэлийн линк хуулах'}
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(driver)}
                    className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-all"
                  >
                    Засах
                  </button>
                  <button
                    onClick={() => handleDelete(driver.id)}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-all"
                  >
                    Устгах
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : drivers.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох жолооч олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚚</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Жолооч байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Хүргэлтийн жолоочоо нэмээд хүргэлтийг хянаарай
          </p>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Эхний жолоочоо нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
