'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Unit {
  id: string
  unit_number: string
}

interface Guest {
  id: string
  first_name: string | null
  last_name: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Шууд',
  website: 'Вэбсайт',
  booking_com: 'Booking.com',
  airbnb: 'Airbnb',
  expedia: 'Expedia',
  other: 'Бусад',
}

export default function NewReservationPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Dropdown data
  const [units, setUnits] = useState<Unit[]>([])
  const [guests, setGuests] = useState<Guest[]>([])

  // Form fields
  const [unitId, setUnitId] = useState('')
  const [guestId, setGuestId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adults, setAdults] = useState('1')
  const [children, setChildren] = useState('0')
  const [ratePerNight, setRatePerNight] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [source, setSource] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

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

      const [unitsRes, guestsRes] = await Promise.all([
        supabase
          .from('units')
          .select('id, unit_number')
          .eq('store_id', store.id)
          .order('unit_number'),
        supabase
          .from('guests')
          .select('id, first_name, last_name')
          .eq('store_id', store.id)
          .order('first_name'),
      ])

      if (unitsRes.data) setUnits(unitsRes.data)
      if (guestsRes.data) setGuests(guestsRes.data)
    }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-calculate total_amount when check_in, check_out, or rate_per_night changes
  useEffect(() => {
    if (checkIn && checkOut && ratePerNight) {
      const start = new Date(checkIn)
      const end = new Date(checkOut)
      const diffTime = end.getTime() - start.getTime()
      const nights = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
      const total = nights * parseFloat(ratePerNight)
      setTotalAmount(total > 0 ? String(total) : '')
    } else {
      setTotalAmount('')
    }
  }, [checkIn, checkOut, ratePerNight])

  const getNights = (): number => {
    if (!checkIn || !checkOut) return 0
    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const diffTime = end.getTime() - start.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        unit_id: unitId,
        guest_id: guestId,
        check_in: checkIn,
        check_out: checkOut,
        rate_per_night: parseFloat(ratePerNight),
        total_amount: parseFloat(totalAmount),
      }

      if (adults) body.adults = parseInt(adults) || 1
      if (children) body.children = parseInt(children) || 0
      if (depositAmount) body.deposit_amount = parseFloat(depositAmount)
      if (source) body.source = source
      if (specialRequests) body.special_requests = specialRequests

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Захиалга үүсгэхэд алдаа гарлаа')
      }

      router.push('/dashboard/reservations')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Захиалга үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/reservations"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ захиалга</h1>
          <p className="text-slate-400 mt-1">Шинэ захиалга бүртгэх</p>
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
                      Өрөө *
                    </label>
                    <select
                      value={unitId}
                      onChange={(e) => setUnitId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Сонгоно уу</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unit_number}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Зочин *
                    </label>
                    <select
                      value={guestId}
                      onChange={(e) => setGuestId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Сонгоно уу</option>
                      {guests.map((guest) => (
                        <option key={guest.id} value={guest.id}>
                          {guest.first_name} {guest.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Ирэх *
                    </label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Явах *
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Том хүн
                    </label>
                    <input
                      type="number"
                      value={adults}
                      onChange={(e) => setAdults(e.target.value)}
                      min="1"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Хүүхэд
                    </label>
                    <input
                      type="number"
                      value={children}
                      onChange={(e) => setChildren(e.target.value)}
                      min="0"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Эх сурвалж
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Сонгоно уу</option>
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Тусгай хүсэлт</h2>

              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Тусгай хүсэлт, нэмэлт мэдээлэл..."
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
                    Нэг шөнийн үнэ (₮) *
                  </label>
                  <input
                    type="number"
                    value={ratePerNight}
                    onChange={(e) => setRatePerNight(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="any"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Нийт дүн (₮) *
                  </label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="any"
                    required
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

            {/* Summary */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Захиалгын хураангуй</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Хоног</span>
                  <span className="text-white">{getNights()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Нэг шөнийн үнэ</span>
                  <span className="text-white">
                    {ratePerNight
                      ? `${new Intl.NumberFormat('mn-MN').format(parseFloat(ratePerNight))}₮`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-700">
                  <span className="text-slate-400">Нийт дүн</span>
                  <span className="text-white font-medium">
                    {totalAmount
                      ? `${new Intl.NumberFormat('mn-MN').format(parseFloat(totalAmount))}₮`
                      : '-'}
                  </span>
                </div>
                {depositAmount && parseFloat(depositAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Урьдчилгаа</span>
                    <span className="text-green-400">
                      {new Intl.NumberFormat('mn-MN').format(parseFloat(depositAmount))}₮
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || !unitId || !guestId || !checkIn || !checkOut || !ratePerNight || !totalAmount}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Хадгалж байна...' : 'Захиалга үүсгэх'}
              </button>
              <Link
                href="/dashboard/reservations"
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
