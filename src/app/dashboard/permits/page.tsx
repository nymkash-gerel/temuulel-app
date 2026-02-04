'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface Permit {
  id: string
  project_id: string
  permit_type: string
  permit_number: string | null
  issued_date: string | null
  expiry_date: string | null
  cost: number | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  applied: { label: 'Хүсэлт гаргасан', color: 'bg-blue-500/20 text-blue-400' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-green-500/20 text-green-400' },
  expired: { label: 'Хугацаа дууссан', color: 'bg-yellow-500/20 text-yellow-400' },
  rejected: { label: 'Татгалзсан', color: 'bg-red-500/20 text-red-400' },
}

const TYPE_LABELS: Record<string, string> = {
  building: 'Барилга',
  electrical: 'Цахилгаан',
  plumbing: 'Сантехник',
  demolition: 'Нураалт',
  environmental: 'Байгаль орчин',
  other: 'Бусад',
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function PermitsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [permits, setPermits] = useState<Permit[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formProjectId, setFormProjectId] = useState('')
  const [formPermitType, setFormPermitType] = useState('building')
  const [formPermitNumber, setFormPermitNumber] = useState('')
  const [formIssuedDate, setFormIssuedDate] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formCost, setFormCost] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadPermits = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter) params.set('status', statusFilter)
    if (typeFilter) params.set('permit_type', typeFilter)

    const res = await fetch(`/api/permits?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setPermits(json.data || [])
      setTotalCount(json.total ?? (json.data?.length || 0))
    }
  }, [statusFilter, typeFilter])

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
          loadPermits(),
          supabase.from('projects').select('id, name').eq('store_id', store.id).order('name'),
        ])

        if (projectsRes.data) setProjects(projectsRes.data)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadPermits])

  useEffect(() => {
    if (loading) return
    const reload = async () => { await loadPermits() }
    reload()
  }, [loading, loadPermits])

  const kpis = useMemo(() => {
    const total = permits.length
    const applied = permits.filter(p => p.status === 'applied').length
    const approved = permits.filter(p => p.status === 'approved').length
    const expired = permits.filter(p => p.status === 'expired').length
    const totalCost = permits.reduce((sum, p) => sum + (p.cost || 0), 0)
    return [
      { label: 'Нийт зөвшөөрөл', value: total },
      { label: 'Хүсэлт', value: applied },
      { label: 'Зөвшөөрсөн', value: approved },
      { label: 'Хугацаа дууссан', value: expired },
      { label: 'Нийт зардал', value: formatPrice(totalCost) },
    ]
  }, [permits])

  async function handleCreate() {
    if (!formProjectId) return
    setCreating(true)
    try {
      const res = await fetch('/api/permits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: formProjectId,
          permit_type: formPermitType,
          permit_number: formPermitNumber.trim() || null,
          issued_date: formIssuedDate || null,
          expiry_date: formExpiryDate || null,
          cost: formCost ? Number(formCost) : null,
          notes: formNotes.trim() || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadPermits()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormProjectId('')
    setFormPermitType('building')
    setFormPermitNumber('')
    setFormIssuedDate('')
    setFormExpiryDate('')
    setFormCost('')
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
          <h1 className="text-2xl font-bold text-white">Зөвшөөрлүүд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} зөвшөөрөл
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ зөвшөөрөл
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
              <option value="applied">Хүсэлт гаргасан</option>
              <option value="approved">Зөвшөөрсөн</option>
              <option value="expired">Хугацаа дууссан</option>
              <option value="rejected">Татгалзсан</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төрөл</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="building">Барилга</option>
              <option value="electrical">Цахилгаан</option>
              <option value="plumbing">Сантехник</option>
              <option value="demolition">Нураалт</option>
              <option value="environmental">Байгаль орчин</option>
              <option value="other">Бусад</option>
            </select>
          </div>
        </div>
        {(statusFilter || typeFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {permits.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дугаар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төсөл</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зардал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Олгосон</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дуусах</th>
              </tr>
            </thead>
            <tbody>
              {permits.map((permit) => {
                const sc = STATUS_CONFIG[permit.status] || { label: permit.status, color: 'bg-slate-500/20 text-slate-400' }
                const project = projects.find(p => p.id === permit.project_id)
                return (
                  <tr key={permit.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-white font-medium">{permit.permit_number || '-'}</p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {TYPE_LABELS[permit.permit_type] || permit.permit_type}
                      </span>
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
                      <span className="text-white text-sm">
                        {permit.cost != null ? formatPrice(permit.cost) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {permit.issued_date
                          ? new Date(permit.issued_date).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {permit.expiry_date
                          ? new Date(permit.expiry_date).toLocaleDateString('mn-MN')
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
            <span className="text-4xl">&#128220;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Зөвшөөрөл байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || typeFilter
              ? 'Шүүлтүүрт тохирох зөвшөөрөл олдсонгүй.'
              : 'Шинэ зөвшөөрөл нэмж эхлээрэй.'}
          </p>
          {(statusFilter || typeFilter) ? (
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm"
            >
              + Шинэ зөвшөөрөл үүсгэх
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ зөвшөөрөл</h2>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төрөл</label>
                <select
                  value={formPermitType}
                  onChange={e => setFormPermitType(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="building">Барилга</option>
                  <option value="electrical">Цахилгаан</option>
                  <option value="plumbing">Сантехник</option>
                  <option value="demolition">Нураалт</option>
                  <option value="environmental">Байгаль орчин</option>
                  <option value="other">Бусад</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Зөвшөөрлийн дугаар</label>
                <input
                  type="text"
                  value={formPermitNumber}
                  onChange={e => setFormPermitNumber(e.target.value)}
                  placeholder="P-12345"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Олгосон огноо</label>
                <input
                  type="date"
                  value={formIssuedDate}
                  onChange={e => setFormIssuedDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Дуусах огноо</label>
                <input
                  type="date"
                  value={formExpiryDate}
                  onChange={e => setFormExpiryDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Зардал</label>
              <input
                type="number"
                value={formCost}
                onChange={e => setFormCost(e.target.value)}
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
                disabled={creating || !formProjectId}
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
