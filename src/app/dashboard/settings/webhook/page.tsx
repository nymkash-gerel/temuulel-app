'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'
import { resolveStore } from '@/lib/resolve-store'

export default function WebhookSettingsPage() {
  const { allowed, loading: roleLoading } = useRoleGuard(['owner', 'admin'])
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [webhookEvents, setWebhookEvents] = useState({
    new_order: true,
    order_status: true,
    new_message: true,
    new_customer: false,
    low_stock: false,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const store = await resolveStore(supabase, user.id)

      if (store) {
        setStoreId(store.id)
        setApiKey(store.api_key || '')
        setWebhookUrl(store.webhook_url || '')
        setWebhookSecret(store.webhook_secret || '')
        if (store.webhook_events) setWebhookEvents(store.webhook_events as unknown as typeof webhookEvents)
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
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        webhook_events: webhookEvents,
      })
      .eq('id', storeId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function regenerateApiKey() {
    if (!storeId) return
    const newKey = `tk_${crypto.randomUUID().replace(/-/g, '')}`

    await supabase
      .from('stores')
      .update({ api_key: newKey })
      .eq('id', storeId)

    setApiKey(newKey)
    setShowApiKey(true)
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading || roleLoading || !allowed) {
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
          <h1 className="text-2xl font-bold text-white">Webhook & API</h1>
          <p className="text-slate-400 mt-1">Гадаад систем холбох, API түлхүүр</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* API Key */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">API Түлхүүр</h3>
            <button
              onClick={regenerateApiKey}
              className="px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg text-sm transition-all"
            >
              Шинэ түлхүүр үүсгэх
            </button>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 bg-slate-900 rounded-lg text-slate-300 text-sm font-mono overflow-x-auto">
              {apiKey ? (showApiKey ? apiKey : '••••••••••••••••••••••••') : 'Түлхүүр үүсгээгүй байна'}
            </code>
            {apiKey && (
              <>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
                <button
                  onClick={() => copyToClipboard(apiKey, 'api')}
                  className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  {copied === 'api' ? '✓' : '📋'}
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500">API түлхүүрийг нууцалж хадгалаарай. Энэ түлхүүр бүтээгдэхүүн, захиалга удирдахад ашиглагдана.</p>
        </div>

        {/* Messenger Webhook URL */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-medium">Messenger Webhook URL</h3>
          <p className="text-slate-400 text-sm">Facebook App Dashboard-д энэ URL-г оруулна уу</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 bg-slate-900 rounded-lg text-slate-300 text-sm font-mono overflow-x-auto">
              {appUrl}/api/webhook/messenger
            </code>
            <button
              onClick={() => copyToClipboard(`${appUrl}/api/webhook/messenger`, 'messenger')}
              className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              {copied === 'messenger' ? '✓' : '📋'}
            </button>
          </div>
        </div>

        {/* Outgoing Webhook */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Гаралтын Webhook (n8n, Zapier)</h3>
          <p className="text-slate-400 text-sm">Үйл явдал болоход таны системрүү мэдэгдэл илгээнэ</p>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Webhook URL</label>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="https://your-n8n.example.com/webhook/..."
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Secret (HMAC нууцлал)</label>
            <input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="Нууц түлхүүр"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-3">Илгээх үйл явдлууд</label>
            <div className="space-y-3">
              {[
                { key: 'new_order', label: 'Шинэ захиалга', desc: 'Захиалга үүсэхэд' },
                { key: 'order_status', label: 'Захиалгын статус', desc: 'Статус өөрчлөгдөхөд' },
                { key: 'new_message', label: 'Шинэ мессеж', desc: 'Харилцагч мессеж бичихэд' },
                { key: 'new_customer', label: 'Шинэ харилцагч', desc: 'Шинэ харилцагч бүртгэгдэхэд' },
                { key: 'low_stock', label: 'Бага нөөц', desc: 'Бараа дуусч байхад' },
              ].map((event) => (
                <div key={event.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm">{event.label}</p>
                    <p className="text-slate-500 text-xs">{event.desc}</p>
                  </div>
                  <button
                    onClick={() => setWebhookEvents({ ...webhookEvents, [event.key]: !webhookEvents[event.key as keyof typeof webhookEvents] })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      webhookEvents[event.key as keyof typeof webhookEvents] ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      webhookEvents[event.key as keyof typeof webhookEvents] ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              ))}
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
