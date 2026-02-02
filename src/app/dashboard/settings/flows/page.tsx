'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FlowSummary {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  trigger_type: string
  times_triggered: number
  times_completed: number
  updated_at: string
}

interface TemplateSummary {
  business_type: string
  name: string
  description: string
  trigger_type: string
  node_count: number
}

const triggerLabels: Record<string, string> = {
  keyword: 'Түлхүүр үг',
  new_conversation: 'Шинэ яриа',
  button_click: 'Товч дарах',
  intent_match: 'Зорилго',
}

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'Ноорог', class: 'bg-slate-500/20 text-slate-400' },
  active: { label: 'Идэвхтэй', class: 'bg-green-500/20 text-green-400' },
  archived: { label: 'Архив', class: 'bg-yellow-500/20 text-yellow-400' },
}

export default function FlowsPage() {
  const router = useRouter()
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/flows').then((r) => r.json()),
      fetch('/api/flows/templates').then((r) => r.json()),
    ])
      .then(([flowData, templateData]) => {
        setFlows(flowData.flows ?? [])
        setTemplates(templateData.templates ?? [])
      })
      .catch((err) => {
        console.error(err)
        setError('Өгөгдөл ачаалахад алдаа гарлаа. Хуудсаа дахин ачаална уу.')
      })
      .finally(() => setLoading(false))
  }, [])

  const createBlankFlow = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Шинэ урсгал',
          trigger_type: 'keyword',
          trigger_config: { keywords: [], match_mode: 'any' },
          nodes: [
            {
              id: 'trigger_1',
              type: 'trigger',
              position: { x: 250, y: 50 },
              data: { label: 'Эхлэл', config: { type: 'trigger' } },
            },
          ],
          edges: [],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/settings/flows/${data.flow.id}`)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Урсгал үүсгэхэд алдаа гарлаа (${res.status})`)
      }
    } catch (err) {
      console.error('Create flow error:', err)
      setError('Сервертэй холбогдож чадсангүй')
    } finally {
      setCreating(false)
    }
  }, [router])

  const createFromTemplate = useCallback(
    async (businessType: string) => {
      setCreating(true)
      setError(null)
      try {
        const tplRes = await fetch(`/api/flows/templates?business_type=${businessType}`)
        if (!tplRes.ok) {
          setError('Загвар олдсонгүй')
          setCreating(false)
          return
        }
        const { template } = await tplRes.json()

        const res = await fetch('/api/flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            trigger_type: template.trigger_type,
            trigger_config: template.trigger_config,
            nodes: template.nodes,
            edges: template.edges,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          router.push(`/dashboard/settings/flows/${data.flow.id}`)
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || `Загвараас урсгал үүсгэхэд алдаа гарлаа (${res.status})`)
        }
      } catch (err) {
        console.error('Create from template error:', err)
        setError('Сервертэй холбогдож чадсангүй')
      } finally {
        setCreating(false)
      }
    },
    [router]
  )

  const deleteFlow = useCallback(async (id: string) => {
    if (!confirm('Энэ урсгалыг устгах уу?')) return
    const res = await fetch(`/api/flows/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFlows((prev) => prev.filter((f) => f.id !== id))
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Чат урсгал</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Хэрэглэгчидтэй автомат яриа удирдах
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            disabled={creating}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            Загвар ашиглах
          </button>
          <button
            onClick={createBlankFlow}
            disabled={creating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {creating ? 'Үүсгэж байна...' : '+ Шинэ урсгал'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/70 hover:text-red-300 ml-3">
            &times;
          </button>
        </div>
      )}

      {/* Template selector */}
      {showTemplates && (
        <div className="mb-6 bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-white mb-3">Загвар сонгох</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {templates.map((tpl) => (
              <button
                key={tpl.business_type}
                onClick={() => createFromTemplate(tpl.business_type)}
                className="p-3 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/50 rounded-xl text-left transition-colors"
              >
                <p className="text-sm text-white font-medium">{tpl.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{tpl.description}</p>
                <p className="text-xs text-cyan-400/70 mt-1">{tpl.node_count} нод</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flow list */}
      {flows.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">
            Одоогоор урсгал байхгүй байна
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Шинэ урсгал үүсгэх эсвэл загвар ашиглаарай
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {flows.map((flow) => {
            const status = statusLabels[flow.status] ?? statusLabels.draft
            return (
              <div
                key={flow.id}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/settings/flows/${flow.id}`}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-white font-medium">{flow.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${status.class}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-slate-500">
                            {triggerLabels[flow.trigger_type] ?? flow.trigger_type}
                          </span>
                          <span className="text-xs text-slate-500">
                            {flow.times_triggered} удаа ажилласан
                          </span>
                          {flow.times_completed > 0 && (
                            <span className="text-xs text-green-500/70">
                              {flow.times_completed} дуусгасан
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/settings/flows/${flow.id}`}
                      className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                    >
                      Засварлах
                    </Link>
                    <button
                      onClick={() => deleteFlow(flow.id)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg transition-colors"
                    >
                      Устгах
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
