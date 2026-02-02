'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Service {
  id: string
  name: string
}

interface PackageServiceItem {
  id: string
  service_id: string
  quantity: number
}

export default function NewPackagePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState('')
  const [services, setServices] = useState<Service[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [validDays, setValidDays] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [packageServices, setPackageServices] = useState<PackageServiceItem[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .single()
        if (store) {
          setStoreId(store.id)
          const { data } = await supabase
            .from('services')
            .select('id, name')
            .eq('store_id', store.id)
            .order('name')
          if (data) setServices(data)
        }
      }
    }
    init()
  }, [])

  const addService = () => {
    setPackageServices([...packageServices, { id: crypto.randomUUID(), service_id: '', quantity: 1 }])
  }

  const updateService = (id: string, field: string, value: string | number) => {
    setPackageServices(packageServices.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeService = (id: string) => {
    setPackageServices(packageServices.filter(s => s.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return
    setLoading(true)
    setError('')

    try {
      const validServices = packageServices.filter(s => s.service_id)
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          price: parseFloat(price),
          original_price: originalPrice ? parseFloat(originalPrice) : undefined,
          valid_days: validDays ? parseInt(validDays) : undefined,
          is_active: isActive,
          services: validServices.length > 0 ? validServices.map(s => ({
            service_id: s.service_id,
            quantity: s.quantity,
          })) : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Алдаа гарлаа')
      }
      router.push('/dashboard/packages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Багц үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/packages" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ багц</h1>
          <p className="text-slate-400 mt-1">Үйлчилгээний багц үүсгэх</p>
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
                  <label className="block text-sm font-medium text-slate-300 mb-2">Багцын нэр *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Жишээ: VIP багц, Сарын багц" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Тайлбар</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Багцын тайлбар..." />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Багцын үйлчилгээнүүд</h2>
                <button type="button" onClick={addService} className="text-sm text-pink-400 hover:text-pink-300">
                  + Үйлчилгээ нэмэх
                </button>
              </div>

              {packageServices.length === 0 ? (
                <p className="text-slate-400 text-sm">Багцад үйлчилгээ нэмэхийн тулд дээрх товчийг дарна уу.</p>
              ) : (
                <div className="space-y-3">
                  {packageServices.map((ps, idx) => (
                    <div key={ps.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
                      <span className="text-sm text-slate-400 w-6">{idx + 1}.</span>
                      <select value={ps.service_id} onChange={(e) => updateService(ps.id, 'service_id', e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Сонгоно уу</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input type="number" value={ps.quantity} onChange={(e) => updateService(ps.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1" placeholder="Тоо" />
                      <button type="button" onClick={() => removeService(ps.id)} className="text-red-400 hover:text-red-300 text-sm">
                        Устгах
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үнэ & Хүчинтэй хугацаа</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Үнэ (₮) *</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Жинхэнэ үнэ (₮)</label>
                  <input type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Хөнгөлөлтгүй үнэ" />
                  <p className="text-xs text-slate-500 mt-1">Хөнгөлөлт харуулахад ашиглана</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Хүчинтэй хоног</label>
                  <input type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="30" min="1" />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-pink-500 focus:ring-pink-500" />
                <span className="text-slate-300">Идэвхтэй</span>
              </label>
            </div>

            <button type="submit" disabled={loading || !name || !price}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all">
              {loading ? 'Хадгалж байна...' : 'Багц үүсгэх'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
