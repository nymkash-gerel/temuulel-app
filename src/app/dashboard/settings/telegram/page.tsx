'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveStoreId } from '@/lib/resolve-store'

interface TelegramData {
  memberId: string | null
  telegramChatId: string | null
  notificationPreferences: Record<string, boolean>
  isOwner: boolean
  botUsername: string
}

const NOTIFICATION_TYPES = [
  { key: 'new_order', label: 'Шинэ захиалга', desc: 'Захиалга ирэхэд мэдэгдэл авах' },
  { key: 'new_message', label: 'Шинэ мессеж', desc: 'Харилцагч мессеж бичихэд мэдэгдэл авах' },
  { key: 'new_customer', label: 'Шинэ харилцагч', desc: 'Шинэ харилцагч бүртгэгдэхэд мэдэгдэл авах' },
  { key: 'order_status', label: 'Захиалгын статус', desc: 'Захиалгын статус өөрчлөгдөхөд мэдэгдэл авах' },
  { key: 'low_stock', label: 'Бага нөөц', desc: 'Бараа дуусч байхад мэдэгдэл авах' },
  { key: 'payment', label: 'Төлбөр', desc: 'Төлбөр баталгаажихад мэдэгдэл авах' },
  { key: 'delivery', label: 'Хүргэлт', desc: 'Хүргэлтийн статус өөрчлөгдөхөд мэдэгдэл авах' },
  { key: 'escalation', label: 'Эскалаци', desc: 'AI чат хүнд шилжүүлэх хүсэлт ирэхэд мэдэгдэл авах' },
]

export default function TelegramSettingsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [data, setData] = useState<TelegramData | null>(null)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [disconnecting, setDisconnecting] = useState(false)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const storeId = await resolveStoreId(supabase, user.id)
    if (!storeId) { setLoading(false); return }

    // Check if user is owner
    const { data: store } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', storeId)
      .single()

    const isOwner = store?.owner_id === user.id

    // Get or create store_members record
    let { data: member } = await supabase
      .from('store_members')
      .select('id, telegram_chat_id, notification_preferences')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .single()

    // Owner might not have a store_members record — create one
    if (!member && isOwner) {
      const { data: newMember } = await supabase
        .from('store_members')
        .insert({
          store_id: storeId,
          user_id: user.id,
          role: 'owner',
          permissions: null,
          notification_preferences: {},
        })
        .select('id, telegram_chat_id, notification_preferences')
        .single()
      member = newMember
    }

    if (!member) { setLoading(false); return }

    setMemberId(member.id)
    const memberPrefs = (member.notification_preferences ?? {}) as Record<string, boolean>
    setPrefs(memberPrefs)
    setData({
      memberId: member.id,
      telegramChatId: member.telegram_chat_id || null,
      notificationPreferences: memberPrefs,
      isOwner,
      botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '',
    })
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!memberId) return
    setSaving(true)
    setSaved(false)
    setError(null)

    const res = await fetch('/api/team/telegram', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPreferences: prefs }),
    })

    if (!res.ok) {
      setError('Хадгалахад алдаа гарлаа')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    setError(null)
    const res = await fetch('/api/team/telegram', { method: 'DELETE' })
    if (res.ok) {
      setData(d => d ? { ...d, telegramChatId: null } : d)
    } else {
      setError('Салгахад алдаа гарлаа')
    }
    setDisconnecting(false)
  }

  function togglePref(key: string) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
    return (
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isConnected = !!data?.telegramChatId
  const botUsername = data?.botUsername || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''
  const connectLink = botUsername && memberId
    ? `https://t.me/${botUsername}?start=member_${memberId}`
    : null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Telegram</h1>
          <p className="text-slate-400 mt-1">Telegram-аар мэдэгдэл авах тохиргоо</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">✈️</span>
            <div>
              <h3 className="text-white font-medium">Telegram холболт</h3>
              <p className="text-slate-400 text-sm mt-0.5">
                {isConnected ? 'Холбогдсон' : 'Холбогдоогүй'}
              </p>
            </div>
            <div className="ml-auto">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-500/20 text-slate-400'
              }`}>
                {isConnected ? 'Идэвхтэй' : 'Идэвхгүй'}
              </span>
            </div>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-3">
              <p className="text-slate-400 text-sm flex-1">
                Chat ID: <span className="text-slate-300 font-mono">{data?.telegramChatId}</span>
              </p>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
              >
                {disconnecting ? 'Салгаж байна...' : 'Салгах'}
              </button>
            </div>
          ) : connectLink ? (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">
                Доорх товч дарж Telegram бот руу очиж холбоно уу:
              </p>
              <a
                href={connectLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl font-medium transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram-аар холбох
              </a>
              <p className="text-slate-500 text-xs">
                Линк дарсны дараа Telegram апп дээр Start товч дарна уу
              </p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              Telegram бот тохируулаагүй байна. TELEGRAM_BOT_USERNAME тохируулна уу.
            </p>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <div>
              <h3 className="text-white font-medium">Telegram мэдэгдэл</h3>
              <p className="text-slate-400 text-sm mt-0.5">Ямар мэдэгдэл авахаа сонгоно уу</p>
            </div>
          </div>

          {!isConnected && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-amber-400 text-sm">Telegram холбосны дараа мэдэгдэл авах боломжтой</p>
            </div>
          )}

          <div className="space-y-4">
            {NOTIFICATION_TYPES.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
                <Toggle
                  enabled={!!prefs[key]}
                  onToggle={() => togglePref(key)}
                />
              </div>
            ))}
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
