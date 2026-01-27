'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Json } from '@/lib/database.types'
import { createClient } from '@/lib/supabase/client'

interface NotificationSettings {
  email_new_order: boolean
  email_new_message: boolean
  email_low_stock: boolean
  email_daily_report: boolean
  push_new_order: boolean
  push_new_message: boolean
  push_low_stock: boolean
  sound_enabled: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  email_new_order: true,
  email_new_message: false,
  email_low_stock: true,
  email_daily_report: false,
  push_new_order: true,
  push_new_message: true,
  push_low_stock: false,
  sound_enabled: true,
}

export default function NotificationSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState('')
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('notification_settings')
        .eq('id', user.id)
        .single()

      if (profile?.notification_settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...(profile.notification_settings as Record<string, boolean>) })
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setSaved(false)

    await supabase
      .from('users')
      .update({ notification_settings: settings as unknown as Json })
      .eq('id', userId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggle(key: keyof NotificationSettings) {
    setSettings({ ...settings, [key]: !settings[key] })
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

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Мэдэгдэл</h1>
          <p className="text-slate-400 mt-1">Имэйл, push мэдэгдэл тохируулах</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Email Notifications */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xl">📧</span>
            <h3 className="text-white font-medium">Имэйл мэдэгдэл</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Шинэ захиалга</p>
                <p className="text-slate-500 text-xs mt-0.5">Захиалга ирэхэд имэйл илгээх</p>
              </div>
              <Toggle enabled={settings.email_new_order} onToggle={() => toggle('email_new_order')} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Шинэ мессеж</p>
                <p className="text-slate-500 text-xs mt-0.5">Харилцагч мессеж бичихэд имэйл илгээх</p>
              </div>
              <Toggle enabled={settings.email_new_message} onToggle={() => toggle('email_new_message')} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Бага нөөц</p>
                <p className="text-slate-500 text-xs mt-0.5">Бараа дуусч байхад имэйл илгээх</p>
              </div>
              <Toggle enabled={settings.email_low_stock} onToggle={() => toggle('email_low_stock')} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Өдрийн тайлан</p>
                <p className="text-slate-500 text-xs mt-0.5">Өдөр бүр борлуулалтын товч тайлан илгээх</p>
              </div>
              <Toggle enabled={settings.email_daily_report} onToggle={() => toggle('email_daily_report')} />
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <h3 className="text-white font-medium">Push мэдэгдэл</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Шинэ захиалга</p>
                <p className="text-slate-500 text-xs mt-0.5">Захиалга ирэхэд browser мэдэгдэл</p>
              </div>
              <Toggle enabled={settings.push_new_order} onToggle={() => toggle('push_new_order')} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Шинэ мессеж</p>
                <p className="text-slate-500 text-xs mt-0.5">Чатын мессеж ирэхэд browser мэдэгдэл</p>
              </div>
              <Toggle enabled={settings.push_new_message} onToggle={() => toggle('push_new_message')} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Бага нөөц</p>
                <p className="text-slate-500 text-xs mt-0.5">Бараа дуусч байхад browser мэдэгдэл</p>
              </div>
              <Toggle enabled={settings.push_low_stock} onToggle={() => toggle('push_low_stock')} />
            </div>
          </div>
        </div>

        {/* Sound */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔊</span>
              <div>
                <h3 className="text-white font-medium">Дуут мэдэгдэл</h3>
                <p className="text-slate-400 text-sm mt-0.5">Шинэ мессеж, захиалга ирэхэд дуу гаргах</p>
              </div>
            </div>
            <Toggle enabled={settings.sound_enabled} onToggle={() => toggle('sound_enabled')} />
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
