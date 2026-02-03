'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface MaterialOrder {
  id: string
  project_id: string
  supplier_name: string
  order_date: string
  expected_delivery: string | null
  status: string
  total_cost: number
  notes: string | null
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ordered: { label: 'Захиалсан', color: 'bg-blue-500/20 text-blue-400' },
  shipped: { label: 'Илгээсэн', color: 'bg-yellow-500/20 text-yellow-400' },
  delivered: { label: 'Хүргэгдсэн', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function MaterialsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [materials, setMaterials] = useState<MaterialOrder[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formProjectId, setFormProjectId] = useState('')
  const [formSupplierName, setFormSupplierName] = useState('')
  const [formOrderDate, setFormOrderDate] = useState('')
  const [formExpectedDelivery, setFormExpectedDelivery] = useState('')
  const [formTotalCost, setFormTotalCost] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadMaterials = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter) params.set('status', statusFilter)
    if (projectFilter) params.set('project_id', projectFilter)

    const res = await fetch(`/api/material-orders?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setMaterials(json.data || [])
      setTotalCount(json.total ?? (json.data?.length || 0))
    }
  }, [statusFilter, projectFilter])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        const [, projectsRes] = await Promise.all([
          loadMaterials(),
          supabase.from('projects').select('id, name').eq('store_id', store.id).order('name'),
        ])

        if (projectsRes.data) setProjects(projectsRes.data)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadMaterials])

  useEffect(() => {
    if (loading) return
    const reload = async () => { await loadMaterials() }
    reload()
  }, [loading, statusFilter, projectFilter, loadMaterials])

  const kpis = useMemo(() => {
    const total = materials.length
    const ordered = materials.filter(m => m.status === 'ordered').length
    const shipped = materials.filter(m => m.status === 'shipped').length
    const delivered = materials.filter(m => m.status === 'delivered').length
    const totalCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0)
    return [
      { label: 'Нийт захиалга', value: total },
      { label: 'Захиалсан', value: ordered },
      { label: 'Илгээсэн', value: shipped },
      { label: 'Хүргэгдсэн', value: delivered },
      { label: 'Нийт зардал', value: formatPrice(totalCost) },
    ]
  }, [materials])

  async function handleCreate() {
    if (!formProjectId || !formSupplierName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/material-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: formProjectId,
          supplier_name: formSupplierName.trim(),
          order_date: formOrderDate || undefined,
          expected_delivery: formExpectedDelivery || null,
          total_cost: formTotalCost ? Number(formTotalCost) : 0,
          notes: formNotes.trim() || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadMaterials()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormProjectId('')
    setFormSupplierName('')
    setFormOrderDate('')
    setFormExpectedDelivery('')
    setFormTotalCost('')
    setFormNotes('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Материалын захиалга</h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} захиалга
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ захиалга
        </button>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="ordered">Захиалсан</option>
              <option value="shipped">Илгээсэн</option>
              <option value="delivered">Хүргэгдсэн</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төсөл</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төсөл</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        {(statusFilter || projectFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setProjectFilter('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {materials.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нийлүүлэгч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төсөл</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нийт зардал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалсан</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүлээгдэж буй</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const sc = STATUS_CONFIG[m.status] || { label: m.status, color: 'bg-slate-500/20 text-slate-400' }
                const project = projects.find(p => p.id === m.project_id)
                return (
                  <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-white font-medium">{m.supplier_name}</p>
                      {m.notes && (
                        <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]" title={m.notes}>
                          {m.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{project?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white text-sm">{formatPrice(m.total_cost)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {new Date(m.order_date).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {m.expected_delivery
                          ? new Date(m.expected_delivery).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#129521;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Материалын захиалга байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || projectFilter
              ? 'Шүүлтүүрт тохирох захиалга олдсонгүй.'
              : 'Шинэ материалын захиалга нэмж эхлээрэй.'}
          </p>
          {(statusFilter || projectFilter) ? (
            <button
              onClick={() => { setStatusFilter(''); setProjectFilter('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm"
            >
              + Шинэ захиалга үүсгэх
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ материалын захиалга</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Төсөл *</label>
              <select
                value={formProjectId}
                onChange={e => setFormProjectId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">-- Сонгох --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Нийлүүлэгчийн нэр *</label>
              <input
                type="text"
                value={formSupplierName}
                onChange={e => setFormSupplierName(e.target.value)}
                placeholder="Нийлүүлэгчийн нэр"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Захиалсан огноо</label>
                <input
                  type="date"
                  value={formOrderDate}
                  onChange={e => setFormOrderDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хүлээгдэж буй огноо</label>
                <input
                  type="date"
                  value={formExpectedDelivery}
                  onChange={e => setFormExpectedDelivery(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Нийт зардал</label>
              <input
                type="number"
                value={formTotalCost}
                onChange={e => setFormTotalCost(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Нэмэлт тэмдэглэл"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Болих
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formProjectId || !formSupplierName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Үүсгэж байна...' : 'Үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
