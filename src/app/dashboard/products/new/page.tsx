'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ImageUpload from '@/components/ui/ImageUpload'

interface Variant {
  id: string
  size: string
  color: string
  price: string
  stock: string
  sku: string
}

export default function NewProductPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Basic info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [sku, setSku] = useState('')

  // Variants
  const [hasVariants, setHasVariants] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([
    { id: '1', size: '', color: '', price: '', stock: '', sku: '' }
  ])

  // Stock for simple products (no variants)
  const [stockQuantity, setStockQuantity] = useState('')

  // Fit note (merchant's sizing guide for chatbot)
  const [fitNote, setFitNote] = useState('')

  // Social media post IDs
  const [facebookPostId, setFacebookPostId] = useState('')
  const [instagramPostId, setInstagramPostId] = useState('')

  // AI context for product-specific AI instructions
  const [aiContext, setAiContext] = useState('')

  // Images
  const [images, setImages] = useState<string[]>([])

  // Store ID for image upload
  const [storeId, setStoreId] = useState<string>('')

  // Status
  const [status, setStatus] = useState<'active' | 'draft'>('draft')

  const categories = [
    { value: 'clothing', label: 'Хувцас', subcategories: ['Цамц', 'Өмд', 'Даашинз', 'Пальто', 'Куртка'] },
    { value: 'shoes', label: 'Гутал', subcategories: ['Пүмп', 'Туфли', 'Кроссовок', 'Гуталтай'] },
    { value: 'bags', label: 'Цүнх', subcategories: ['Гар цүнх', 'Нуруун цүнх', 'Бэлтгэн цүнх'] },
    { value: 'accessories', label: 'Гоёл чимэглэл', subcategories: ['Бүс', 'Малгай', 'Ороолт', 'Бээлий'] },
  ]

  const selectedCategoryData = categories.find(c => c.value === category)

  // Get store ID on mount
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

  const addVariant = () => {
    setVariants([
      ...variants,
      { id: Date.now().toString(), size: '', color: '', price: '', stock: '', sku: '' }
    ])
  }

  const removeVariant = (id: string) => {
    if (variants.length > 1) {
      setVariants(variants.filter(v => v.id !== id))
    }
  }

  const updateVariant = (id: string, field: keyof Variant, value: string) => {
    setVariants(variants.map(v =>
      v.id === id ? { ...v, [field]: value } : v
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Get current user and store
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) throw new Error('Store not found')

      // Create product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          store_id: store.id,
          name,
          description,
          category,
          subcategory,
          base_price: parseFloat(basePrice) || 0,
          sku: sku || null,
          images: images,
          status,
          has_variants: hasVariants,
          facebook_post_id: facebookPostId || null,
          instagram_post_id: instagramPostId || null,
          ai_context: aiContext || null,
          ...(fitNote.trim() && { product_faqs: { size_fit: fitNote.trim() } }),
        })
        .select()
        .single()

      if (productError) throw productError

      // Create variants or default stock entry
      if (hasVariants && variants.length > 0) {
        const variantData = variants
          .filter(v => v.size || v.color)
          .map(v => ({
            product_id: product.id,
            size: v.size || null,
            color: v.color || null,
            price: parseFloat(v.price) || parseFloat(basePrice) || 0,
            stock_quantity: parseInt(v.stock) || 0,
            sku: v.sku || null,
          }))

        if (variantData.length > 0) {
          const { error: variantError } = await supabase
            .from('product_variants')
            .insert(variantData)

          if (variantError) throw variantError
        }
      } else {
        // Simple product — create single default variant for stock tracking
        const { error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: product.id,
            price: parseFloat(basePrice) || 0,
            stock_quantity: parseInt(stockQuantity) || 0,
            sku: sku || null,
          })

        if (variantError) throw variantError
      }

      // Fire-and-forget AI enrichment (search aliases + FAQs)
      fetch('/api/products/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: [product.id] }),
      }).catch(() => {})

      router.push('/dashboard/products')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/products"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Бүтээгдэхүүн нэмэх</h1>
          <p className="text-slate-400 mt-1">Шинэ бүтээгдэхүүн бүртгэх</p>
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
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Бүтээгдэхүүний нэр *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Жишээ: Эмэгтэй цагаан цамц"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
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
                    placeholder="Бүтээгдэхүүний дэлгэрэнгүй тайлбар..."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Ангилал *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value)
                        setSubcategory('')
                      }}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                      required
                    >
                      <option value="">Сонгох</option>
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Дэд ангилал
                    </label>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                      disabled={!category}
                    >
                      <option value="">Сонгох</option>
                      {selectedCategoryData?.subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үнэ & Нөөц</h2>
              <div className="space-y-4">
                <div className={`grid ${hasVariants ? 'grid-cols-2' : 'grid-cols-3'} gap-4`}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Үндсэн үнэ (₮) *
                    </label>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  {!hasVariants && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Нөөц (ширхэг)
                      </label>
                      <input
                        type="number"
                        value={stockQuantity}
                        onChange={(e) => setStockQuantity(e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      SKU код
                    </label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="SKU-001"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Variants Toggle */}
                <div className="pt-4 border-t border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => setHasVariants(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-white">Хэмжээ/Өнгөөр ялгаатай (Variants)</span>
                  </label>
                </div>

                {/* Variants List */}
                {hasVariants && (
                  <div className="space-y-3 pt-4">
                    {variants.map((variant, index) => (
                      <div
                        key={variant.id}
                        className="p-4 bg-slate-700/30 rounded-xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-300">
                            Хувилбар {index + 1}
                          </span>
                          {variants.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeVariant(variant.id)}
                              className="text-slate-400 hover:text-red-400 transition-all"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <input
                            type="text"
                            value={variant.size}
                            onChange={(e) => updateVariant(variant.id, 'size', e.target.value)}
                            placeholder="Хэмжээ (S, M, L)"
                            className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={variant.color}
                            onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                            placeholder="Өнгө"
                            className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="number"
                            value={variant.price}
                            onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                            placeholder="Үнэ (₮)"
                            className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="number"
                            value={variant.stock}
                            onChange={(e) => updateVariant(variant.id, 'stock', e.target.value)}
                            placeholder="Тоо ширхэг"
                            className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addVariant}
                      className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <span>➕</span>
                      <span>Хувилбар нэмэх</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Fit Note */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Хэмжээний зөвлөмж</h2>
              <p className="text-slate-400 text-sm mb-4">
                Chatbot энэ мэдээллийг ашиглан хэрэглэгчид тохирох размер зөвлөнө.
              </p>
              <textarea
                value={fitNote}
                onChange={(e) => setFitNote(e.target.value)}
                placeholder="Жишээ: Энэ загвар жижгэвтэр тул 1 размер том авахыг зөвлөнө. 160см, 55кг хүнд M хэмжээ тохиромжтой."
                rows={3}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {/* Social Media Post IDs */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Сошиал медиа холбоос</h2>
              <p className="text-slate-400 text-sm mb-4">
                Энэ бүтээгдэхүүнийг сурталчилсан пост руу холбоно. Comment Auto-Reply энэ мэдээллийг ашиглан зөв бүтээгдэхүүний мэдээлэл өгнө.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-blue-400">📘</span> Facebook Post ID
                    </span>
                  </label>
                  <input
                    type="text"
                    value={facebookPostId}
                    onChange={(e) => setFacebookPostId(e.target.value)}
                    placeholder="123456789012345_987654321098765"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Facebook постын URL-аас олно (жишээ: /posts/123456789)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-pink-400">📸</span> Instagram Post ID
                    </span>
                  </label>
                  <input
                    type="text"
                    value={instagramPostId}
                    onChange={(e) => setInstagramPostId(e.target.value)}
                    placeholder="17895695668004550"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Instagram постын media ID</p>
                </div>
              </div>
            </div>

            {/* AI Context */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <span>🤖</span> AI хариултын заавар
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Comment Auto-Reply AI энэ бүтээгдэхүүний талаар хариулахдаа энэ зааврыг дагана.
              </p>
              <textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder="Жишээ: Энэ бүтээгдэхүүн хязгаарлагдмал тоотой тул яаравчлахыг зөвлө. Үнийн хямдрал байхгүй. Хүргэлт 2-3 хоногт хийгдэнэ."
                rows={3}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-all resize-none"
              />
            </div>

            {/* Images */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Зураг</h2>
              <ImageUpload
                images={images}
                onChange={setImages}
                maxImages={5}
                storeId={storeId}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Төлөв</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-all">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                    className="w-4 h-4 text-blue-500"
                  />
                  <div>
                    <span className="text-white">Ноорог</span>
                    <p className="text-xs text-slate-400">Зөвхөн танд харагдана</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-all">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                    className="w-4 h-4 text-blue-500"
                  />
                  <div>
                    <span className="text-white">Идэвхтэй</span>
                    <p className="text-xs text-slate-400">Chatbot-оор борлуулна</p>
                  </div>
                </label>
              </div>
            </div>

            {/* AI Suggestions */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🤖</span>
                <h2 className="text-lg font-semibold text-white">AI Туслах</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Бүтээгдэхүүний мэдээллийг оруулсны дараа AI дараах зүйлсийг санал болгоно:
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Ангилал санал болгох
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Автомат тег үүсгэх
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  SEO оноо тооцох
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Үнийн анхааруулга
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Хадгалж байна...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Хадгалах</span>
                  </>
                )}
              </button>
              <Link
                href="/dashboard/products"
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
