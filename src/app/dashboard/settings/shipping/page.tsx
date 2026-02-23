'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { toJson } from '@/lib/supabase/json'
import { INTERCITY_CITIES } from '@/lib/delivery-fee-calculator'

// Leaflet can't SSR — load dynamically
const DeliveryZoneMap = dynamic(() => import('@/components/DeliveryZoneMap'), { ssr: false })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InnerCitySettings {
  enabled: boolean
  price: number
  estimated_hours: string
  districts: string[]
}

interface IntercitySettings {
  enabled: boolean
  cities: string[]
}

interface FreeShippingSettings {
  enabled: boolean
  minimum: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShippingSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [freeShipping, setFreeShipping] = useState<FreeShippingSettings>({
    enabled: false,
    minimum: 50000,
  })
  const [innerCity, setInnerCity] = useState<InnerCitySettings>({
    enabled: true,
    price: 5000,
    estimated_hours: '2–4 цаг',
    districts: ['Сүхбаатар', 'Чингэлтэй', 'Баянгол', 'Хан-Уул', 'Баянзүрх', 'Сонгинохайрхан'],
  })
  const [intercity, setIntercity] = useState<IntercitySettings>({
    enabled: true,
    cities: ['Дархан', 'Эрдэнэт', 'Налайх'],
  })

  // ---- Load ----

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id, shipping_settings')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        const s = (store.shipping_settings || {}) as Record<string, unknown>

        // Load free shipping
        if (s.free_shipping_enabled !== undefined || s.freeShipping) {
          const fs = s.freeShipping as Record<string, unknown> | undefined
          setFreeShipping({
            enabled: (fs?.enabled ?? s.free_shipping_enabled ?? false) as boolean,
            minimum: (fs?.minimum ?? s.free_shipping_minimum ?? 50000) as number,
          })
        }

        // Load inner city settings (new format)
        if (s.inner_city) {
          setInnerCity(s.inner_city as InnerCitySettings)
        }

        // Load intercity settings (new format)
        if (s.intercity) {
          setIntercity(s.intercity as IntercitySettings)
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  // ---- Save ----

  async function handleSave() {
    if (!storeId) return
    setSaving(true)
    setSaved(false)

    await supabase.from('stores').update({
      shipping_settings: toJson({
        freeShipping,
        inner_city: innerCity,
        intercity,
        // legacy compat
        free_shipping_enabled: freeShipping.enabled,
        free_shipping_minimum: freeShipping.minimum,
      }),
    }).eq('id', storeId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleDistrictsChange = useCallback((districts: string[]) => {
    setInnerCity((prev) => ({ ...prev, districts }))
  }, [])

  function toggleCity(city: string) {
    setIntercity((prev) => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter((c) => c !== city)
        : [...prev.cities, city],
    }))
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
        <Link
          href="/dashboard/settings"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Хүргэлт</h1>
          <p className="text-slate-400 mt-1">Хүргэлтийн бүс, үнэ тохируулах</p>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── Free Shipping ───────────────────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">Үнэгүй хүргэлт</h3>
              <p className="text-slate-400 text-sm mt-1">
                Тодорхой дүнгээс дээш захиалгад үнэгүй хүргэх
              </p>
            </div>
            <button
              onClick={() => setFreeShipping((p) => ({ ...p, enabled: !p.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${freeShipping.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${freeShipping.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {freeShipping.enabled && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Доод дүн</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={freeShipping.minimum}
                  onChange={(e) => setFreeShipping((p) => ({ ...p, minimum: Number(e.target.value) }))}
                  className="w-40 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
                <span className="text-slate-400 text-sm">₮-ээс дээш захиалгад</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Inner City (UB) ─────────────────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">🏙️ Хотын хүргэлт (УБ)</h3>
              <p className="text-slate-400 text-sm mt-1">
                Жолооч хүргэнэ — хаяг дүүрэг сонгоно
              </p>
            </div>
            <button
              onClick={() => setInnerCity((p) => ({ ...p, enabled: !p.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${innerCity.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${innerCity.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {innerCity.enabled && (
            <>
              {/* Price + Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Хүргэлтийн үнэ</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={innerCity.price}
                      onChange={(e) => setInnerCity((p) => ({ ...p, price: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <span className="text-slate-400 text-xs">₮</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Хугацаа</label>
                  <input
                    value={innerCity.estimated_hours}
                    onChange={(e) => setInnerCity((p) => ({ ...p, estimated_hours: e.target.value }))}
                    placeholder="2–4 цаг"
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Map */}
              <div>
                <label className="block text-sm text-slate-300 mb-3">
                  Хамрах дүүрэг{' '}
                  <span className="text-slate-500 font-normal">
                    ({innerCity.districts.length} сонгогдсон)
                  </span>
                </label>
                <DeliveryZoneMap
                  selected={innerCity.districts}
                  onChange={handleDistrictsChange}
                />
              </div>

              {/* Info box */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-blue-300 text-sm">
                  💳 Хэрэглэгч захиалга хийхэд{' '}
                  <strong>{formatPrice(innerCity.price)}</strong> хүргэлтийн үнэ тооцогдоно
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Intercity (Bus / Post) ───────────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">🚌 Хотоор хоорондын хүргэлт</h3>
              <p className="text-slate-400 text-sm mt-1">
                Жолооч автобус/шуудан руу өгнө — хэрэглэгч хүлээн авахдаа тээврийн үнэ төлнө
              </p>
            </div>
            <button
              onClick={() => setIntercity((p) => ({ ...p, enabled: !p.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${intercity.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${intercity.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {intercity.enabled && (
            <>
              <div>
                <label className="block text-sm text-slate-300 mb-3">
                  Хүргэх хотууд{' '}
                  <span className="text-slate-500 font-normal">
                    ({intercity.cities.length} сонгогдсон)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTERCITY_CITIES.map((city) => {
                    const on = intercity.cities.includes(city)
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => toggleCity(city)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                          on
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                            : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
                        }`}
                      >
                        {city}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Info box */}
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-1">
                <p className="text-orange-300 text-sm font-medium">
                  📦 Тээврийн үнэ шуудангийн газраас тогтоогдоно (жин, хэмжээнээс хамаарна)
                </p>
                <p className="text-orange-200/70 text-xs">
                  Chatbot-д харуулах мессеж: &ldquo;Тээврийн үнэ хүлээн авахдаа төлнө. Асуулт байвал дэлгүүртэй холбогдоно уу.&rdquo;
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Save ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          {saved && <span className="text-emerald-400 text-sm">Амжилттай хадгаллаа ✓</span>}
        </div>
      </div>
    </div>
  )
}
