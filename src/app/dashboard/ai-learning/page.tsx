'use client'

import { useEffect, useState } from 'react'

// Types
interface UnansweredQuestion {
  id: string
  customer_message: string
  intent: string | null
  ai_response: string | null
  status: string
  created_at: string
}

interface KnowledgeEntry {
  id: string
  question: string
  answer: string
  category: string
  keywords: string[]
  is_active: boolean
  created_at: string
}

type Tab = 'unanswered' | 'knowledge' | 'stats'

export default function AILearningPage() {
  const [tab, setTab] = useState<Tab>('unanswered')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Unanswered questions
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([])

  // Knowledge base
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [showKBForm, setShowKBForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null)
  const [kbQuestion, setKbQuestion] = useState('')
  const [kbAnswer, setKbAnswer] = useState('')
  const [kbCategory, setKbCategory] = useState('general')
  const [saving, setSaving] = useState(false)

  // Stats
  const [stats, setStats] = useState<{ avgScore: number; totalLogs: number; unansweredCount: number; kbCount: number } | null>(null)

  async function loadUnanswered() {
    setLoading(true)
    try {
      const res = await fetch('/api/unanswered-questions')
      if (res.ok) {
        const data = await res.json()
        setQuestions(data.questions || [])
      }
    } catch { setError('Ачаалж чадсангүй') }
    setLoading(false)
  }

  async function loadKnowledge() {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge-base')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
      }
    } catch { setError('Ачаалж чадсангүй') }
    setLoading(false)
  }

  async function loadStats() {
    // Stats from existing data counts
    setStats({
      avgScore: 0,
      totalLogs: 0,
      unansweredCount: questions.length,
      kbCount: entries.length,
    })
  }

  useEffect(() => {
    if (tab === 'unanswered') loadUnanswered()
    else if (tab === 'knowledge') loadKnowledge()
    else loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Mark unanswered as answered/ignored
  async function updateQuestion(id: string, status: 'answered' | 'ignored', knowledgeEntryId?: string) {
    try {
      await fetch('/api/unanswered-questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, knowledge_entry_id: knowledgeEntryId }),
      })
      await loadUnanswered()
    } catch { setError('Шинэчлэхэд алдаа гарлаа') }
  }

  // Add to knowledge base from unanswered question
  function addToKB(q: UnansweredQuestion) {
    setKbQuestion(q.customer_message)
    setKbAnswer('')
    setKbCategory('general')
    setEditingEntry(null)
    setShowKBForm(true)
    setTab('knowledge')
    // Save the question ID to link after saving
    sessionStorage.setItem('_linkUnansweredId', q.id)
  }

  // Save knowledge base entry
  async function saveKBEntry() {
    if (!kbQuestion.trim() || !kbAnswer.trim()) return
    setSaving(true)
    setError(null)
    try {
      const url = editingEntry ? `/api/knowledge-base/${editingEntry.id}` : '/api/knowledge-base'
      const method = editingEntry ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: kbQuestion, answer: kbAnswer, category: kbCategory }),
      })
      if (res.ok) {
        const data = await res.json()
        // Link unanswered question if coming from "Add to KB" flow
        const linkId = sessionStorage.getItem('_linkUnansweredId')
        if (linkId && !editingEntry) {
          await updateQuestion(linkId, 'answered', data.entry?.id)
          sessionStorage.removeItem('_linkUnansweredId')
        }
        setShowKBForm(false)
        setKbQuestion('')
        setKbAnswer('')
        setEditingEntry(null)
        await loadKnowledge()
      } else {
        setError('Хадгалж чадсангүй')
      }
    } catch { setError('Алдаа гарлаа') }
    setSaving(false)
  }

  async function deleteKBEntry(id: string) {
    if (!confirm('Устгах уу?')) return
    try {
      await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' })
      await loadKnowledge()
    } catch { setError('Устгаж чадсангүй') }
  }

  function editKBEntry(entry: KnowledgeEntry) {
    setEditingEntry(entry)
    setKbQuestion(entry.question)
    setKbAnswer(entry.answer)
    setKbCategory(entry.category)
    setShowKBForm(true)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">🧠 AI Суралцах Систем</h1>
          <p className="text-slate-400 mt-1">
            Хариулж чадаагүй асуултуудыг харж, мэдлэгийн санд нэмж, AI-г сайжруулна
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { id: 'unanswered' as Tab, label: '❓ Хариулаагүй', count: questions.length },
            { id: 'knowledge' as Tab, label: '📚 Мэдлэгийн сан', count: entries.length },
            { id: 'stats' as Tab, label: '📊 Статистик', count: null },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <span className="text-red-400 text-sm flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
          </div>
        )}

        {/* Tab: Unanswered Questions */}
        {tab === 'unanswered' && (
          <div>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" />
              </div>
            ) : questions.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-xl font-semibold text-white mb-2">Бүх асуултад хариулсан!</h3>
                <p className="text-slate-400">AI бүх хэрэглэгчийн асуултад итгэлтэй хариулж байна</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map(q => (
                  <div key={q.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium mb-1">"{q.customer_message}"</p>
                        {q.ai_response && (
                          <p className="text-slate-400 text-sm mb-2 line-clamp-2">
                            AI хариулт: {q.ai_response.substring(0, 150)}...
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {q.intent && <span className="px-2 py-0.5 bg-slate-700 rounded-full">{q.intent}</span>}
                          <span>{new Date(q.created_at).toLocaleDateString('mn-MN')}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => addToKB(q)}
                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                        >
                          📚 Мэдлэгт нэмэх
                        </button>
                        <button
                          onClick={() => updateQuestion(q.id, 'ignored')}
                          className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                        >
                          Алгасах
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Knowledge Base */}
        {tab === 'knowledge' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setEditingEntry(null); setKbQuestion(''); setKbAnswer(''); setShowKBForm(true) }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-all"
              >
                + Шинэ мэдлэг нэмэх
              </button>
            </div>

            {/* KB Form */}
            {showKBForm && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
                <h3 className="text-white font-medium mb-4">{editingEntry ? 'Засах' : 'Шинэ мэдлэг'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Асуулт</label>
                    <input
                      value={kbQuestion}
                      onChange={e => setKbQuestion(e.target.value)}
                      placeholder="Хүргэлт хэдий ирэх вэ?"
                      className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Хариулт</label>
                    <textarea
                      value={kbAnswer}
                      onChange={e => setKbAnswer(e.target.value)}
                      placeholder="Хүргэлт УБ дотор 1-2 цагт, хөдөө 2-3 хоногт хүрнэ."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Ангилал</label>
                    <select
                      value={kbCategory}
                      onChange={e => setKbCategory(e.target.value)}
                      className="px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="general">Ерөнхий</option>
                      <option value="product">Бүтээгдэхүүн</option>
                      <option value="delivery">Хүргэлт</option>
                      <option value="payment">Төлбөр</option>
                      <option value="return">Буцаалт</option>
                      <option value="hours">Ажиллах цаг</option>
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={saveKBEntry}
                      disabled={saving || !kbQuestion.trim() || !kbAnswer.trim()}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-all disabled:opacity-50"
                    >
                      {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                    </button>
                    <button
                      onClick={() => { setShowKBForm(false); setEditingEntry(null) }}
                      className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-xl transition-all"
                    >
                      Болих
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" />
              </div>
            ) : entries.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-white mb-2">Мэдлэгийн сан хоосон</h3>
                <p className="text-slate-400">AI-д зааж өгөх мэдээлэл нэмнэ үү</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map(e => (
                  <div key={e.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium mb-1">❓ {e.question}</p>
                        <p className="text-slate-300 text-sm mb-2">💬 {e.answer}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="px-2 py-0.5 bg-slate-700 rounded-full">{e.category}</span>
                          <span>{new Date(e.created_at).toLocaleDateString('mn-MN')}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => editKBEntry(e)} className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all">
                          ✏️
                        </button>
                        <button onClick={() => deleteKBEntry(e.id)} className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Stats */}
        {tab === 'stats' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Хариулаагүй асуулт', value: questions.length, icon: '❓', color: 'text-orange-400' },
              { label: 'Мэдлэгийн сан', value: entries.length, icon: '📚', color: 'text-blue-400' },
              { label: 'AI чанарын дундаж', value: stats?.avgScore ? `${stats.avgScore}%` : '—', icon: '📊', color: 'text-green-400' },
              { label: 'Нийт шинжилгээ', value: stats?.totalLogs ?? '—', icon: '🔍', color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 text-center">
                <div className="text-3xl mb-2">{s.icon}</div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-400 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
