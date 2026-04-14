'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Branding {
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  hide_temuulel_brand?: boolean
  widget_title?: string
  widget_subtitle?: string
}

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding>({})
  const [customDomain, setCustomDomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/branding').then(r => r.json()).then(d => {
      setBranding(d.branding || {})
      setCustomDomain(d.custom_domain || '')
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true); setSuccess(false)
    const res = await fetch('/api/branding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branding, custom_domain: customDomain || null }),
    })
    if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000) }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" /></div>

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard/settings" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">←</Link>
          <h1 className="text-2xl font-bold text-white">🎨 White-label брэнд</h1>
        </div>

        {success && <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">✅ Хадгалагдлаа</div>}

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Лого URL</label>
            <input
              value={branding.logo_url || ''}
              onChange={e => setBranding({ ...branding, logo_url: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Үндсэн өнгө</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.primary_color || '#3b82f6'}
                  onChange={e => setBranding({ ...branding, primary_color: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  value={branding.primary_color || ''}
                  onChange={e => setBranding({ ...branding, primary_color: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Туслах өнгө</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.secondary_color || '#06b6d4'}
                  onChange={e => setBranding({ ...branding, secondary_color: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  value={branding.secondary_color || ''}
                  onChange={e => setBranding({ ...branding, secondary_color: e.target.value })}
                  placeholder="#06b6d4"
                  className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Widget гарчиг</label>
            <input
              value={branding.widget_title || ''}
              onChange={e => setBranding({ ...branding, widget_title: e.target.value })}
              placeholder="Бид тантай ярилцах болно"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Custom domain (Pro)</label>
            <input
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              placeholder="chat.mystore.mn"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">DNS A record-оо Vercel-рүү чиглүүлнэ үү</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={branding.hide_temuulel_brand || false}
              onChange={e => setBranding({ ...branding, hide_temuulel_brand: e.target.checked })}
              className="w-5 h-5 accent-blue-500 rounded"
            />
            <span className="text-sm text-slate-300">"Powered by Temuulel" брэнд нуух (Pro)</span>
          </label>

          <button onClick={save} disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50">
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
        </div>
      </div>
    </div>
  )
}
