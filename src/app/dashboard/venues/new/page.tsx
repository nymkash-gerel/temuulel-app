'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewVenuePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [capacity, setCapacity] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [dailyRate, setDailyRate] = useState('')
  const [amenities, setAmenities] = useState('')
  const [isActive, setIsActive] = useState(true)

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
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          capacity: capacity ? parseInt(capacity) : undefined,
          hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
          daily_rate: dailyRate ? parseFloat(dailyRate) : undefined,
          amenities: amenities ? amenities.split(',').map(a => a.trim()).filter(Boolean) : undefined,
          is_active: isActive,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Алдаа гарлаа')
      }
      router.push('/dashboard/venues')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Заал бүртгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/venues" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ заал</h1>
          <p className="text-slate-400 mt-1">Заал/танхим бүртгэх</p>
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
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Заалны нэр *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Жишээ: Их заал, VIP өрөө" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Тайлбар</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Заалны тайлбар..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Багтаамж (хүн)</label>
                  <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="50" min="1" />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үнэ</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Цагийн үнэ (₮)</label>
                  <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Өдрийн үнэ (₮)</label>
                  <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Тоног төхөөрөмж</h2>
              <input type="text" value={amenities} onChange={(e) => setAmenities(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Проектор, Дуу чанга, WiFi" />
              <p className="text-xs text-slate-500 mt-1">Таслалаар тусгаарлан бичнэ</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-pink-500 focus:ring-pink-500" />
                <span className="text-slate-300">Идэвхтэй</span>
              </label>
            </div>

            <button type="submit" disabled={loading || !name}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all">
              {loading ? 'Хадгалж байна...' : 'Заал бүртгэх'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
