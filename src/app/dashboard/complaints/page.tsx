'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Complaint {
  id: string
  patient_id: string | null
  encounter_id: string | null
  category: string
  severity: string
  description: string
  status: string
  assigned_to: string | null
  resolution: string | null
  resolved_at: string | null
  created_at: string
  patients: { id: string; first_name: string; last_name: string } | null
  staff: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500/20 text-red-400',
  assigned: 'bg-yellow-500/20 text-yellow-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-green-500/20 text-green-400',
  closed: 'bg-slate-500/20 text-slate-400',
}

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-slate-500/20 text-slate-400',
  moderate: 'bg-orange-500/20 text-orange-400',
  serious: 'bg-red-500/20 text-red-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  wait_time: 'Wait Time',
  treatment: 'Treatment',
  staff_behavior: 'Staff Behavior',
  facility: 'Facility',
  billing: 'Billing',
  other: 'Other',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Нээлттэй',
  assigned: 'Хуваарилсан',
  reviewed: 'Шалгасан',
  resolved: 'Шийдвэрлэсэн',
  closed: 'Хаасан',
}

export default function ComplaintsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) { setLoading(false); return }

        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)
        if (categoryFilter) params.set('category', categoryFilter)
        if (severityFilter) params.set('severity', severityFilter)

        const res = await fetch(`/api/medical-complaints?${params}`)
        if (cancelled) return
        if (!res.ok) throw new Error('Failed to fetch complaints')
        const json = await res.json()
        setComplaints(json.data || [])
      } catch {
        if (!cancelled) setError('Could not load complaints')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase, statusFilter, categoryFilter, severityFilter])

  const stats = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter(c => c.status === 'open').length,
    assigned: complaints.filter(c => c.status === 'assigned').length,
    resolved: complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length,
    serious: complaints.filter(c => c.severity === 'serious').length,
  }), [complaints])

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
          <h1 className="text-2xl font-bold text-white">Complaints & QA</h1>
          <p className="text-slate-400 mt-1">Track and resolve patient complaints</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Open</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.open}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Assigned</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.assigned}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Resolved</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.resolved}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Serious</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.serious}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">All Categories</option>
            <option value="wait_time">Wait Time</option>
            <option value="treatment">Treatment</option>
            <option value="staff_behavior">Staff Behavior</option>
            <option value="facility">Facility</option>
            <option value="billing">Billing</option>
            <option value="other">Other</option>
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">All Severities</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="serious">Serious</option>
          </select>
        </div>
      </div>

      {/* Complaints List */}
      {complaints.length > 0 ? (
        <div className="space-y-4">
          {complaints.map(complaint => (
            <div key={complaint.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[complaint.status] || ''}`}>
                      {STATUS_LABELS[complaint.status] || complaint.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_COLORS[complaint.severity] || ''}`}>
                      {complaint.severity.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-600/50 text-slate-300">
                      {CATEGORY_LABELS[complaint.category] || complaint.category}
                    </span>
                  </div>
                  <p className="text-white">{complaint.description}</p>
                </div>
                <div className="text-right text-sm text-slate-400 shrink-0">
                  {new Date(complaint.created_at).toLocaleDateString('mn-MN')}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                {complaint.patients && (
                  <span>Patient: <span className="text-slate-300">{complaint.patients.first_name} {complaint.patients.last_name}</span></span>
                )}
                {complaint.staff && (
                  <span>Assigned to: <span className="text-slate-300">{complaint.staff.name}</span></span>
                )}
              </div>

              {complaint.resolution && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-sm text-slate-400">Resolution: <span className="text-slate-300">{complaint.resolution}</span></p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold text-white mb-2">No complaints</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Patient complaints and quality assurance issues will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
