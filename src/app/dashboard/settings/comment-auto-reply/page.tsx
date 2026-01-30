'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface CommentRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  trigger_type: 'keyword' | 'any' | 'first_comment' | 'contains_question'
  keywords: string[] | null
  match_mode: 'any' | 'all'
  reply_comment: boolean
  reply_dm: boolean
  comment_template: string | null
  dm_template: string | null
  delay_seconds: number
  platforms: string[]
  matches_count: number
  replies_sent: number
  use_ai: boolean
  ai_context: string | null
}

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  keyword: 'Түлхүүр үг',
  any: 'Бүх сэтгэгдэл',
  first_comment: 'Анхны сэтгэгдэл',
  contains_question: 'Асуулт агуулсан',
}

export default function CommentAutoReplyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<CommentRule[]>([])
  const [editingRule, setEditingRule] = useState<CommentRule | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  // Form state for new/editing rule
  const [formName, setFormName] = useState('')
  const [formTriggerType, setFormTriggerType] = useState<CommentRule['trigger_type']>('keyword')
  const [formKeywords, setFormKeywords] = useState('')
  const [formMatchMode, setFormMatchMode] = useState<'any' | 'all'>('any')
  const [formReplyComment, setFormReplyComment] = useState(true)
  const [formReplyDm, setFormReplyDm] = useState(false)
  const [formCommentTemplate, setFormCommentTemplate] = useState('')
  const [formDmTemplate, setFormDmTemplate] = useState('')
  const [formDelaySeconds, setFormDelaySeconds] = useState(0)
  const [formPlatforms, setFormPlatforms] = useState<string[]>(['facebook', 'instagram'])
  const [formUseAi, setFormUseAi] = useState(false)
  const [formAiContext, setFormAiContext] = useState('')

  useEffect(() => {
    loadRules()
  }, [])

  async function loadRules() {
    setLoading(true)
    try {
      const res = await fetch('/api/comment-rules')
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
      }
    } catch (err) {
      console.error('Error loading rules:', err)
    }
    setLoading(false)
  }

  function resetForm() {
    setFormName('')
    setFormTriggerType('keyword')
    setFormKeywords('')
    setFormMatchMode('any')
    setFormReplyComment(true)
    setFormReplyDm(false)
    setFormCommentTemplate('')
    setFormDmTemplate('')
    setFormDelaySeconds(0)
    setFormPlatforms(['facebook', 'instagram'])
    setFormUseAi(false)
    setFormAiContext('')
  }

  function openEditor(rule?: CommentRule) {
    if (rule) {
      setEditingRule(rule)
      setFormName(rule.name)
      setFormTriggerType(rule.trigger_type)
      setFormKeywords(rule.keywords?.join(', ') || '')
      setFormMatchMode(rule.match_mode)
      setFormReplyComment(rule.reply_comment)
      setFormReplyDm(rule.reply_dm)
      setFormCommentTemplate(rule.comment_template || '')
      setFormDmTemplate(rule.dm_template || '')
      setFormDelaySeconds(rule.delay_seconds)
      setFormPlatforms(rule.platforms)
      setFormUseAi(rule.use_ai || false)
      setFormAiContext(rule.ai_context || '')
    } else {
      setEditingRule(null)
      resetForm()
    }
    setShowEditor(true)
  }

  async function saveRule() {
    if (!formName.trim()) return

    setSaving(true)
    const payload = {
      name: formName.trim(),
      trigger_type: formTriggerType,
      keywords: formKeywords.split(',').map(k => k.trim()).filter(Boolean),
      match_mode: formMatchMode,
      reply_comment: formReplyComment,
      reply_dm: formReplyDm,
      comment_template: formUseAi ? null : (formCommentTemplate || null),
      dm_template: formUseAi ? null : (formDmTemplate || null),
      delay_seconds: formDelaySeconds,
      platforms: formPlatforms,
      use_ai: formUseAi,
      ai_context: formUseAi ? (formAiContext || null) : null,
    }

    try {
      const url = editingRule ? `/api/comment-rules/${editingRule.id}` : '/api/comment-rules'
      const method = editingRule ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await loadRules()
        setShowEditor(false)
        resetForm()
      }
    } catch (err) {
      console.error('Error saving rule:', err)
    }
    setSaving(false)
  }

  async function toggleRule(rule: CommentRule) {
    try {
      await fetch(`/api/comment-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      await loadRules()
    } catch (err) {
      console.error('Error toggling rule:', err)
    }
  }

  async function deleteRule(rule: CommentRule) {
    if (!confirm(`"${rule.name}" дүрмийг устгах уу?`)) return

    try {
      await fetch(`/api/comment-rules/${rule.id}`, { method: 'DELETE' })
      await loadRules()
    } catch (err) {
      console.error('Error deleting rule:', err)
    }
  }

  function insertVariable(field: 'comment' | 'dm', variable: string) {
    const value = `{{${variable}}}`
    if (field === 'comment') {
      setFormCommentTemplate(prev => prev + value)
    } else {
      setFormDmTemplate(prev => prev + value)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/settings"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Comment Auto-Reply</h1>
            <p className="text-slate-400 mt-1">
              Facebook/Instagram постын сэтгэгдэлд автомат хариулах дүрмүүд
            </p>
          </div>
          <button
            onClick={() => openEditor()}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all"
          >
            + Шинэ дүрэм
          </button>
        </div>

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-white mb-2">Дүрэм байхгүй байна</h3>
            <p className="text-slate-400 mb-6">
              Сэтгэгдэлд автомат хариулах дүрэм нэмнэ үү
            </p>
            <button
              onClick={() => openEditor()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all"
            >
              Эхний дүрэм нэмэх
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className={`bg-slate-800/50 border rounded-2xl p-5 transition-all ${
                  rule.enabled ? 'border-slate-700' : 'border-slate-700/50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-1 ${
                      rule.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        rule.enabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-medium">{rule.name}</h3>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                        {TRIGGER_TYPE_LABELS[rule.trigger_type]}
                      </span>
                      {rule.trigger_type === 'keyword' && rule.keywords && (
                        <span className="text-slate-400 text-sm truncate">
                          {rule.keywords.slice(0, 3).join(', ')}
                          {rule.keywords.length > 3 && ` +${rule.keywords.length - 3}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      {rule.use_ai && (
                        <span className="flex items-center gap-1 text-purple-400">
                          <span>🤖</span> AI хариулт
                        </span>
                      )}
                      {rule.reply_comment && (
                        <span className="flex items-center gap-1">
                          <span>💬</span> Нийтийн хариулт
                        </span>
                      )}
                      {rule.reply_dm && (
                        <span className="flex items-center gap-1">
                          <span>📩</span> DM хариулт
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span>📊</span> {rule.matches_count} илэрц / {rule.replies_sent} хариулт
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditor(rule)}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteRule(rule)}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-bold text-white">
                  {editingRule ? 'Дүрэм засах' : 'Шинэ дүрэм'}
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Дүрмийн нэр
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Жишээ: Үнэ асуусан хариулт"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Trigger Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Идэвхжүүлэх нөхцөл
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['keyword', 'any', 'contains_question', 'first_comment'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setFormTriggerType(type)}
                        className={`p-3 rounded-xl border text-sm text-center transition-all ${
                          formTriggerType === type
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {TRIGGER_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keywords (only for keyword trigger) */}
                {formTriggerType === 'keyword' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Түлхүүр үгс (таслалаар тусгаарлана)
                    </label>
                    <input
                      type="text"
                      value={formKeywords}
                      onChange={(e) => setFormKeywords(e.target.value)}
                      placeholder="үнэ, хэд, price"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <div className="flex gap-3 mt-2">
                      <label className="flex items-center gap-2 text-sm text-slate-400">
                        <input
                          type="radio"
                          checked={formMatchMode === 'any'}
                          onChange={() => setFormMatchMode('any')}
                          className="accent-blue-500"
                        />
                        Аль нэгийг нь агуулсан
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-400">
                        <input
                          type="radio"
                          checked={formMatchMode === 'all'}
                          onChange={() => setFormMatchMode('all')}
                          className="accent-blue-500"
                        />
                        Бүгдийг агуулсан
                      </label>
                    </div>
                  </div>
                )}

                {/* AI Mode Toggle */}
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formUseAi}
                      onChange={(e) => setFormUseAi(e.target.checked)}
                      className="w-5 h-5 accent-purple-500 rounded"
                    />
                    <div className="flex-1">
                      <span className="text-white font-medium flex items-center gap-2">
                        🤖 AI хариулт ашиглах
                        <span className="px-2 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded-full">
                          Шинэ
                        </span>
                      </span>
                      <p className="text-sm text-slate-400 mt-1">
                        AI нь бүтээгдэхүүн хайх, үнэ хэлэх, асуултанд ухаалаг хариулах чадвартай
                      </p>
                    </div>
                  </label>

                  {/* AI Context */}
                  {formUseAi && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        AI-д өгөх нэмэлт заавар (сонголттой)
                      </label>
                      <textarea
                        value={formAiContext}
                        onChange={(e) => setFormAiContext(e.target.value)}
                        placeholder="Жишээ: Энэ пост дээр зөвхөн хөнгөлөлттэй бүтээгдэхүүнүүдийн талаар хариулна уу..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition-all resize-none"
                      />
                    </div>
                  )}
                </div>

                {/* Reply Types */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Хариултын төрөл
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formReplyComment}
                        onChange={(e) => setFormReplyComment(e.target.checked)}
                        className="w-5 h-5 accent-blue-500 rounded"
                      />
                      <span className="text-white">💬 Нийтийн сэтгэгдэл хариулт</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formReplyDm}
                        onChange={(e) => setFormReplyDm(e.target.checked)}
                        className="w-5 h-5 accent-blue-500 rounded"
                      />
                      <span className="text-white">📩 Хувийн мессеж (DM)</span>
                    </label>
                  </div>
                </div>

                {/* Comment Template (only when not using AI) */}
                {formReplyComment && !formUseAi && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Нийтийн хариултын загвар
                    </label>
                    <textarea
                      value={formCommentTemplate}
                      onChange={(e) => setFormCommentTemplate(e.target.value)}
                      placeholder="Баярлалаа {{user_name}}! Бид таны асуултад хариулах болно."
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => insertVariable('comment', 'user_name')}
                        className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                      >
                        {'{{user_name}}'}
                      </button>
                    </div>
                  </div>
                )}

                {/* DM Template (only when not using AI) */}
                {formReplyDm && !formUseAi && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      DM хариултын загвар
                    </label>
                    <textarea
                      value={formDmTemplate}
                      onChange={(e) => setFormDmTemplate(e.target.value)}
                      placeholder="Сайн байна уу {{user_name}}! Таны сэтгэгдэлд баярлалаа. Бид танд тусалмаар байна..."
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => insertVariable('dm', 'user_name')}
                        className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                      >
                        {'{{user_name}}'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Delay */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Хариултын хоцролт: {formDelaySeconds} секунд
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={formDelaySeconds}
                    onChange={(e) => setFormDelaySeconds(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    0 = шууд хариулна, 60 = 1 минутын дараа
                  </p>
                </div>

                {/* Platforms */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Платформ
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formPlatforms.includes('facebook')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormPlatforms([...formPlatforms, 'facebook'])
                          } else {
                            setFormPlatforms(formPlatforms.filter(p => p !== 'facebook'))
                          }
                        }}
                        className="w-5 h-5 accent-blue-500 rounded"
                      />
                      <span className="text-white">Facebook</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formPlatforms.includes('instagram')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormPlatforms([...formPlatforms, 'instagram'])
                          } else {
                            setFormPlatforms(formPlatforms.filter(p => p !== 'instagram'))
                          }
                        }}
                        className="w-5 h-5 accent-blue-500 rounded"
                      />
                      <span className="text-white">Instagram</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditor(false)
                    resetForm()
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
                >
                  Болих
                </button>
                <button
                  onClick={saveRule}
                  disabled={saving || !formName.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
