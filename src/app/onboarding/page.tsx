'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BUSINESS_TYPES = [
  { value: 'ecommerce', label: 'Онлайн дэлгүүр', icon: '🛍️' },
  { value: 'restaurant', label: 'Ресторан', icon: '🍜' },
  { value: 'beauty_salon', label: 'Гоо сайхан', icon: '💇' },
  { value: 'coffee_shop', label: 'Кофе шоп', icon: '☕' },
  { value: 'fitness', label: 'Фитнесс', icon: '💪' },
  { value: 'education', label: 'Сургалт', icon: '📚' },
  { value: 'dental_clinic', label: 'Шүдний эмнэлэг', icon: '🦷' },
  { value: 'hospital', label: 'Эмнэлэг', icon: '🏥' },
  { value: 'real_estate', label: 'Үл хөдлөх', icon: '🏠' },
  { value: 'hotel', label: 'Зочид буудал', icon: '🏨' },
  { value: 'camping_guesthouse', label: 'Кемпинг', icon: '⛺' },
  { value: 'other', label: 'Бусад', icon: '🏢' },
]

const STEPS = ['Бизнес төрөл', 'Дэлгүүрийн мэдээлэл', 'Facebook холбох', 'Бэлэн!']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Business type
  const [businessType, setBusinessType] = useState('')

  // Step 2: Store info
  const [storeName, setStoreName] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [storeAddress, setStoreAddress] = useState('')

  // Step 3: Facebook (optional)
  const [fbPageId, setFbPageId] = useState('')
  const [fbToken, setFbToken] = useState('')

  async function createStore() {
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Нэвтрээгүй байна'); setSaving(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: store, error: storeErr } = await (supabase as any)
        .from('stores')
        .insert({
          name: storeName.trim(),
          business_type: businessType,
          phone: storePhone.trim() || null,
          address: storeAddress.trim() || null,
          facebook_page_id: fbPageId.trim() || null,
          facebook_page_access_token: fbToken.trim() || null,
          ai_auto_reply: true,
        })
        .select('id')
        .single()

      if (storeErr || !store) {
        setError(storeErr?.message || 'Дэлгүүр үүсгэж чадсангүй')
        setSaving(false)
        return
      }

      // Add user as store member (owner)
      await supabase.from('store_members').insert({
        store_id: store.id,
        user_id: user.id,
        role: 'owner',
      })

      // Go to dashboard
      router.push('/dashboard')
    } catch {
      setError('Алдаа гарлаа')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-blue-500' : 'bg-slate-700'}`} />
              <p className={`text-xs mt-1.5 ${i <= step ? 'text-blue-400' : 'text-slate-600'}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          {/* Step 0: Business Type */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Бизнесийн төрлөө сонгоно уу</h2>
              <p className="text-slate-400 text-sm mb-6">Энэ нь таны dashboard-ыг тохируулахад ашиглагдана</p>
              <div className="grid grid-cols-3 gap-3">
                {BUSINESS_TYPES.map(bt => (
                  <button
                    key={bt.value}
                    onClick={() => setBusinessType(bt.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      businessType === bt.value
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-2xl mb-1">{bt.icon}</div>
                    <div className="text-xs">{bt.label}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!businessType}
                className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
              >
                Үргэлжлүүлэх
              </button>
            </div>
          )}

          {/* Step 1: Store info */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Дэлгүүрийн мэдээлэл</h2>
              <p className="text-slate-400 text-sm mb-6">Хэрэглэгчид харагдах үндсэн мэдээлэл</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Дэлгүүрийн нэр *</label>
                  <input
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder="Монгол Маркет"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Утас</label>
                  <input
                    value={storePhone}
                    onChange={e => setStorePhone(e.target.value)}
                    placeholder="99001122"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Хаяг</label>
                  <input
                    value={storeAddress}
                    onChange={e => setStoreAddress(e.target.value)}
                    placeholder="УБ, СБД, 1-р хороо"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(0)} className="px-6 py-3 bg-slate-700 text-white rounded-xl">Буцах</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!storeName.trim()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  Үргэлжлүүлэх
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Facebook */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Facebook Page холбох</h2>
              <p className="text-slate-400 text-sm mb-6">Messenger/Instagram-аар AI чатбот ажиллуулахад шаардлагатай. Дараа нь нэмж болно.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Facebook Page ID</label>
                  <input
                    value={fbPageId}
                    onChange={e => setFbPageId(e.target.value)}
                    placeholder="123456789012345"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Page Access Token</label>
                  <input
                    value={fbToken}
                    onChange={e => setFbToken(e.target.value)}
                    placeholder="EAA..."
                    type="password"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="px-6 py-3 bg-slate-700 text-white rounded-xl">Буцах</button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
                >
                  {fbPageId ? 'Үргэлжлүүлэх' : 'Алгасах'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-white mb-2">Бэлэн!</h2>
              <p className="text-slate-400 mb-6">
                &quot;{storeName}&quot; дэлгүүр үүсгэж, AI чатбот тохируулахад бэлэн боллоо.
              </p>
              <button
                onClick={createStore}
                disabled={saving}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
              >
                {saving ? 'Үүсгэж байна...' : 'Дэлгүүр үүсгэх'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
