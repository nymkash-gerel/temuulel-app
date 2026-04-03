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

export default function NewProductClient({ storeId }: { storeId: string }) {
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
// Status
  const [status, setStatus] = useState<'active' | 'draft'>('draft')

  const categories = [
    { value: 'clothing', label: 'Хувцас', subcategories: ['Цамц', 'Өмд', 'Даашинз', 'Пальто', 'Куртка'] },
    { value: 'shoes', label: 'Гутал', subcategories: ['Пүмп', 'Туфли', 'Кроссовок', 'Гуталтай'] },
    { value: 'bags', label: 'Цүнх', subcategories: ['Гар цүнх', 'Нуруун цүнх', 'Бэлтгэн цүнх'] },
    { value: 'accessories', label: 'Гоёл чимэглэл', subcategories: ['Бүс', 'Малгай', 'Ороолт', 'Бээлий'] },
  ]

  const selectedCategoryData = categories.find(c => c.value === category)


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

      if (!storeId) throw new Error('Store not found')

      // Create product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          store_id: storeId,
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
          className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
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
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
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
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
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
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
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
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Variants Toggle */}
                <div className="pt-4 border-t border-white/[0.06]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => setHasVariants(e.target.checked)}
                      className="w-5 h-5 rounded border-white/[0.08] bg-white/[0.06] text-blue-500 focus:ring-blue-500"
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
                        className="p-4 bg-white/[0.04] rounded-xl space-y-3"
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
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
</button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <input
                            type="text"
                            value={variant.size}
                            onChange={(e) => updateVariant(variant.id, 'size', e.target.value)}
                            placeholder="Хэмжээ (S, M, L)"
                            className="px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
                          />
                          <input
                            type="text"
                            value={variant.color}
                            onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                            placeholder="Өнгө"
                            className="px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
                          />
                          <input
                            type="number"
                            value={variant.price}
                            onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                            placeholder="Үнэ (₮)"
                            className="px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
                          />
                          <input
                            type="number"
                            value={variant.stock}
                            onChange={(e) => updateVariant(variant.id, 'stock', e.target.value)}
                            placeholder="Тоо ширхэг"
                            className="px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addVariant}
                      className="w-full py-3 border-2 border-dashed border-white/[0.08] hover:border-slate-500 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      <span>Хувилбар нэмэх</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Fit Note */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Хэмжээний зөвлөмж</h2>
              <p className="text-slate-400 text-sm mb-4">
                Chatbot энэ мэдээллийг ашиглан хэрэглэгчид тохирох размер зөвлөнө.
              </p>
              <textarea
                value={fitNote}
                onChange={(e) => setFitNote(e.target.value)}
                placeholder="Жишээ: Энэ загвар жижгэвтэр тул 1 размер том авахыг зөвлөнө. 160см, 55кг хүнд M хэмжээ тохиромжтой."
                rows={3}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              />
            </div>

            {/* Social Media Post IDs */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Сошиал медиа холбоос</h2>
              <p className="text-slate-400 text-sm mb-4">
                Энэ бүтээгдэхүүнийг сурталчилсан пост руу холбоно. Comment Auto-Reply энэ мэдээллийг ашиглан зөв бүтээгдэхүүний мэдээлэл өгнө.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> Facebook Post ID
                    </span>
                  </label>
                  <input
                    type="text"
                    value={facebookPostId}
                    onChange={(e) => setFacebookPostId(e.target.value)}
                    placeholder="123456789012345_987654321098765"
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-slate-500 mt-1">Facebook постын URL-аас олно (жишээ: /posts/123456789)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg> Instagram Post ID
                    </span>
                  </label>
                  <input
                    type="text"
                    value={instagramPostId}
                    onChange={(e) => setInstagramPostId(e.target.value)}
                    placeholder="17895695668004550"
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-slate-500 mt-1">Instagram постын media ID</p>
                </div>
              </div>
            </div>

            {/* AI Context */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg> AI хариултын заавар
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Comment Auto-Reply AI энэ бүтээгдэхүүний талаар хариулахдаа энэ зааврыг дагана.
              </p>
              <textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder="Жишээ: Энэ бүтээгдэхүүн хязгаарлагдмал тоотой тул яаравчлахыг зөвлө. Үнийн хямдрал байхгүй. Хүргэлт 2-3 хоногт хийгдэнэ."
                rows={3}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-all resize-none"
              />
            </div>

            {/* Images */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
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
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Төлөв</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all">
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
                <label className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all">
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
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
                <h2 className="text-lg font-semibold text-white">AI Туслах</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Бүтээгдэхүүний мэдээллийг оруулсны дараа AI дараах зүйлсийг санал болгоно:
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Ангилал санал болгох
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Автомат тег үүсгэх
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  SEO оноо тооцох
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
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
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    <span>Хадгалж байна...</span>
                  </>
                ) : (
                  <span>Хадгалах</span>
                )}
              </button>
              <Link
                href="/dashboard/products"
                className="block w-full py-3 text-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-xl transition-all"
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
