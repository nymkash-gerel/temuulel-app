'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ServiceVariation {
  id: string
  name: string
  description: string
  price: number
  duration_minutes: number | null
  is_addon: boolean
}

export default function NewServicePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState<string>('')

  // Service fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [status, setStatus] = useState<'active' | 'draft'>('active')
  const [aiContext, setAiContext] = useState('')
  const [facebookPostId, setFacebookPostId] = useState('')
  const [instagramPostId, setInstagramPostId] = useState('')

  // Variations
  const [variations, setVariations] = useState<ServiceVariation[]>([])

  useEffect(() => {
    const getStoreId = async () => {
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
    getStoreId()
  }, [])

  const addVariation = () => {
    setVariations([...variations, {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      price: 0,
      duration_minutes: null,
      is_addon: false
    }])
  }

  const updateVariation = (id: string, field: keyof ServiceVariation, value: unknown) => {
    setVariations(variations.map(v =>
      v.id === id ? { ...v, [field]: value } : v
    ))
  }

  const removeVariation = (id: string) => {
    setVariations(variations.filter(v => v.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return

    setLoading(true)
    setError('')

    try {
      // Create service
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .insert({
          store_id: storeId,
          name,
          description: description || null,
          category: category || null,
          base_price: parseFloat(basePrice) || 0,
          duration_minutes: parseInt(durationMinutes) || 60,
          status,
          ai_context: aiContext || null,
          facebook_post_id: facebookPostId || null,
          instagram_post_id: instagramPostId || null,
        })
        .select()
        .single()

      if (serviceError) throw serviceError

      // Create variations
      if (variations.length > 0) {
        const validVariations = variations.filter(v => v.name.trim())
        if (validVariations.length > 0) {
          const { error: variationsError } = await supabase
            .from('service_variations')
            .insert(
              validVariations.map(v => ({
                service_id: service.id,
                name: v.name,
                description: v.description || null,
                price: v.price || 0,
                duration_minutes: v.duration_minutes,
                is_addon: v.is_addon
              }))
            )

          if (variationsError) {
            console.error('Variations error:', variationsError)
          }
        }
      }

      router.push('/dashboard/services')
    } catch (err) {
      console.error('Error:', err)
      setError('Үйлчилгээ үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    'Үс засалт',
    'Маникюр / Педикюр',
    'Нүүр будалт',
    'Арьс арчилгаа',
    'Массаж',
    'Спа',
    'Бусад'
  ]

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/services" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ үйлчилгээ</h1>
          <p className="text-slate-400 mt-1">Шинэ үйлчилгээ нэмэх</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үндсэн мэдээлэл</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Үйлчилгээний нэр *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="Жишээ: Үс засалт"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Тайлбар
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="Үйлчилгээний дэлгэрэнгүй тайлбар..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Ангилал
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="">Сонгоно уу</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Төлөв
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'active' | 'draft')}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="active">Идэвхтэй</option>
                      <option value="draft">Ноорог</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing & Duration */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үнэ & Хугацаа</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Үнэ (₮) *
                  </label>
                  <input
                    type="number"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Хугацаа (минут)
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="15">15 минут</option>
                    <option value="30">30 минут</option>
                    <option value="45">45 минут</option>
                    <option value="60">1 цаг</option>
                    <option value="90">1 цаг 30 мин</option>
                    <option value="120">2 цаг</option>
                    <option value="150">2 цаг 30 мин</option>
                    <option value="180">3 цаг</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Variations */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Сонголтууд / Нэмэлт</h2>
                <button
                  type="button"
                  onClick={addVariation}
                  className="text-sm text-pink-400 hover:text-pink-300"
                >
                  + Нэмэх
                </button>
              </div>

              {variations.length === 0 ? (
                <p className="text-slate-400 text-sm">
                  Үнийн сонголт эсвэл нэмэлт үйлчилгээ нэмэх бол дээрх товчийг дарна уу.
                </p>
              ) : (
                <div className="space-y-4">
                  {variations.map((variation, index) => (
                    <div key={variation.id} className="p-4 bg-slate-700/30 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-400">Сонголт {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeVariation(variation.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Устгах
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={variation.name}
                          onChange={(e) => updateVariation(variation.id, 'name', e.target.value)}
                          className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                          placeholder="Нэр (VIP, Standard гэх мэт)"
                        />
                        <input
                          type="number"
                          value={variation.price || ''}
                          onChange={(e) => updateVariation(variation.id, 'price', parseFloat(e.target.value) || 0)}
                          className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                          placeholder="Үнэ"
                        />
                      </div>

                      <div className="mt-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={variation.is_addon}
                            onChange={(e) => updateVariation(variation.id, 'is_addon', e.target.checked)}
                            className="rounded border-slate-600 bg-slate-700 text-pink-500 focus:ring-pink-500"
                          />
                          <span className="text-sm text-slate-300">Нэмэлт үйлчилгээ (add-on)</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Social Media Links */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Сошиал медиа холбоос</h2>
              <p className="text-sm text-slate-400 mb-4">
                Энэ үйлчилгээг Facebook/Instagram пост-той холбох
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Facebook Post ID
                  </label>
                  <input
                    type="text"
                    value={facebookPostId}
                    onChange={(e) => setFacebookPostId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="123456789_987654321"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Instagram Post ID
                  </label>
                  <input
                    type="text"
                    value={instagramPostId}
                    onChange={(e) => setInstagramPostId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="17895695668004550"
                  />
                </div>
              </div>
            </div>

            {/* AI Context */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">AI Заавар</h2>
              <p className="text-sm text-slate-400 mb-4">
                AI чатбот энэ үйлчилгээний талаар хэрхэн хариулах заавар
              </p>

              <textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Жишээ: Энэ үйлчилгээнд урьдчилан захиалга өгөх шаардлагатай..."
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !name || !basePrice}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
            >
              {loading ? 'Хадгалж байна...' : 'Үйлчилгээ үүсгэх'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
