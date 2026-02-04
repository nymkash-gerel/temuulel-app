'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface CrewMember {
  id: string
  name: string
  role: string | null
  phone: string | null
  hourly_rate: number | null
  certifications: string[] | null
  status: string
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  inactive: { label: 'Идэвхгүй', color: 'bg-slate-500/20 text-slate-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function CrewPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formHourlyRate, setFormHourlyRate] = useState('')
  const [formCertifications, setFormCertifications] = useState('')

  const loadCrew = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/crew-members?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setCrew(json.data || [])
      setTotalCount(json.total ?? (json.data?.length || 0))
    }
  }, [statusFilter])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      await loadCrew()
      setLoading(false)
    }
    init()
  }, [supabase, router, loadCrew])

  useEffect(() => {
    if (loading) return
    const reload = async () => { await loadCrew() }
    reload()
  }, [loading, loadCrew])

  const kpis = useMemo(() => {
    const total = crew.length
    const active = crew.filter(c => c.status === 'active').length
    const inactive = crew.filter(c => c.status === 'inactive').length
    const avgRate = crew.filter(c => c.hourly_rate).length > 0
      ? crew.reduce((sum, c) => sum + (c.hourly_rate || 0), 0) / crew.filter(c => c.hourly_rate).length
      : 0
    return [
      { label: 'Нийт гишүүд', value: total },
      { label: 'Идэвхтэй', value: active },
      { label: 'Идэвхгүй', value: inactive },
      { label: 'Дундаж цалин/цаг', value: avgRate > 0 ? formatPrice(Math.round(avgRate)) : '-' },
    ]
  }, [crew])

  async function handleCreate() {
    if (!formName.trim()) return
    setCreating(true)
    try {
      const certArray = formCertifications.trim()
        ? formCertifications.split(',').map(c => c.trim()).filter(Boolean)
        : undefined

      const res = await fetch('/api/crew-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          role: formRole.trim() || null,
          phone: formPhone.trim() || null,
          hourly_rate: formHourlyRate ? Number(formHourlyRate) : null,
          certifications: certArray,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadCrew()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormName('')
    setFormRole('')
    setFormPhone('')
    setFormHourlyRate('')
    setFormCertifications('')
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
          <h1 className="text-2xl font-bold text-white">Багийн гишүүд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} гишүүн
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ гишүүн
        </button>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="active">Идэвхтэй</option>
              <option value="inactive">Идэвхгүй</option>
            </select>
          </div>
        </div>
        {statusFilter && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setStatusFilter('')}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {crew.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үүрэг</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Утас</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Цагийн цалин</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Гэрчилгээ</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((member) => {
                const sc = STATUS_CONFIG[member.status] || { label: member.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={member.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-white font-medium">{member.name}</p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{member.role || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{member.phone || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white text-sm">
                        {member.hourly_rate != null ? formatPrice(member.hourly_rate) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex flex-wrap gap-1">
                        {member.certifications && member.certifications.length > 0 ? (
                          member.certifications.map((cert, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                              {cert}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
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
            <span className="text-4xl">&#128119;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Багийн гишүүн байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter
              ? 'Шүүлтүүрт тохирох гишүүн олдсонгүй.'
              : 'Шинэ багийн гишүүн нэмж эхлээрэй.'}
          </p>
          {statusFilter ? (
            <button
              onClick={() => setStatusFilter('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm"
            >
              + Шинэ гишүүн нэмэх
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ багийн гишүүн</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Нэр *</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Гишүүний нэр"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Үүрэг</label>
              <input
                type="text"
                value={formRole}
                onChange={e => setFormRole(e.target.value)}
                placeholder="Жишээ: Барилгачин, Цахилгаанчин"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Утасны дугаар</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="99001122"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Цагийн цалин</label>
                <input
                  type="number"
                  value={formHourlyRate}
                  onChange={e => setFormHourlyRate(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Гэрчилгээ (таслалаар тусгаарлах)</label>
              <input
                type="text"
                value={formCertifications}
                onChange={e => setFormCertifications(e.target.value)}
                placeholder="Жишээ: OSHA, Гагнуур, Цахилгаан"
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
                disabled={creating || !formName.trim()}
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
