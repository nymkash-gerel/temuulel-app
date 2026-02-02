'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  name: string | null
  email: string | null
}

interface Staff {
  id: string
  name: string
}

const sessionTypes = [
  { value: 'portrait', label: 'Хөрөг' },
  { value: 'wedding', label: 'Хуримын' },
  { value: 'event', label: 'Арга хэмжээ' },
  { value: 'product', label: 'Бүтээгдэхүүн' },
  { value: 'family', label: 'Гэр бүл' },
  { value: 'maternity', label: 'Жирэмсний' },
  { value: 'newborn', label: 'Нярай' },
  { value: 'corporate', label: 'Байгууллагын' },
  { value: 'other', label: 'Бусад' },
]

const durationPresets = [
  { value: 30, label: '30мин' },
  { value: 60, label: '1цаг' },
  { value: 90, label: '1.5цаг' },
  { value: 120, label: '2цаг' },
  { value: 180, label: '3цаг' },
  { value: 240, label: '4цаг' },
  { value: 360, label: '6цаг' },
  { value: 480, label: '8цаг' },
]

export default function NewPhotoSessionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Dropdown data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Staff[]>([])

  // Form fields
  const [customerId, setCustomerId] = useState('')
  const [photographerId, setPhotographerId] = useState('')
  const [sessionType, setSessionType] = useState('')
  const [location, setLocation] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [totalAmount, setTotalAmount] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) return

      const [customersRes, staffRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, email')
          .eq('store_id', store.id)
          .order('name'),
        supabase
          .from('staff')
          .select('id, name')
          .eq('store_id', store.id)
          .order('name'),
      ])

      if (customersRes.data) setCustomers(customersRes.data)
      if (staffRes.data) setStaff(staffRes.data)
    }
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: parseInt(durationMinutes) || 60,
      }

      if (customerId) body.customer_id = customerId
      if (photographerId) body.photographer_id = photographerId
      if (sessionType) body.session_type = sessionType
      if (location) body.location = location
      if (totalAmount) body.total_amount = parseFloat(totalAmount)
      if (depositAmount) body.deposit_amount = parseFloat(depositAmount)
      if (notes) body.notes = notes

      const res = await fetch('/api/photo-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Зураг авалт үүсгэхэд алдаа гарлаа')
      }

      router.push('/dashboard/photo-sessions')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Зураг авалт үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/photo-sessions"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ зураг авалт</h1>
          <p className="text-slate-400 mt-1">Шинэ зураг авалт бүртгэх</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үндсэн мэдээлэл</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Хэрэглэгч
                    </label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Сонгоно уу</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.email ? ` (${c.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Гэрэл зурагчин
                    </label>
                    <select
                      value={photographerId}
                      onChange={(e) => setPhotographerId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Сонгоно уу</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Зураг авалтын төрөл
                  </label>
                  <select
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Сонгоно уу</option>
                    {sessionTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Товлосон цаг *
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Хугацаа (минут)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {durationPresets.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setDurationMinutes(String(preset.value))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            durationMinutes === String(preset.value)
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Байршил</h2>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Байршил
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Зураг авалтын байршил..."
                />
              </div>
            </div>

            {/* Notes */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Тэмдэглэл</h2>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Зураг авалтын тэмдэглэл, нэмэлт мэдээлэл..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Төлбөр</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Нийт дүн (₮)
                  </label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="any"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Урьдчилгаа (₮)
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="any"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || !scheduledAt}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Хадгалж байна...' : 'Зураг авалт үүсгэх'}
              </button>
              <Link
                href="/dashboard/photo-sessions"
                className="block w-full py-3 text-center bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
