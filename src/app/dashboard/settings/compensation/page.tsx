'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Policy {
  id?: string
  complaint_category: string
  name: string
  compensation_type: string
  compensation_value: number
  max_discount_amount: number | null
  valid_days: number
  auto_approve: boolean
  requires_confirmation: boolean
  is_active: boolean
}

const CATEGORIES = [
  { key: 'food_quality', label: 'Хоолны чанар', desc: 'Хүйтэн хоол, амтгүй, чанаргүй' },
  { key: 'wrong_item', label: 'Буруу бараа', desc: 'Буруу захиалга, андуурсан' },
  { key: 'delivery_delay', label: 'Хүргэлт удсан', desc: 'Удсан, хоцорсон, ирээгүй' },
  { key: 'service_quality', label: 'Үйлчилгээний чанар', desc: 'Муу үйлчилгээ, хайхрамжгүй' },
  { key: 'damaged_item', label: 'Гэмтэлтэй бараа', desc: 'Эвдэрсэн, гэмтсэн' },
  { key: 'pricing_error', label: 'Үнийн алдаа', desc: 'Буруу үнэ, илүү авсан' },
  { key: 'staff_behavior', label: 'Ажилтны зан', desc: 'Бүдүүлэг, хүндэтгэлгүй' },
  { key: 'other', label: 'Бусад', desc: 'Дээрх ангилалд багтахгүй' },
]

const COMP_TYPES = [
  { value: 'percent_discount', label: 'Хувийн хөнгөлөлт (%)' },
  { value: 'fixed_discount', label: 'Тогтмол хөнгөлөлт (₮)' },
  { value: 'free_shipping', label: 'Үнэгүй хүргэлт' },
  { value: 'free_item', label: 'Үнэгүй бараа' },
]

export default function CompensationSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [policies, setPolicies] = useState<Map<string, Policy>>(new Map())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }
      setStoreId(store.id)

      const { data } = await supabase
        .from('compensation_policies')
        .select('*')
        .eq('store_id', store.id)

      const map = new Map<string, Policy>()
      if (data) {
        for (const p of data) {
          map.set(p.complaint_category, p as Policy)
        }
      }
      setPolicies(map)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  function getPolicy(category: string): Policy {
    return policies.get(category) || {
      complaint_category: category,
      name: CATEGORIES.find(c => c.key === category)?.label || category,
      compensation_type: 'percent_discount',
      compensation_value: 10,
      max_discount_amount: null,
      valid_days: 30,
      auto_approve: false,
      requires_confirmation: true,
      is_active: false,
    }
  }

  function updatePolicy(category: string, updates: Partial<Policy>) {
    const current = getPolicy(category)
    const updated = { ...current, ...updates }
    const newMap = new Map(policies)
    newMap.set(category, updated)
    setPolicies(newMap)
  }

  async function savePolicy(category: string) {
    if (!storeId) return
    setSaving(category)

    const policy = getPolicy(category)

    const payload = {
      store_id: storeId,
      complaint_category: category as 'food_quality' | 'wrong_item' | 'delivery_delay' | 'service_quality' | 'damaged_item' | 'pricing_error' | 'staff_behavior' | 'other',
      name: policy.name,
      compensation_type: policy.compensation_type as 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'free_item',
      compensation_value: policy.compensation_value,
      max_discount_amount: policy.max_discount_amount,
      valid_days: policy.valid_days,
      auto_approve: policy.auto_approve,
      requires_confirmation: policy.requires_confirmation,
      is_active: policy.is_active,
    }

    if (policy.id) {
      await supabase
        .from('compensation_policies')
        .update(payload)
        .eq('id', policy.id)
    } else {
      const { data } = await supabase
        .from('compensation_policies')
        .upsert(payload, { onConflict: 'store_id,complaint_category' })
        .select('id')
        .single()

      if (data) {
        updatePolicy(category, { id: data.id })
      }
    }

    setSaving(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Нөхөн олговрын тохиргоо</h1>
          <p className="text-slate-400 mt-1">
            Гомдлын ангилал тус бүрд хөнгөлөлтийн бодлого тохируулах
          </p>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-6">
        <p className="text-blue-400 text-sm">
          AI гомдлыг автоматаар ангилж, тохирох хөнгөлөлт санал болгоно. Зөвшөөрөл шаардлагатай бол танд мэдэгдэл илгээнэ.
        </p>
      </div>

      <div className="space-y-4">
        {CATEGORIES.map(cat => {
          const policy = getPolicy(cat.key)
          const isActive = policy.is_active

          return (
            <div
              key={cat.key}
              className={`bg-slate-800/50 border rounded-2xl p-6 transition-all ${
                isActive ? 'border-blue-500/30' : 'border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      updatePolicy(cat.key, { is_active: !isActive })
                    }}
                    className={`w-12 h-6 rounded-full transition-all relative ${
                      isActive ? 'bg-blue-500' : 'bg-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                      isActive ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                  <div>
                    <h3 className="text-white font-medium">{cat.label}</h3>
                    <p className="text-slate-400 text-sm">{cat.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => savePolicy(cat.key)}
                  disabled={saving === cat.key}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {saving === cat.key ? '...' : 'Хадгалах'}
                </button>
              </div>

              {isActive && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Хөнгөлөлтийн төрөл</label>
                    <select
                      value={policy.compensation_type}
                      onChange={(e) => updatePolicy(cat.key, { compensation_type: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    >
                      {COMP_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {(policy.compensation_type === 'percent_discount' || policy.compensation_type === 'fixed_discount') && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">
                        {policy.compensation_type === 'percent_discount' ? 'Хувь (%)' : 'Дүн (₮)'}
                      </label>
                      <input
                        type="number"
                        value={policy.compensation_value}
                        onChange={(e) => updatePolicy(cat.key, { compensation_value: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  )}

                  {policy.compensation_type === 'percent_discount' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">Дээд хязгаар (₮)</label>
                      <input
                        type="number"
                        value={policy.max_discount_amount || ''}
                        onChange={(e) => updatePolicy(cat.key, { max_discount_amount: e.target.value ? Number(e.target.value) : null })}
                        placeholder="Хязгааргүй"
                        className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Хүчинтэй хоног</label>
                    <input
                      type="number"
                      value={policy.valid_days}
                      onChange={(e) => updatePolicy(cat.key, { valid_days: Number(e.target.value) || 30 })}
                      className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-4 col-span-full">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policy.auto_approve}
                        onChange={(e) => updatePolicy(cat.key, {
                          auto_approve: e.target.checked,
                          requires_confirmation: e.target.checked ? false : policy.requires_confirmation,
                        })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500"
                      />
                      <span className="text-slate-300 text-sm">Автомат зөвшөөрөл (AI шууд амлана)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policy.requires_confirmation}
                        onChange={(e) => updatePolicy(cat.key, {
                          requires_confirmation: e.target.checked,
                          auto_approve: e.target.checked ? false : policy.auto_approve,
                        })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500"
                      />
                      <span className="text-slate-300 text-sm">Зөвшөөрөл шаардлагатай (танд мэдэгдэл илгээнэ)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
