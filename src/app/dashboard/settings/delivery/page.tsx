'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DeliverySettings {
  assignment_mode: 'auto' | 'suggest' | 'manual'
  priority_rules: string[]
  max_concurrent_deliveries: number
  assignment_radius_km: number
  auto_assign_on_shipped: boolean
  working_hours: { start: string; end: string }
}

const DEFAULT_SETTINGS: DeliverySettings = {
  assignment_mode: 'manual',
  priority_rules: ['closest_driver', 'least_loaded', 'vehicle_match'],
  max_concurrent_deliveries: 3,
  assignment_radius_km: 10,
  auto_assign_on_shipped: true,
  working_hours: { start: '09:00', end: '22:00' },
}

const MODE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'auto', label: 'Автомат', description: 'AI жолоочийг автоматаар оноох' },
  { value: 'suggest', label: 'Санал болгох', description: 'AI санал болгоно, та зөвшөөрнө' },
  { value: 'manual', label: 'Гараар', description: 'Та өөрөө жолооч оноох' },
]

const RULE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'closest_driver', label: 'Хамгийн ойрхон жолооч', description: 'Байршил ойрхон жолоочийг сонгох' },
  { value: 'least_loaded', label: 'Хамгийн бага ачаалалтай', description: 'Идэвхтэй хүргэлт цөөнтэй жолоочийг сонгох' },
  { value: 'vehicle_match', label: 'Тээврийн хэрэгсэл тохирох', description: 'Захиалгын хэмжээнд тохирох тээвэр' },
  { value: 'round_robin', label: 'Ээлжлэн хуваарилах', description: 'Жолоочид жигд хуваарилах' },
  { value: 'rating_first', label: 'Амжилтын хувиар', description: 'Хамгийн өндөр амжилтын хувьтай жолоочийг сонгох' },
]

export default function DeliverySettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULT_SETTINGS)
  const [storeId, setStoreId] = useState('')

  const fetchSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id, delivery_settings')
      .eq('owner_id', user.id)
      .single()

    if (store) {
      setStoreId(store.id)
      if (store.delivery_settings && typeof store.delivery_settings === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...(store.delivery_settings as Partial<DeliverySettings>) })
      }
    }
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  async function handleSave() {
    if (!storeId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('stores')
        .update({ delivery_settings: JSON.parse(JSON.stringify(settings)) })
        .eq('id', storeId)

      if (error) {
        alert('Хадгалахад алдаа гарлаа')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  function moveRule(index: number, direction: 'up' | 'down') {
    const newRules = [...settings.priority_rules]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newRules.length) return
    ;[newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]]
    setSettings({ ...settings, priority_rules: newRules })
  }

  function toggleRule(ruleValue: string) {
    const exists = settings.priority_rules.includes(ruleValue)
    if (exists) {
      setSettings({ ...settings, priority_rules: settings.priority_rules.filter(r => r !== ruleValue) })
    } else {
      setSettings({ ...settings, priority_rules: [...settings.priority_rules, ruleValue] })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/settings" className="text-slate-400 hover:text-white transition-colors">
              Тохиргоо
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-white">Хүргэлтийн тохиргоо</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Хүргэлтийн тохиргоо</h1>
          <p className="text-slate-400 mt-1">AI жолооч оноох дүрэм, горим тохируулах</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Assignment Mode */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Хүргэлт оноох горим</h2>
          <p className="text-slate-400 text-sm mb-4">Захиалга хүргэлт болоход жолоочийг хэрхэн оноох</p>

          <div className="grid gap-3">
            {MODE_OPTIONS.map((mode) => (
              <label
                key={mode.value}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  settings.assignment_mode === mode.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="assignment_mode"
                  value={mode.value}
                  checked={settings.assignment_mode === mode.value}
                  onChange={() => setSettings({ ...settings, assignment_mode: mode.value as DeliverySettings['assignment_mode'] })}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  settings.assignment_mode === mode.value ? 'border-blue-500' : 'border-slate-500'
                }`}>
                  {settings.assignment_mode === mode.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">{mode.label}</p>
                  <p className="text-slate-400 text-sm">{mode.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Auto-assign on shipped */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">Автомат хүргэлт үүсгэх</h2>
              <p className="text-slate-400 text-sm mt-1">
                Захиалга &quot;Илгээсэн&quot; төлөвт шилжихэд автоматаар хүргэлт үүсгэж жолооч оноох
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, auto_assign_on_shipped: !settings.auto_assign_on_shipped })}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                settings.auto_assign_on_shipped ? 'bg-blue-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.auto_assign_on_shipped ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Priority Rules */}
        {settings.assignment_mode !== 'manual' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-1">Дараалал (Priority Rules)</h2>
            <p className="text-slate-400 text-sm mb-4">
              AI жолооч сонгоход анхаарах зүйлсийг дараалалд оруулна уу. Дээрхийг илүү ач холбогдолтой гэж тооцно.
            </p>

            {/* Active rules (ordered) */}
            <div className="space-y-2 mb-4">
              {settings.priority_rules.map((ruleValue, index) => {
                const rule = RULE_OPTIONS.find(r => r.value === ruleValue)
                if (!rule) return null
                return (
                  <div
                    key={ruleValue}
                    className="flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-xl"
                  >
                    <span className="text-slate-500 text-sm font-mono w-6 text-center">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{rule.label}</p>
                      <p className="text-slate-400 text-xs">{rule.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveRule(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-all disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveRule(index, 'down')}
                        disabled={index === settings.priority_rules.length - 1}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-all disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => toggleRule(ruleValue)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Available rules (not yet added) */}
            {RULE_OPTIONS.filter(r => !settings.priority_rules.includes(r.value)).length > 0 && (
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Нэмэх боломжтой</p>
                <div className="space-y-1">
                  {RULE_OPTIONS.filter(r => !settings.priority_rules.includes(r.value)).map((rule) => (
                    <button
                      key={rule.value}
                      onClick={() => toggleRule(rule.value)}
                      className="w-full flex items-center gap-3 p-3 bg-slate-800/50 border border-dashed border-slate-600 rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left"
                    >
                      <span className="text-blue-400 text-lg">+</span>
                      <div>
                        <p className="text-slate-300 text-sm">{rule.label}</p>
                        <p className="text-slate-500 text-xs">{rule.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Limits */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Хязгаар</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Жолоочийн хамгийн их хүргэлт (зэрэг)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={settings.max_concurrent_deliveries}
                  onChange={(e) => setSettings({ ...settings, max_concurrent_deliveries: Number(e.target.value) })}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-white font-bold text-lg w-8 text-center">{settings.max_concurrent_deliveries}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Хүрээ (км)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={settings.assignment_radius_km}
                  onChange={(e) => setSettings({ ...settings, assignment_radius_km: Number(e.target.value) })}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-white font-bold text-lg w-12 text-center">{settings.assignment_radius_km} км</span>
              </div>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Ажлын цаг</h2>
          <p className="text-slate-400 text-sm mb-4">AI автоматаар жолооч оноох цагийн хүрээ</p>

          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Эхлэх</label>
              <input
                type="time"
                value={settings.working_hours.start}
                onChange={(e) => setSettings({
                  ...settings,
                  working_hours: { ...settings.working_hours, start: e.target.value },
                })}
                className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Дуусах</label>
              <input
                type="time"
                value={settings.working_hours.end}
                onChange={(e) => setSettings({
                  ...settings,
                  working_hours: { ...settings.working_hours, end: e.target.value },
                })}
                className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button (bottom) */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
      </div>
    </div>
  )
}
