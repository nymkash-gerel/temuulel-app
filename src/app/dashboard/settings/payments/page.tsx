'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveStore } from '@/lib/resolve-store'

export default function PaymentSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [qpayEnabled, setQpayEnabled] = useState(false)
  const [qpayMerchantId, setQpayMerchantId] = useState('')
  const [bankTransferEnabled, setBankTransferEnabled] = useState(false)
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [cashOnDelivery, setCashOnDelivery] = useState(true)
  // Delivery payment timing
  const [innerCityCod, setInnerCityCod] = useState(true)      // true = collect at delivery
  const [intercityPrepay, setIntercityPrepay] = useState(true) // true = collect before dispatch

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const store = await resolveStore(supabase, user.id)

      if (store) {
        setStoreId(store.id)
        const s = (store.payment_settings || {}) as Record<string, unknown>
        setQpayEnabled((s.qpay_enabled as boolean) ?? false)
        setQpayMerchantId((s.qpay_merchant_id as string) || '')
        setBankTransferEnabled((s.bank_transfer_enabled as boolean) ?? false)
        setBankName((s.bank_name as string) || '')
        setBankAccount((s.bank_account as string) || '')
        setBankHolder((s.bank_holder as string) || '')
        setCashOnDelivery((s.cash_on_delivery as boolean) ?? true)
        setInnerCityCod((s.inner_city_cod as boolean) ?? true)
        setIntercityPrepay((s.intercity_prepay as boolean) ?? true)
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
      payment_settings: {
        qpay_enabled: qpayEnabled,
        qpay_merchant_id: qpayMerchantId,
        bank_transfer_enabled: bankTransferEnabled,
        bank_name: bankName,
        bank_account: bankAccount,
        bank_holder: bankHolder,
        cash_on_delivery: cashOnDelivery,
        inner_city_cod: innerCityCod,
        intercity_prepay: intercityPrepay,
      },
    }).eq('id', storeId)

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
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Төлбөр хүлээн авах</h1>
          <p className="text-slate-400 mt-1">QPay, банкны данс, бэлэн мөнгө</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* QPay */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">📱</span>
              </div>
              <div>
                <h3 className="text-white font-medium">QPay</h3>
                <p className="text-slate-400 text-sm">QR код уншуулж төлөх</p>
              </div>
            </div>
            <button
              onClick={() => setQpayEnabled(!qpayEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${qpayEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${qpayEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {qpayEnabled && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">QPay Merchant ID</label>
              <input
                value={qpayMerchantId}
                onChange={(e) => setQpayMerchantId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                placeholder="QPay merchant ID оруулна уу"
              />
            </div>
          )}
        </div>

        {/* Bank Transfer */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">🏦</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Дансаар шилжүүлэг</h3>
                <p className="text-slate-400 text-sm">Банкны данс руу шилжүүлэх</p>
              </div>
            </div>
            <button
              onClick={() => setBankTransferEnabled(!bankTransferEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${bankTransferEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${bankTransferEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {bankTransferEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Банкны нэр</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">Сонгоно уу</option>
                  <option value="khan">Хаан банк</option>
                  <option value="golomt">Голомт банк</option>
                  <option value="tdb">Худалдаа хөгжлийн банк</option>
                  <option value="state">Төрийн банк</option>
                  <option value="bogd">Богд банк</option>
                  <option value="capitron">Капитрон банк</option>
                  <option value="xac">Хас банк</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Дансны дугаар</label>
                <input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Дансны дугаар"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Данс эзэмшигчийн нэр</label>
                <input
                  value={bankHolder}
                  onChange={(e) => setBankHolder(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Нэр"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cash on Delivery */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">💵</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Бэлнээр төлөх</h3>
                <p className="text-slate-400 text-sm">Хүргэлтийн үед бэлнээр төлөх</p>
              </div>
            </div>
            <button
              onClick={() => setCashOnDelivery(!cashOnDelivery)}
              className={`relative w-12 h-6 rounded-full transition-colors ${cashOnDelivery ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${cashOnDelivery ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* ── Delivery Payment Timing ──────────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-white font-medium">🚚 Хүргэлтийн төлбөр авах цаг</h3>
            <p className="text-slate-400 text-sm mt-1">
              Жолооч хэзээ төлбөр авах вэ? Telegram-д хүргэлт дуусмагц жолоочид мэдэгдэл ирнэ.
            </p>
          </div>

          {/* Inner city */}
          <div className={`p-4 border rounded-xl transition-all ${innerCityCod ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-600 bg-slate-700/20'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-white text-sm font-medium">🏙️ Хотын хүргэлт</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {innerCityCod
                    ? 'Жолооч хүргэж өгөхдөө төлбөр авна (COD)'
                    : 'Харилцагч захиалахаасаа өмнө урьдчилж төлнө'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400">{innerCityCod ? 'Хүргэлт дээр' : 'Урьдчилж'}</span>
                <button
                  onClick={() => setInnerCityCod(!innerCityCod)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${innerCityCod ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${innerCityCod ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            {innerCityCod && (
              <p className="mt-3 text-xs text-emerald-400/80">
                ✅ Жолооч хүргэсний дараа Telegram-д &ldquo;Төлбөр авлаа / Дараа / Татгалзав&rdquo; товч гарна
              </p>
            )}
          </div>

          {/* Intercity */}
          <div className={`p-4 border rounded-xl transition-all ${intercityPrepay ? 'border-orange-500/30 bg-orange-500/5' : 'border-slate-600 bg-slate-700/20'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-white text-sm font-medium">🚌 Хотоор хоорондын хүргэлт</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {intercityPrepay
                    ? 'Жолооч бараа хүлээж авахаасаа өмнө төлбөр авна'
                    : 'Харилцагч хүлээн авахдаа шуудангийн газарт төлнө'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400">{intercityPrepay ? 'Урьдчилж' : 'Хүлээн авахад'}</span>
                <button
                  onClick={() => setIntercityPrepay(!intercityPrepay)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${intercityPrepay ? 'bg-orange-500' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${intercityPrepay ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            {intercityPrepay && (
              <p className="mt-3 text-xs text-orange-400/80">
                ✅ Wizard-д &ldquo;Урьдчилж төлбөр авсан уу?&rdquo; гэсэн алхам гарна
              </p>
            )}
          </div>

          <div className="p-3 bg-slate-700/30 border border-slate-600/50 rounded-xl">
            <p className="text-slate-400 text-xs leading-relaxed">
              💡 <strong className="text-slate-300">Зөвлөгөө:</strong> Ихэнх онлайн дэлгүүр хотын хүргэлтэд COD ашигладаг.
              Хотоор хоорондын хүргэлтэд урьдчилж авах нь алдагдал багасгана — жолооч барааг автобусанд өгсний дараа нэхэхэд хэцүү.
            </p>
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
