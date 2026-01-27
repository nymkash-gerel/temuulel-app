'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ChatbotSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Settings
  const [aiAutoReply, setAiAutoReply] = useState(true)
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Сайн байна уу! 😊 Манай дэлгүүрт тавтай морил. Танд юугаар туслах вэ?'
  )
  const [awayMessage, setAwayMessage] = useState(
    'Одоогоор ажлын бус цагт байна. Таны мессежийг хүлээн авсан бөгөөд удахгүй хариулах болно.'
  )
  const [quickReplies, setQuickReplies] = useState<string[]>([
    'Сайн байна уу! Танд юугаар туслах вэ?',
    'Баярлалаа, захиалга баталгаажлаа.',
    'Уучлаарай, одоогоор нөөцөд байхгүй байна.',
    'Хүргэлт 1-3 хоногт хийгдэнэ.',
    'Та утасны дугаараа үлдээнэ үү?',
  ])
  const [newQuickReply, setNewQuickReply] = useState('')
  const [tone, setTone] = useState('friendly')
  const [language, setLanguage] = useState('mongolian')
  const [showProductPrices, setShowProductPrices] = useState(true)
  const [maxProductResults, setMaxProductResults] = useState(5)
  const [autoHandoff, setAutoHandoff] = useState(true)
  const [handoffKeywords, setHandoffKeywords] = useState('менежер, хүн, оператор, гомдол')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id, ai_auto_reply, chatbot_settings')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        setAiAutoReply(store.ai_auto_reply ?? true)
        const settings = (store.chatbot_settings || {}) as Record<string, unknown>
        if (settings.welcome_message) setWelcomeMessage(settings.welcome_message as string)
        if (settings.away_message) setAwayMessage(settings.away_message as string)
        if (settings.quick_replies) setQuickReplies(settings.quick_replies as string[])
        if (settings.tone) setTone(settings.tone as string)
        if (settings.language) setLanguage(settings.language as string)
        if (settings.show_product_prices !== undefined) setShowProductPrices(settings.show_product_prices as boolean)
        if (settings.max_product_results) setMaxProductResults(settings.max_product_results as number)
        if (settings.auto_handoff !== undefined) setAutoHandoff(settings.auto_handoff as boolean)
        if (settings.handoff_keywords) setHandoffKeywords(settings.handoff_keywords as string)
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
        ai_auto_reply: aiAutoReply,
        chatbot_settings: {
          welcome_message: welcomeMessage,
          away_message: awayMessage,
          quick_replies: quickReplies,
          tone,
          language,
          show_product_prices: showProductPrices,
          max_product_results: maxProductResults,
          auto_handoff: autoHandoff,
          handoff_keywords: handoffKeywords,
        },
      })
      .eq('id', storeId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function addQuickReply() {
    if (!newQuickReply.trim()) return
    setQuickReplies([...quickReplies, newQuickReply.trim()])
    setNewQuickReply('')
  }

  function removeQuickReply(index: number) {
    setQuickReplies(quickReplies.filter((_, i) => i !== index))
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
          <h1 className="text-2xl font-bold text-white">Chatbot тохиргоо</h1>
          <p className="text-slate-400 mt-1">AI хариултууд, мессежүүд тохируулах</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Auto Reply Toggle */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">AI автомат хариулт</h3>
              <p className="text-slate-400 text-sm mt-1">
                Ирсэн мессежүүдэд AI автоматаар хариулна
              </p>
            </div>
            <button
              onClick={() => setAiAutoReply(!aiAutoReply)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                aiAutoReply ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  aiAutoReply ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tone & Language */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Хэл & Өнгө аяс</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Хариултын өнгө аяс</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'friendly', label: 'Найрсаг', icon: '😊' },
                { value: 'professional', label: 'Мэргэжлийн', icon: '💼' },
                { value: 'casual', label: 'Энгийн', icon: '👋' },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`p-3 rounded-xl border text-sm text-center transition-all ${
                    tone === t.value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="text-xl block mb-1">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Хэл</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="mongolian">Монгол</option>
              <option value="english">English</option>
              <option value="both">Хоёулаа</option>
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Мессежүүд</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Welcome мессеж</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
              placeholder="Эхний мэндчилгээ мессеж..."
            />
            <p className="text-xs text-slate-500 mt-1">Шинэ харилцагч мессеж бичихэд автоматаар илгээгдэнэ</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Away мессеж</label>
            <textarea
              value={awayMessage}
              onChange={(e) => setAwayMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
              placeholder="Ажлын бус цагийн мессеж..."
            />
          </div>
        </div>

        {/* Quick Replies */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-medium">Түргэн хариултууд</h3>
          <p className="text-slate-400 text-sm">Чат хуудаснаас нэг дарж илгээх боломжтой хариултууд</p>

          <div className="space-y-2">
            {quickReplies.map((reply, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-300">
                  {reply}
                </span>
                <button
                  onClick={() => removeQuickReply(i)}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={newQuickReply}
              onChange={(e) => setNewQuickReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addQuickReply() }}
              placeholder="Шинэ хариулт нэмэх..."
              className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
            <button
              onClick={addQuickReply}
              disabled={!newQuickReply.trim()}
              className="px-4 py-2.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              + Нэмэх
            </button>
          </div>
        </div>

        {/* Product Display */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Бүтээгдэхүүн харуулалт</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm">Үнэ харуулах</p>
              <p className="text-slate-500 text-xs mt-0.5">Бүтээгдэхүүний үнийг хариултад оруулах</p>
            </div>
            <button
              onClick={() => setShowProductPrices(!showProductPrices)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                showProductPrices ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  showProductPrices ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              Хамгийн ихдээ харуулах бүтээгдэхүүн
            </label>
            <select
              value={maxProductResults}
              onChange={(e) => setMaxProductResults(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value={3}>3 бүтээгдэхүүн</option>
              <option value={5}>5 бүтээгдэхүүн</option>
              <option value={10}>10 бүтээгдэхүүн</option>
            </select>
          </div>
        </div>

        {/* Handoff */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Хүн рүү шилжүүлэх</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm">Автомат шилжүүлэг</p>
              <p className="text-slate-500 text-xs mt-0.5">Тодорхой түлхүүр үгс ашиглахад хүн рүү шилжүүлэх</p>
            </div>
            <button
              onClick={() => setAutoHandoff(!autoHandoff)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoHandoff ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  autoHandoff ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {autoHandoff && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Түлхүүр үгс (таслалаар тусгаарлах)</label>
              <input
                value={handoffKeywords}
                onChange={(e) => setHandoffKeywords(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                placeholder="менежер, хүн, оператор"
              />
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
          {saved && (
            <span className="text-emerald-400 text-sm">Амжилттай хадгаллаа</span>
          )}
        </div>
      </div>
    </div>
  )
}
