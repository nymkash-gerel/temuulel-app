'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewUnitPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState('')

  const [unitNumber, setUnitNumber] = useState('')
  const [unitType, setUnitType] = useState('standard')
  const [floor, setFloor] = useState('')
  const [maxOccupancy, setMaxOccupancy] = useState('2')
  const [baseRate, setBaseRate] = useState('')
  const [amenities, setAmenities] = useState('')
  const [status, setStatus] = useState('available')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .single()
        if (store) setStoreId(store.id)
      }
    }
    init()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: unitNumber,
          unit_type: unitType || undefined,
          floor: floor || undefined,
          max_occupancy: maxOccupancy ? parseInt(maxOccupancy) : undefined,
          base_rate: parseFloat(baseRate),
          amenities: amenities ? amenities.split(',').map(a => a.trim()).filter(Boolean) : undefined,
          status: status || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Алдаа гарлаа')
      }
      router.push('/dashboard/units')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Өрөө бүртгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/units" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ өрөө</h1>
          <p className="text-slate-400 mt-1">Өрөө/байр бүртгэх</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үндсэн мэдээлэл</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Өрөөний дугаар *</label>
                    <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="101" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Өрөөний төрөл</label>
                    <select value={unitType} onChange={(e) => setUnitType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="standard">Standard</option>
                      <option value="deluxe">Deluxe</option>
                      <option value="suite">Suite</option>
                      <option value="penthouse">Penthouse</option>
                      <option value="dormitory">Dormitory</option>
                      <option value="cabin">Cabin</option>
                      <option value="apartment">Apartment</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Давхар</label>
                    <input type="text" value={floor} onChange={(e) => setFloor(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Хамгийн их зочин</label>
                    <input type="number" value={maxOccupancy} onChange={(e) => setMaxOccupancy(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="2" min="1" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үнэ & Тоног төхөөрөмж</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Үнэ (₮) *</label>
                  <input type="number" value={baseRate} onChange={(e) => setBaseRate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Тоног төхөөрөмж</label>
                  <input type="text" value={amenities} onChange={(e) => setAmenities(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="WiFi, TV, Мини бар (таслалаар тусгаарлана)" />
                  <p className="text-xs text-slate-500 mt-1">Таслалаар тусгаарлан бичнэ</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Төлөв</h2>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="available">Сул</option>
                <option value="occupied">Эзэмшилтэй</option>
                <option value="maintenance">Засварт</option>
                <option value="blocked">Хаалттай</option>
              </select>
            </div>

            <button type="submit" disabled={loading || !unitNumber || !baseRate}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all">
              {loading ? 'Хадгалж байна...' : 'Өрөө бүртгэх'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
