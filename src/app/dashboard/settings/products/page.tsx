'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ProductSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [categories, setCategories] = useState<string[]>([
    'Хувцас', 'Гутал', 'Цүнх', 'Аксессуар',
  ])
  const [sizes, setSizes] = useState<string[]>([
    'XS', 'S', 'M', 'L', 'XL', 'XXL',
  ])
  const [colors, setColors] = useState<string[]>([
    'Хар', 'Цагаан', 'Улаан', 'Хөх', 'Ногоон', 'Шар', 'Саарал', 'Бор',
  ])
  const [newCategory, setNewCategory] = useState('')
  const [newSize, setNewSize] = useState('')
  const [newColor, setNewColor] = useState('')
  const [currency, setCurrency] = useState('MNT')
  const [showStock, setShowStock] = useState(true)
  const [lowStockThreshold, setLowStockThreshold] = useState(5)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id, product_settings')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        const settings = (store.product_settings || {}) as Record<string, unknown>
        if (settings.categories) setCategories(settings.categories as string[])
        if (settings.sizes) setSizes(settings.sizes as string[])
        if (settings.colors) setColors(settings.colors as string[])
        if (settings.currency) setCurrency(settings.currency as string)
        if (settings.show_stock !== undefined) setShowStock(settings.show_stock as boolean)
        if (settings.low_stock_threshold) setLowStockThreshold(settings.low_stock_threshold as number)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleSave() {
    if (!storeId) return
    setSaving(true)
    setSaved(false)

    await supabase
      .from('stores')
      .update({
        product_settings: {
          categories,
          sizes,
          colors,
          currency,
          show_stock: showStock,
          low_stock_threshold: lowStockThreshold,
        },
      })
      .eq('id', storeId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function addItem(list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) {
    if (!value.trim()) return
    if (list.includes(value.trim())) return
    setList([...list, value.trim()])
    setValue('')
  }

  function removeItem(list: string[], setList: (v: string[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Бүтээгдэхүүний тохиргоо</h1>
          <p className="text-slate-400 mt-1">Ангилал, хэмжээ, өнгө тохируулах</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Categories */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-medium">Ангилал</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                {cat}
                <button onClick={() => removeItem(categories, setCategories, i)} className="text-blue-400/60 hover:text-red-400">✕</button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(categories, setCategories, newCategory, setNewCategory) }}
              placeholder="Шинэ ангилал..."
              className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
            <button
              onClick={() => addItem(categories, setCategories, newCategory, setNewCategory)}
              className="px-4 py-2.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-xl text-sm font-medium transition-all"
            >
              + Нэмэх
            </button>
          </div>
        </div>

        {/* Sizes */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-medium">Хэмжээ (Size)</h3>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm">
                {size}
                <button onClick={() => removeItem(sizes, setSizes, i)} className="text-purple-400/60 hover:text-red-400">✕</button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(sizes, setSizes, newSize, setNewSize) }}
              placeholder="Шинэ хэмжээ..."
              className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
            <button
              onClick={() => addItem(sizes, setSizes, newSize, setNewSize)}
              className="px-4 py-2.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-xl text-sm font-medium transition-all"
            >
              + Нэмэх
            </button>
          </div>
        </div>

        {/* Colors */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-medium">Өнгө</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((color, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">
                {color}
                <button onClick={() => removeItem(colors, setColors, i)} className="text-emerald-400/60 hover:text-red-400">✕</button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(colors, setColors, newColor, setNewColor) }}
              placeholder="Шинэ өнгө..."
              className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
            <button
              onClick={() => addItem(colors, setColors, newColor, setNewColor)}
              className="px-4 py-2.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl text-sm font-medium transition-all"
            >
              + Нэмэх
            </button>
          </div>
        </div>

        {/* Stock & Currency */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Нөөц & Валют</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Валют</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="MNT">MNT - Монгол төгрөг (₮)</option>
              <option value="USD">USD - Америк доллар ($)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm">Нөөцийн тоо харуулах</p>
              <p className="text-slate-500 text-xs mt-0.5">Харилцагчид нөөцийн байдлыг харуулах</p>
            </div>
            <button
              onClick={() => setShowStock(!showStock)}
              className={`relative w-12 h-6 rounded-full transition-colors ${showStock ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${showStock ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Бага нөөцийн анхааруулга</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                min={1}
                max={100}
                className="w-24 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
              <span className="text-slate-400 text-sm">ширхэгээс доош үед анхааруулах</span>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          {saved && <span className="text-emerald-400 text-sm">Амжилттай хадгаллаа</span>}
        </div>
      </div>
    </div>
  )
}
