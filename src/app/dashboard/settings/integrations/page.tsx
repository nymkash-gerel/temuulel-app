'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'

interface StoreData {
  id: string
  name: string
  facebook_page_id: string | null
  facebook_page_name: string | null
  facebook_connected_at: string | null
  instagram_business_account_id: string | null
  instagram_page_name: string | null
  instagram_connected_at: string | null
  api_key: string | null
}

export default function IntegrationsPage() {
  const { allowed, loading: roleLoading } = useRoleGuard(['owner', 'admin'])
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<StoreData | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [messageDismissed, setMessageDismissed] = useState(false)

  // Derive OAuth result message from URL params (Messenger & Instagram)
  const fbMessage = useMemo(() => {
    if (messageDismissed) return null

    const errorMap: Record<string, string> = {
      no_pages: 'Facebook хуудас олдсонгүй. Page-д Admin эрхтэй байгаа эсэхийг шалгана уу.',
      no_instagram: 'Instagram Business аккаунт олдсонгүй. Facebook Page-д Instagram Business аккаунт холбогдсон эсэхийг шалгана уу.',
      exchange_failed: 'Холбогдоход алдаа гарлаа. Дахин оролдоно уу.',
      store_not_found: 'Дэлгүүр олдсонгүй.',
      invalid_state: 'Алдаатай хүсэлт. Дахин оролдоно уу.',
      missing_params: 'Алдаатай хариу ирлээ. Дахин оролдоно уу.',
    }

    if (searchParams.get('fb_success')) {
      return { type: 'success' as const, text: 'Facebook Messenger амжилттай холбогдлоо!' }
    } else if (searchParams.get('ig_success')) {
      return { type: 'success' as const, text: 'Instagram DM амжилттай холбогдлоо!' }
    } else if (searchParams.get('fb_error')) {
      const errorCode = searchParams.get('fb_error') || ''
      return { type: 'error' as const, text: errorMap[errorCode] || decodeURIComponent(errorCode) }
    } else if (searchParams.get('ig_error')) {
      const errorCode = searchParams.get('ig_error') || ''
      return { type: 'error' as const, text: errorMap[errorCode] || decodeURIComponent(errorCode) }
    }
    return null
  }, [searchParams, messageDismissed])

  // Clear URL params after showing message
  useEffect(() => {
    if (fbMessage) {
      window.history.replaceState({}, '', '/dashboard/settings/integrations')
    }
  }, [fbMessage])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (error) {
        console.error('Store load error:', error)
      }

      if (data) {
        setStore({
          id: data.id,
          name: data.name,
          facebook_page_id: data.facebook_page_id ?? null,
          facebook_page_name: data.facebook_page_name ?? null,
          facebook_connected_at: data.facebook_connected_at ?? null,
          instagram_business_account_id: data.instagram_business_account_id ?? null,
          instagram_page_name: data.instagram_page_name ?? null,
          instagram_connected_at: data.instagram_connected_at ?? null,
          api_key: data.api_key ?? null,
        })
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleDisconnectMessenger() {
    if (!store) return
    if (!confirm('Messenger холболтыг салгах уу?')) return
    setDisconnecting('messenger')

    const { error } = await supabase
      .from('stores')
      .update({
        facebook_page_id: null,
        facebook_page_access_token: null,
        facebook_page_name: null,
        facebook_connected_at: null,
      })
      .eq('id', store.id)

    if (!error) {
      setStore({
        ...store,
        facebook_page_id: null,
        facebook_page_name: null,
        facebook_connected_at: null,
      })
    }
    setDisconnecting(null)
  }

  async function handleDisconnectInstagram() {
    if (!store) return
    if (!confirm('Instagram холболтыг салгах уу?')) return
    setDisconnecting('instagram')

    const { error } = await supabase
      .from('stores')
      .update({
        instagram_business_account_id: null,
        instagram_page_name: null,
        instagram_connected_at: null,
      })
      .eq('id', store.id)

    if (!error) {
      setStore({
        ...store,
        instagram_business_account_id: null,
        instagram_page_name: null,
        instagram_connected_at: null,
      })
    }
    setDisconnecting(null)
  }

  function handleConnectMessenger() {
    if (!store) {
      console.error('Store not loaded')
      alert('Дэлгүүрийн мэдээлэл ачаалагдаагүй байна. Хуудсыг дахин ачаална уу.')
      return
    }
    window.location.href = `/api/auth/facebook?store_id=${store.id}`
  }

  function handleConnectInstagram() {
    if (!store) {
      console.error('Store not loaded')
      alert('Дэлгүүрийн мэдээлэл ачаалагдаагүй байна. Хуудсыг дахин ачаална уу.')
      return
    }
    window.location.href = `/api/auth/facebook?store_id=${store.id}&channel=instagram`
  }

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  async function handleRegenerateApiKey() {
    if (!store) return
    if (!confirm('API key шинэчлэх үү? Хуучин key ажиллахаа болино.')) return
    setRegenerating(true)

    const newKey = 'tk_' + crypto.randomUUID().replace(/-/g, '')

    const { error } = await supabase
      .from('stores')
      .update({ api_key: newKey })
      .eq('id', store.id)

    if (!error) {
      setStore({ ...store, api_key: newKey })
      setShowApiKey(true)
    }
    setRegenerating(false)
  }

  const integrations = [
    {
      id: 'messenger',
      name: 'Facebook Messenger',
      icon: '💬',
      description: 'Facebook Page-тай холбож автомат хариулагч ажиллуулах',
      color: 'blue',
      connected: !!store?.facebook_page_id,
      steps: [
        'Facebook Page-д Admin эрхтэй байх',
        'Page-ыг холбох товч дээр дарах',
        'Facebook-руу нэвтрэх',
        'Page сонгох',
        'Зөвшөөрөл өгөх',
      ],
    },
    {
      id: 'instagram',
      name: 'Instagram DM',
      icon: '📷',
      description: 'Instagram Business Account-тай холбож автомат хариулагч ажиллуулах',
      color: 'pink',
      connected: !!store?.instagram_business_account_id,
      steps: [
        'Facebook Page-д Instagram Business холбосон байх',
        'Instagram холбох товч дарах',
        'Facebook-руу нэвтрэх',
        'Instagram аккаунт сонгох',
        'Зөвшөөрөл өгөх',
      ],
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      icon: '📱',
      description: 'WhatsApp Business API холбох',
      color: 'green',
      connected: false,
      comingSoon: true,
    },
  ]

  if (loading || roleLoading || !allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const webhookUrl = `https://api.temuulel.mn/webhook/${store?.id || 'YOUR_STORE_ID'}`
  const embedSnippet = `<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://app.temuulel.mn'}/widget.js" data-store-id="${store?.id || 'YOUR_STORE_ID'}"></script>`

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/settings"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Холболт</h1>
          <p className="text-slate-400 mt-1">Messenger, Instagram, WhatsApp холбох</p>
        </div>
      </div>

      {/* Facebook OAuth result banner */}
      {fbMessage && (
        <div className={`mb-6 p-4 rounded-xl flex items-center justify-between ${
          fbMessage.type === 'success'
            ? 'bg-green-500/20 border border-green-500/30'
            : 'bg-red-500/20 border border-red-500/30'
        }`}>
          <p className={`text-sm ${
            fbMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
          }`}>
            {fbMessage.type === 'success' ? '✓ ' : '✕ '}{fbMessage.text}
          </p>
          <button
            onClick={() => setMessageDismissed(true)}
            className="text-slate-500 hover:text-slate-300 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Integrations */}
      <div className="space-y-6">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className={`bg-slate-800/50 border rounded-2xl p-6 ${
              integration.connected ? 'border-green-500/30' : 'border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  integration.color === 'blue'
                    ? 'bg-blue-500/20'
                    : integration.color === 'pink'
                    ? 'bg-pink-500/20'
                    : 'bg-green-500/20'
                }`}>
                  <span className="text-3xl">{integration.icon}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
                    {integration.connected && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                        Холбогдсон
                      </span>
                    )}
                    {integration.comingSoon && (
                      <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 text-xs font-medium rounded-full">
                        Удахгүй
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 mt-1">{integration.description}</p>
                </div>
              </div>
              {!integration.comingSoon && (
                <button
                  onClick={
                    integration.connected
                      ? undefined
                      : integration.id === 'instagram'
                        ? handleConnectInstagram
                        : handleConnectMessenger
                  }
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                    integration.connected
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : integration.id === 'instagram'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
                  }`}
                >
                  {integration.connected ? 'Тохиргоо' : 'Холбох'}
                </button>
              )}
            </div>

            {/* Connection Steps */}
            {!integration.connected && !integration.comingSoon && integration.steps && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-4">Холбох алхам:</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {integration.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-slate-300">{index + 1}</span>
                      </div>
                      <p className="text-sm text-slate-400">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Info — Messenger */}
            {integration.connected && integration.id === 'messenger' && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Холбогдсон Page:</p>
                    <p className="text-white font-medium mt-1">
                      {store?.facebook_page_name || store?.name || 'Page Name'}
                    </p>
                    {store?.facebook_connected_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        Холбогдсон: {new Date(store.facebook_connected_at).toLocaleDateString('mn-MN')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Page ID:</p>
                    <p className="text-white mt-1 font-mono text-sm">{store?.facebook_page_id}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleConnectMessenger}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
                  >
                    Дахин холбох
                  </button>
                  <button
                    onClick={handleDisconnectMessenger}
                    disabled={disconnecting === 'messenger'}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-sm disabled:opacity-50"
                  >
                    {disconnecting === 'messenger' ? 'Салгаж байна...' : 'Салгах'}
                  </button>
                </div>
              </div>
            )}

            {/* Connected Info — Instagram */}
            {integration.connected && integration.id === 'instagram' && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Холбогдсон аккаунт:</p>
                    <p className="text-white font-medium mt-1">
                      {store?.instagram_page_name || 'Instagram Account'}
                    </p>
                    {store?.instagram_connected_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        Холбогдсон: {new Date(store.instagram_connected_at).toLocaleDateString('mn-MN')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Account ID:</p>
                    <p className="text-white mt-1 font-mono text-sm">{store?.instagram_business_account_id}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleConnectInstagram}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
                  >
                    Дахин холбох
                  </button>
                  <button
                    onClick={handleDisconnectInstagram}
                    disabled={disconnecting === 'instagram'}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-sm disabled:opacity-50"
                  >
                    {disconnecting === 'instagram' ? 'Салгаж байна...' : 'Салгах'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Web Chat Widget Embed */}
      <div className="mt-8 bg-slate-800/50 border border-green-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">💻</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-white">Вэб чат виджет</h3>
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                Бэлэн
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {'Өөрийн вэбсайтад чат виджет нэмэх. Доорх кодыг вэбсайтынхаа <body> таг дотор хуулна уу.'}
            </p>
            <div className="mt-4">
              <code className="block px-4 py-3 bg-slate-900 rounded-lg text-slate-300 text-sm font-mono overflow-x-auto whitespace-pre">
                {embedSnippet}
              </code>
              <button
                onClick={() => handleCopy(embedSnippet, 'embed')}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg transition-all text-sm font-medium"
              >
                {copied === 'embed' ? '✓ Хуулсан' : '📋 Код хуулах'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook Info */}
      <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">🔗</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Webhook URL</h3>
            <p className="text-slate-400 mt-1">
              n8n болон бусад системтэй холбоход ашиглах
            </p>
            <div className="mt-4 flex items-center gap-3">
              <code className="flex-1 px-4 py-3 bg-slate-900 rounded-lg text-slate-300 text-sm font-mono overflow-x-auto">
                {webhookUrl}
              </code>
              <button
                onClick={() => handleCopy(webhookUrl, 'webhook')}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
              >
                {copied === 'webhook' ? '✓' : '📋'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">🔑</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">API Key</h3>
            <p className="text-slate-400 mt-1">
              API-гаар бүтээгдэхүүн оруулах, захиалга авахад ашиглах
            </p>
            <div className="mt-4 flex items-center gap-3">
              <code className="flex-1 px-4 py-3 bg-slate-900 rounded-lg text-slate-300 text-sm font-mono">
                {showApiKey && store?.api_key ? store.api_key : '••••••••••••••••••••••••'}
              </code>
              <button
                onClick={() => {
                  if (showApiKey && store?.api_key) {
                    handleCopy(store.api_key, 'apikey')
                  } else {
                    setShowApiKey(!showApiKey)
                  }
                }}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                title={showApiKey ? 'Хуулах' : 'Харуулах'}
              >
                {copied === 'apikey' ? '✓' : showApiKey ? '📋' : '👁️'}
              </button>
              <button
                onClick={handleRegenerateApiKey}
                disabled={regenerating}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
                title="Шинэчлэх"
              >
                {regenerating ? '...' : '🔄'}
              </button>
            </div>
            {showApiKey && (
              <button
                onClick={() => setShowApiKey(false)}
                className="mt-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                Нуух
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
