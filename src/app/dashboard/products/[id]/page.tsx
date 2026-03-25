'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ImageUpload from '@/components/ui/ImageUpload'
import { resolveStoreId } from '@/lib/resolve-store'

interface Variant {
  id: string
  size: string
  color: string
  price: string
  stock: string
  sku: string
  isNew?: boolean
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [sku, setSku] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [status, setStatus] = useState<'active' | 'draft'>('draft')
  const [hasVariants, setHasVariants] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const [stockQuantity, setStockQuantity] = useState('')
  const [fitNote, setFitNote] = useState('')
  const [existingFaqs, setExistingFaqs] = useState<Record<string, string>>({})
  const [facebookPostId, setFacebookPostId] = useState('')
  const [instagramPostId, setInstagramPostId] = useState('')
  const [aiContext, setAiContext] = useState('')
  const [searchAliases, setSearchAliases] = useState<string[]>([])
  const [newAlias, setNewAlias] = useState('')

  const categories = [
    { value: 'clothing', label: 'Хувцас', subcategories: ['Цамц', 'Өмд', 'Даашинз', 'Пальто', 'Куртка'] },
    { value: 'shoes', label: 'Гутал', subcategories: ['Пүмп', 'Туфли', 'Кроссовок', 'Гуталтай'] },
    { value: 'bags', label: 'Цүнх', subcategories: ['Гар цүнх', 'Нуруун цүнх', 'Бэлтгэн цүнх'] },
    { value: 'accessories', label: 'Гоёл чимэглэл', subcategories: ['Бүс', 'Малгай', 'Ороолт', 'Бээлий'] },
  ]

  const selectedCategoryData = categories.find(c => c.value === category)

