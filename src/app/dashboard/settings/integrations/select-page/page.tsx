'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'

interface PageOption {
  id: string
  name: string
  token: string
  page_id?: string // For Instagram: the linked Facebook Page ID
}

// Browser-compatible base64url decoder
function base64urlDecode(str: string): string {
  // Convert base64url to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if needed
  const padding = base64.length % 4
  if (padding) {
    base64 += '='.repeat(4 - padding)
  }
  // Decode using browser's atob
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  )
}

export default function SelectPagePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pages = useMemo<PageOption[]>(() => {
    const pagesParam = searchParams.get('pages')
    if (!pagesParam) return []
    try {
      return JSON.parse(base64urlDecode(pagesParam))
    } catch (e) {
      console.error('Failed to decode pages:', e)
      return []
    }
  }, [searchParams])

  const storeId = searchParams.get('store_id')
  const channel = searchParams.get('channel') || 'messenger'
  const isInstagram = channel === 'instagram'

  async function handleSelect(page: PageOption) {
    if (selecting) return
    setSelecting(page.id)
    setError(null)

    try {
      const body: Record<string, string | undefined> = {
        store_id: storeId || undefined,
        page_id: isInstagram ? page.page_id : page.id,
        page_name: page.name,
        page_access_token: page.token,
      }

      if (isInstagram) {
        body.channel = 'instagram'
        body.instagram_account_id = page.id
      }

      const res = await fetch('/api/auth/facebook/select-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Select page error:', res.status, errData)
        throw new Error(errData.error || errData.details || 'Failed to connect page')
      }

      const successParam = isInstagram ? 'ig_success' : 'fb_success'
      router.push(`/dashboard/settings/integrations?${successParam}=true`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Select page catch:', message)
      setError(`Хуудас холбоход алдаа гарлаа: ${message}`)
      setSelecting(null)
    }
  }

  if (!pages.length || !storeId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg">Хуудас олдсонгүй</p>
          <button
            onClick={() => router.push('/dashboard/settings/integrations')}
            className="mt-4 px-6 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
          >
            Буцах
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 ${isInstagram ? 'bg-pink-500/20' : 'bg-blue-500/20'} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            <span className="text-3xl">{isInstagram ? '📷' : '📘'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isInstagram ? 'Instagram аккаунт сонгох' : 'Facebook хуудас сонгох'}
          </h1>
          <p className="text-slate-400 mt-2">
            {isInstagram
              ? 'Instagram DM чатботыг холбох аккаунтаа сонгоно уу'
              : 'Messenger чатботыг холбох хуудсаа сонгоно уу'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => handleSelect(page)}
              disabled={selecting !== null}
              className={`w-full p-4 bg-slate-800 border rounded-2xl text-left transition-all ${
                selecting === page.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 hover:border-slate-500 hover:bg-slate-700/50'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <span className="text-lg">📄</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{page.name}</p>
                    <p className="text-slate-500 text-xs">ID: {page.id}</p>
                  </div>
                </div>
                {selecting === page.id ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-slate-400 text-sm">Сонгох →</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/dashboard/settings/integrations')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Цуцлах
          </button>
        </div>
      </div>
    </div>
  )
}
