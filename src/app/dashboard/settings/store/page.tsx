'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface StoreData {
  id: string
  name: string
  description: string | null
  phone: string | null
  email: string | null
  address: string | null
  business_type: string | null
  logo_url: string | null
  website: string | null
}

export default function StoreSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [store, setStore] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [website, setWebsite] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (data) {
        setStore(data)
        setName(data.name || '')
        setDescription(data.description || '')
        setPhone(data.phone || '')
        setEmail(data.email || '')
        setAddress(data.address || '')
        setBusinessType(data.business_type || '')
        setWebsite(data.website || '')
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleSave() {
    if (!store) return
    setSaving(true)
    setSaved(false)

    await supabase
      .from('stores')
      .update({
        name,
        description,
        phone,
        email,
        address,
        business_type: businessType,
        website,
      })
      .eq('id', store.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
          <h1 className="text-2xl font-bold text-white">Дэлгүүрийн мэдээлэл</h1>
          <p className="text-slate-400 mt-1">Нэр, холбоо барих, хаяг</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Үндсэн мэдээлэл</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Дэлгүүрийн нэр</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="Таны дэлгүүрийн нэр"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Тайлбар</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
              placeholder="Дэлгүүрийн товч тайлбар"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Бизнесийн төрөл</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Сонгоно уу</option>
              <option value="ecommerce">Онлайн дэлгүүр</option>
              <option value="clothing">Хувцас</option>
              <option value="electronics">Электроник</option>
              <option value="food">Хүнс</option>
              <option value="restaurant">Ресторан</option>
              <option value="beauty_salon">Гоо сайхны салон</option>
              <option value="hospital">Эмнэлэг</option>
              <option value="dental_clinic">Шүдний эмнэлэг</option>
              <option value="fitness">Фитнесс</option>
              <option value="education">Боловсрол</option>
              <option value="coffee_shop">Кофе шоп</option>
              <option value="real_estate">Үл хөдлөх</option>
              <option value="camping_guesthouse">Кемпинг / Зочид буудал</option>
              <option value="services">Үйлчилгээ</option>
              <option value="sports">Спорт</option>
              <option value="home">Гэр ахуй</option>
              <option value="other">Бусад</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Вэбсайт</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="https://example.mn"
            />
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Холбоо барих</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Утас</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="+976 9999 9999"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Имэйл</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="info@example.mn"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Хаяг</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
              placeholder="Улаанбаатар хот, ..."
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          {saved && (
            <span className="text-emerald-400 text-sm">Амжилттай хадгаллаа</span>
          )}
        </div>
      </div>
    </div>
  )
}
