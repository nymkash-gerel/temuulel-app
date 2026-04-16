'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function QRCodePage() {
  const [storeId, setStoreId] = useState('')
  const [storeName, setStoreName] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    (async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data: member } = await sb.from('store_members').select('stores(id, name)').eq('user_id', user.id).single()
      if (member?.stores) {
        const s = Array.isArray(member.stores) ? member.stores[0] : member.stores
        setStoreId(s.id)
        setStoreName(s.name)
      }
    })()
  }, [])

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const widgetUrl = `${appUrl}/chat/${storeId}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(widgetUrl)}&color=3b82f6&bgcolor=ffffff&margin=10`

  function copyLink() {
    navigator.clipboard.writeText(widgetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!storeId) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Уншиж байна...</div>

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard/settings" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">←</Link>
          <h1 className="text-2xl font-bold text-white">📱 QR код</h1>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-slate-400 mb-4">Хэрэглэгчид утсаараа скан хийгээд чатбот ашиглана</p>
          <h2 className="text-xl font-bold text-white mb-6">{storeName}</h2>

          <div className="inline-block bg-white p-4 rounded-2xl">
            <img src={qrUrl} alt="QR Code" width={400} height={400} className="w-full max-w-xs" />
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex gap-2">
              <input
                value={widgetUrl}
                readOnly
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-sm font-mono"
              />
              <button onClick={copyLink} className={`px-4 py-2 rounded-xl text-sm transition-all ${copied ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                {copied ? '✓' : 'Хуулах'}
              </button>
            </div>

            <a href={qrUrl} download={`${storeName}-qr.png`} className="inline-block px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">
              📥 QR код татах (PNG)
            </a>
          </div>

          <div className="mt-8 text-left bg-slate-900/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-2">💡 Ашиглах газар:</h3>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• Дэлгүүрийн хаалган дээр хэвлэж наана</li>
              <li>• Нэрийн хуудас, flyer дээр нэмнэ</li>
              <li>• Facebook/Instagram пост дээр тавина</li>
              <li>• Savлалтын цэсний хуудас дээр оруулна</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
