'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toJson } from '@/lib/supabase/json'

interface ShippingZone {
  name: string
  price: number
  estimatedDays: string
  enabled: boolean
}

export default function ShippingSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
  const [freeShippingMinimum, setFreeShippingMinimum] = useState(50000)
  const [zones, setZones] = useState<ShippingZone[]>([
    { name: 'Улаанбаатар хот (төв)', price: 5000, estimatedDays: '1-2 өдөр', enabled: true },
    { name: 'Улаанбаатар хот (захын дүүрэг)', price: 7000, estimatedDays: '1-3 өдөр', enabled: true },
    { name: 'Дархан, Эрдэнэт', price: 10000, estimatedDays: '2-4 өдөр', enabled: true },
    { name: 'Бусад аймаг', price: 15000, estimatedDays: '3-7 өдөр', enabled: false },
  ])

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
        if (s.free_shipping_enabled !== undefined) setFreeShippingEnabled(s.free_shipping_enabled as boolean)
        if (s.free_shipping_minimum) setFreeShippingMinimum(s.free_shipping_minimum as number)
        if (s.zones) setZones(s.zones as ShippingZone[])
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleSave() {
    if (!storeId) return
    setSaving(true)
    setSaved(false)

    await supabase.from('stores').update({
      shipping_settings: toJson({
        free_shipping_enabled: freeShippingEnabled,
        free_shipping_minimum: freeShippingMinimum,
        zones,
      }),
    }).eq('id', storeId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function updateZone(index: number, field: keyof ShippingZone, value: string | number | boolean) {
    const updated = [...zones]
    updated[index] = { ...updated[index], [field]: value }
    setZones(updated)
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('mn-MN').format(price) + '₮'
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
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Хүргэлт</h1>
          <p className="text-slate-400 mt-1">Хүргэлтийн бүс, үнэ тохируулах</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Free Shipping */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">Үнэгүй хүргэлт</h3>
              <p className="text-slate-400 text-sm mt-1">Тодорхой дүнгээс дээш захиалгад үнэгүй хүргэх</p>
            </div>
            <button
              onClick={() => setFreeShippingEnabled(!freeShippingEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${freeShippingEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${freeShippingEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {freeShippingEnabled && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Доод дүн</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={freeShippingMinimum}
                  onChange={(e) => setFreeShippingMinimum(Number(e.target.value))}
                  className="w-40 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
                <span className="text-slate-400 text-sm">₮-ээс дээш захиалгад</span>
              </div>
            </div>
          )}
        </div>

        {/* Shipping Zones */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Хүргэлтийн бүсүүд</h3>

          <div className="space-y-4">
            {zones.map((zone, i) => (
              <div key={i} className={`p-4 border rounded-xl transition-all ${zone.enabled ? 'border-slate-600 bg-slate-700/20' : 'border-slate-700 bg-slate-800/30 opacity-60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium text-sm">{zone.name}</span>
                  <button
                    onClick={() => updateZone(i, 'enabled', !zone.enabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${zone.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${zone.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {zone.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Хүргэлтийн үнэ</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={zone.price}
                          onChange={(e) => updateZone(i, 'price', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                        />
                        <span className="text-slate-400 text-xs">₮</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Хугацаа</label>
                      <input
                        value={zone.estimatedDays}
                        onChange={(e) => updateZone(i, 'estimatedDays', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {freeShippingEnabled && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-emerald-400 text-sm">
                {formatPrice(freeShippingMinimum)}-ээс дээш захиалгад бүх бүсэд үнэгүй хүргэлт хийгдэнэ
              </p>
            </div>
          )}
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
