'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Admission {
  id: string
  patient_id: string
  attending_staff_id: string | null
  admit_diagnosis: string | null
  admit_at: string
  discharge_at: string | null
  discharge_summary: string | null
  status: string
  notes: string | null
  created_at: string
  patients: { id: string; first_name: string; last_name: string } | null
  staff: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  admitted: 'bg-blue-500/20 text-blue-400',
  discharged: 'bg-green-500/20 text-green-400',
  transferred: 'bg-yellow-500/20 text-yellow-400',
}

const STATUS_LABELS: Record<string, string> = {
  admitted: 'Хэвтсэн',
  discharged: 'Гарсан',
  transferred: 'Шилжүүлсэн',
}

export default function InpatientPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchAdmissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admissions?${params}`)
      if (!res.ok) throw new Error('Failed to fetch admissions')
      const json = await res.json()
      setAdmissions(json.data || [])
    } catch {
      setError('Could not load admissions')
    } finally {
      setLoading(false)
    }
  }, [supabase, statusFilter])

  useEffect(() => { fetchAdmissions() }, [fetchAdmissions])

  const stats = useMemo(() => ({
    total: admissions.length,
    admitted: admissions.filter(a => a.status === 'admitted').length,
    discharged: admissions.filter(a => a.status === 'discharged').length,
    transferred: admissions.filter(a => a.status === 'transferred').length,
  }), [admissions])

  async function handleDischarge(admissionId: string) {
    setActionId(admissionId)
    try {
      const res = await fetch(`/api/admissions/${admissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'discharged' }),
      })
      if (!res.ok) throw new Error('Failed to discharge')
      await fetchAdmissions()
    } catch {
      setError('Failed to discharge patient')
    } finally {
      setActionId(null)
    }
  }

  function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Inpatient</h1>
          <p className="text-slate-400 mt-1">Manage hospital admissions and discharges</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total Admissions</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Currently Admitted</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.admitted}</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Discharged</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.discharged}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Transferred</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.transferred}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
          <option value="">All Statuses</option>
          <option value="admitted">Currently Admitted</option>
          <option value="discharged">Discharged</option>
          <option value="transferred">Transferred</option>
        </select>
      </div>

      {/* Admissions Table */}
      {admissions.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Patient</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Diagnosis</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Attending</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Admitted</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Days</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admissions.map(admission => (
                <tr key={admission.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">
                      {admission.patients ? `${admission.patients.first_name} ${admission.patients.last_name}` : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{admission.admit_diagnosis || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{admission.staff?.name || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(admission.admit_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium text-sm">
                      {admission.status === 'admitted' ? daysSince(admission.admit_at) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[admission.status] || ''}`}>
                      {STATUS_LABELS[admission.status] || admission.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    {admission.status === 'admitted' && (
                      <button
                        onClick={() => handleDischarge(admission.id)}
                        disabled={actionId === admission.id}
                        className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                      >
                        {actionId === admission.id ? '...' : 'Discharge'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold text-white mb-2">No admissions yet</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Inpatient admissions will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