  useEffect(() => {
    const loadProduct = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const storeId = await resolveStoreId(supabase, user.id)
      const store = storeId ? { id: storeId } : null

      if (store) setStoreId(store.id)

      const { data: product } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('id', productId)
        .single()

      if (product) {
        setName(product.name || '')
        setDescription(product.description || '')
        setCategory(product.category || '')
        setSubcategory(product.subcategory || '')
        setBasePrice(String(product.base_price || ''))
        setSku(product.sku || '')
        setImages((product.images || []) as string[])
        setStatus((product.status || 'draft') as 'active' | 'draft')
        setHasVariants(product.has_variants || false)

        // Load fit note from product_faqs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const faqs = ((product as any).product_faqs || {}) as Record<string, string>
        setExistingFaqs(faqs)
        setFitNote(faqs.size_fit || '')

        // Load social post IDs
        setFacebookPostId(product.facebook_post_id || '')
        setInstagramPostId(product.instagram_post_id || '')
        setAiContext(product.ai_context || '')
        setSearchAliases((product.search_aliases || []) as string[])

        if (product.product_variants?.length > 0) {
          setVariants(product.product_variants.map((v: Record<string, unknown>) => ({
            id: v.id as string,
            size: (v.size as string) || '',
            color: (v.color as string) || '',
            price: String(v.price || ''),
            stock: String(v.stock_quantity || ''),
            sku: (v.sku as string) || '',
          })))
          // For simple products, load stock from first variant
          if (!product.has_variants) {
            setStockQuantity(String(product.product_variants[0].stock_quantity || ''))
          }
        }
      }
      setLoading(false)
    }
    loadProduct()
  }, [productId])

  const addVariant = () => {
    setVariants([...variants, { id: `new-${Date.now()}`, size: '', color: '', price: '', stock: '', sku: '', isNew: true }])
  }

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id))
  }

  const updateVariant = (id: string, field: keyof Variant, value: string) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Merge fit note into existing product_faqs (preserve AI-generated fields)
      const updatedFaqs = { ...existingFaqs }
      if (fitNote.trim()) {
        updatedFaqs.size_fit = fitNote.trim()
      } else {
        delete updatedFaqs.size_fit
      }

      const { error: productError } = await supabase
        .from('products')
        .update({
          name,
          description,
          category,
          subcategory,
          base_price: parseFloat(basePrice) || 0,
          sku: sku || null,
          images,
          status,
          has_variants: hasVariants,
          product_faqs: updatedFaqs,
          facebook_post_id: facebookPostId || null,
          instagram_post_id: instagramPostId || null,
          ai_context: aiContext || null,
          search_aliases: searchAliases,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)

      if (productError) throw productError

      // Handle variants / stock
      if (hasVariants) {
        for (const variant of variants) {
          if (variant.isNew || variant.id.startsWith('new-')) {
            await supabase.from('product_variants').insert({
              product_id: productId,
              size: variant.size || null,
              color: variant.color || null,
              price: parseFloat(variant.price) || parseFloat(basePrice) || 0,
              stock_quantity: parseInt(variant.stock) || 0,
              sku: variant.sku || null,
            })
          } else {
            await supabase.from('product_variants').update({
              size: variant.size || null,
              color: variant.color || null,
              price: parseFloat(variant.price) || parseFloat(basePrice) || 0,
              stock_quantity: parseInt(variant.stock) || 0,
              sku: variant.sku || null,
            }).eq('id', variant.id)
          }
        }
      } else {
        // Simple product — upsert a single default variant for stock tracking
        const stock = parseInt(stockQuantity) || 0
        const defaultVariant = variants.find(v => !v.id.startsWith('new-'))
        if (defaultVariant) {
          await supabase.from('product_variants').update({
            size: null, color: null,
            price: parseFloat(basePrice) || 0,
            stock_quantity: stock,
            sku: sku || null,
          }).eq('id', defaultVariant.id)
        } else {
          await supabase.from('product_variants').insert({
            product_id: productId,
            size: null, color: null,
            price: parseFloat(basePrice) || 0,
            stock_quantity: stock,
            sku: sku || null,
          })
        }
      }

      // Fire-and-forget AI enrichment (search aliases + FAQs)
      fetch('/api/products/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: [productId] }),
      }).catch(() => {})

      router.push('/dashboard/products')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : 'Алдаа гарлаа'
      setError(msg)
      console.error('[Product Save]', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Энэ бүтээгдэхүүнийг устгах уу?')) return

    setDeleting(true)
    try {
      await supabase.from('product_variants').delete().eq('product_id', productId)
      await supabase.from('products').delete().eq('id', productId)
      router.push('/dashboard/products')
      router.refresh()
    } catch (err) {
      setError('Устгахад алдаа гарлаа')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="text-white">Уншиж байна...</span></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/products" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Бүтээгдэхүүн засах</h1>
            <p className="text-slate-400 mt-1">{name}</p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl"
        >
          {deleting ? 'Устгаж байна...' : '🗑️ Устгах'}
        </button>
      </div>

      {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">{error}</div>}

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үндсэн мэдээлэл</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Нэр *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Тайлбар</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Ангилал</label>
                    <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory('') }} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                      <option value="">Сонгох</option>
                      {categories.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Дэд ангилал</label>
                    <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" disabled={!category}>
                      <option value="">Сонгох</option>
                      {selectedCategoryData?.subcategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">Үнэ (₮) *</label>
                    <input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" required />
                  </div>
                  {!hasVariants && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Нөөц (ширхэг)</label>
                      <input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="0" min="0" className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">SKU</label>
                    <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500" />
                    <span className="text-white">Хэмжээ/Өнгөөр ялгаатай</span>
                  </label>
                </div>

                {hasVariants && (
                  <div className="space-y-3 pt-4">
                    {variants.map((variant, index) => (
                      <div key={variant.id} className="p-4 bg-slate-700/30 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-300">Хувилбар {index + 1}</span>
                          <button type="button" onClick={() => removeVariant(variant.id)} className="text-slate-400 hover:text-red-400">🗑️</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <input type="text" value={variant.size} onChange={(e) => updateVariant(variant.id, 'size', e.target.value)} placeholder="Хэмжээ" className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
                          <input type="text" value={variant.color} onChange={(e) => updateVariant(variant.id, 'color', e.target.value)} placeholder="Өнгө" className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
                          <input type="number" value={variant.price} onChange={(e) => updateVariant(variant.id, 'price', e.target.value)} placeholder="Үнэ" className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
                          <input type="number" value={variant.stock} onChange={(e) => updateVariant(variant.id, 'stock', e.target.value)} placeholder="Нөөц" className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addVariant} className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-2">
                      ➕ Хувилбар нэмэх
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

            {/* Search Aliases */}
            <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-500/30 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <span>🔍</span> Хайлтын түлхүүр үгс
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                AI автомат үүсгэсэн. Хэрэглэгч эдгээр үгсээр хайхад энэ бараа олдоно. Гараар нэмж бас болно.
              </p>
              {searchAliases.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {searchAliases.map((alias, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-700/50 border border-slate-600 rounded-full text-sm text-slate-300"
                    >
                      {alias}
                      <button
                        type="button"
                        onClick={() => setSearchAliases(prev => prev.filter((_, idx) => idx !== i))}
                        className="ml-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const trimmed = newAlias.trim().toLowerCase()
                      if (trimmed && !searchAliases.includes(trimmed)) {
                        setSearchAliases(prev => [...prev, trimmed])
                        setNewAlias('')
                      }
                    }
                  }}
                  placeholder="Шинэ түлхүүр үг нэмэх..."
                  className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-green-500 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newAlias.trim().toLowerCase()
                    if (trimmed && !searchAliases.includes(trimmed)) {
                      setSearchAliases(prev => [...prev, trimmed])
                      setNewAlias('')
                    }
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Нэмэх
                </button>
              </div>
            </div>

            {/* Images */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Зураг</h2>
              <ImageUpload images={images} onChange={setImages} maxImages={5} storeId={storeId} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Төлөв</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl cursor-pointer hover:bg-slate-700/50">
                  <input type="radio" name="status" checked={status === 'draft'} onChange={() => setStatus('draft')} className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-white">Ноорог</span>
                    <p className="text-xs text-slate-400">Chatbot-д харагдахгүй</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl cursor-pointer hover:bg-slate-700/50">
                  <input type="radio" name="status" checked={status === 'active'} onChange={() => setStatus('active')} className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-white">Идэвхтэй</span>
                    <p className="text-xs text-slate-400">Chatbot-оор борлуулна</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl disabled:opacity-50">
                {saving ? 'Хадгалж байна...' : '💾 Хадгалах'}
              </button>
              <Link href="/dashboard/products" className="block w-full py-3 text-center bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Цуцлах
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
