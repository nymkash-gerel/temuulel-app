'use client'

import { useEffect, useState } from 'react'

interface Campaign {
  id: string
  name: string
  message_text: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  target_audience: string
  total_recipients: number
  sent_count: number
  failed_count: number
  sent_at: string | null
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Ноорог', color: 'bg-slate-500/20 text-slate-400' },
  scheduled: { label: 'Хуваарьтай', color: 'bg-blue-500/20 text-blue-400' },
  sending: { label: 'Илгээж байна...', color: 'bg-yellow-500/20 text-yellow-400' },
  sent: { label: 'Илгээсэн', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцалсан', color: 'bg-red-500/20 text-red-400' },
}

const AUDIENCE_MAP: Record<string, string> = {
  all: 'Бүх харилцагч',
  ordered: 'Захиалга өгсөн',
  active_30d: 'Сүүлийн 30 хоног идэвхтэй',
}

export default function BroadcastPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  // Form
  const [name, setName] = useState('')
  const [messageText, setMessageText] = useState('')
  const [audience, setAudience] = useState('all')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadCampaigns() {
    setLoading(true)
    try {
      const res = await fetch('/api/broadcast')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns || [])
      }
    } catch { setError('Ачаалж чадсангүй') }
    setLoading(false)
  }

  useEffect(() => { loadCampaigns() }, [])

  async function createCampaign() {
    if (!name.trim() || !messageText.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message_text: messageText, target_audience: audience, scheduled_at: scheduledAt || undefined }),
      })
      if (res.ok) {
        setShowForm(false)
        setName('')
        setMessageText('')
        await loadCampaigns()
      } else setError('Үүсгэж чадсангүй')
    } catch { setError('Алдаа гарлаа') }
    setSaving(false)
  }

  async function sendCampaign(id: string) {
    if (!confirm('Кампанийг илгээх үү? Бүх харилцагчид мессеж очно.')) return
    setSending(id)
    setError(null)
    try {
      const res = await fetch(`/api/broadcast/${id}`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Илгээсэн: ${data.sent}/${data.total}`)
        await loadCampaigns()
      } else {
        const data = await res.json()
        setError(data.error || 'Илгээж чадсангүй')
      }
    } catch { setError('Алдаа гарлаа') }
    setSending(null)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Устгах уу?')) return
    await fetch(`/api/broadcast/${id}`, { method: 'DELETE' })
    await loadCampaigns()
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">📢 Broadcast кампани</h1>
            <p className="text-slate-400 mt-1">Бүх харилцагчид масс мессеж илгээх</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-all"
          >
            + Шинэ кампани
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <span className="text-red-400 text-sm flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 text-sm">✕</button>
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
            <h3 className="text-white font-medium mb-4">Шинэ кампани</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Кампанийн нэр</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Хямдрал зарлах"
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Мессежийн текст</label>
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Сайн байна уу! Манай дэлгүүрт 20% хямдрал эхэллээ! 🎉"
                  rows={4}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Хүлээн авагч</label>
                <select
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  className="px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Бүх харилцагч</option>
                  <option value="ordered">Захиалга өгсөн</option>
                  <option value="active_30d">Сүүлийн 30 хоногт идэвхтэй</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Хуваарь (сонголттой)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Хоосон үлдээвэл ноорог болно. Огноо сонговол хуваарьтай илгээнэ.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={createCampaign}
                  disabled={saving || !name.trim() || !messageText.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-all disabled:opacity-50"
                >
                  {saving ? 'Үүсгэж байна...' : 'Үүсгэх'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-xl"
                >
                  Болих
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">📢</div>
            <h3 className="text-xl font-semibold text-white mb-2">Кампани байхгүй</h3>
            <p className="text-slate-400">Бүх харилцагчид мессеж илгээх кампани үүсгэнэ үү</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const s = STATUS_MAP[c.status] || STATUS_MAP.draft
              return (
                <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-medium">{c.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${s.color}`}>{s.label}</span>
                        <span className="text-xs text-slate-500">{AUDIENCE_MAP[c.target_audience] || c.target_audience}</span>
                      </div>
                      <p className="text-slate-400 text-sm mb-2 line-clamp-2">{c.message_text}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        {c.status === 'sent' && (
                          <>
                            <span>✅ {c.sent_count} илгээсэн</span>
                            {c.failed_count > 0 && <span>❌ {c.failed_count} амжилтгүй</span>}
                            <span>👥 {c.total_recipients} нийт</span>
                          </>
                        )}
                        <span>{new Date(c.created_at).toLocaleDateString('mn-MN')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {c.status === 'draft' && (
                        <button
                          onClick={() => sendCampaign(c.id)}
                          disabled={sending === c.id}
                          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all disabled:opacity-50"
                        >
                          {sending === c.id ? '⏳ Илгээж байна...' : '🚀 Илгээх'}
                        </button>
                      )}
                      {c.status === 'draft' && (
                        <button
                          onClick={() => deleteCampaign(c.id)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-xs"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Email Campaign Section */}
        <EmailCampaignSection />
      </div>
    </div>
  )
}

function EmailCampaignSection() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('all')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)

  async function sendEmail() {
    if (!subject.trim() || !body.trim()) return
    if (!confirm('Email кампани илгээх үү?')) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/email-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html_body: body, target }),
      })
      if (res.ok) {
        setResult(await res.json())
        setSubject('')
        setBody('')
      }
    } catch { /* */ }
    setSending(false)
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-white mb-4">📧 Email кампани</h2>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Гарчиг</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Шинэ бүтээгдэхүүн ирлээ! 🎉"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Агуулга (HTML)</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={'<h2>Сайн байна уу {{name}}!</h2>\n<p>Манай дэлгүүрт шинэ бүтээгдэхүүн ирлээ...</p>'}
              rows={5}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">{'{{name}}'} — хэрэглэгчийн нэрээр солигдоно</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm"
            >
              <option value="all">Бүх харилцагч</option>
              <option value="ordered">Захиалга өгсөн</option>
            </select>
            <button
              onClick={sendEmail}
              disabled={sending || !subject.trim() || !body.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-all disabled:opacity-50"
            >
              {sending ? '📧 Илгээж байна...' : '📧 Email илгээх'}
            </button>
          </div>
          {result && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
              ✅ {result.sent}/{result.total} email амжилттай илгээлээ
              {result.failed > 0 && <span className="text-red-400 ml-2">({result.failed} амжилтгүй)</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
