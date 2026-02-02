'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Patient {
  id: string
  first_name: string
  last_name: string
}

interface Encounter {
  id: string
  encounter_type: string
  status: string
  chief_complaint: string | null
  encounter_date: string | null
  created_at: string
  patients: { id: string; first_name: string; last_name: string } | null
}

type StatusFilter = 'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
}

const ENCOUNTER_TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow Up',
  emergency: 'Emergency',
  procedure: 'Procedure',
  lab_visit: 'Lab Visit',
}

export default function EncountersPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formPatientId, setFormPatientId] = useState('')
  const [formEncounterType, setFormEncounterType] = useState('consultation')
  const [formChiefComplaint, setFormChiefComplaint] = useState('')
  const [formEncounterDate, setFormEncounterDate] = useState('')

  const fetchEncounters = useCallback(async () => {
    try {
      const res = await fetch('/api/encounters')
      if (res.ok) {
        const data = await res.json()
        setEncounters(Array.isArray(data) ? data : data.data || data.encounters || [])
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    async function load() {
      // Fetch patients for the dropdown
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .order('first_name')

      if (patientsData) {
        setPatients(patientsData as Patient[])
      }

      await fetchEncounters()
      setLoading(false)
    }

    load()
  }, [supabase, fetchEncounters])

  const filtered = useMemo(() => {
    let result = encounters

    if (statusFilter !== 'all') {
      result = result.filter(e => e.status === statusFilter)
    }

    if (typeFilter) {
      result = result.filter(e => e.encounter_type === typeFilter)
    }

    return result
  }, [encounters, statusFilter, typeFilter])

  const stats = useMemo(() => ({
    scheduled: encounters.filter(e => e.status === 'scheduled').length,
    in_progress: encounters.filter(e => e.status === 'in_progress').length,
    completed: encounters.filter(e => e.status === 'completed').length,
    cancelled: encounters.filter(e => e.status === 'cancelled').length,
  }), [encounters])

  async function handleCreate() {
    if (!formPatientId || !formEncounterType) return
    setCreating(true)

    try {
      const res = await fetch('/api/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: formPatientId,
          encounter_type: formEncounterType,
          chief_complaint: formChiefComplaint.trim() || undefined,
          encounter_date: formEncounterDate || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const newEncounter = data.encounter || data
        setEncounters(prev => [newEncounter, ...prev])
        setShowCreateForm(false)
        setFormPatientId('')
        setFormEncounterType('consultation')
        setFormChiefComplaint('')
        setFormEncounterDate('')
      } else {
        const err = await res.json()
        alert(err.error || 'Error creating encounter')
      }
    } catch {
      alert('An error occurred')
    } finally {
      setCreating(false)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Encounters</h1>
          <p className="text-slate-400 mt-1">
            Total {encounters.length} encounters
            {filtered.length !== encounters.length && ` (${filtered.length} shown)`}
          </p>
        </div>
        <Link
          href="/dashboard/encounters/new"
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
        >
          + New Encounter
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Scheduled</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.scheduled}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.in_progress}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Cancelled</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.cancelled}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">All Types</option>
            <option value="consultation">Consultation</option>
            <option value="follow_up">Follow Up</option>
            <option value="emergency">Emergency</option>
            <option value="procedure">Procedure</option>
            <option value="lab_visit">Lab Visit</option>
          </select>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">New Encounter</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Patient *</label>
                <select
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Encounter Type *</label>
                <select
                  value={formEncounterType}
                  onChange={(e) => setFormEncounterType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="consultation">Consultation</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="emergency">Emergency</option>
                  <option value="procedure">Procedure</option>
                  <option value="lab_visit">Lab Visit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Chief Complaint</label>
                <textarea
                  value={formChiefComplaint}
                  onChange={(e) => setFormChiefComplaint(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Describe the chief complaint..."
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Encounter Date</label>
                <input
                  type="datetime-local"
                  value={formEncounterDate}
                  onChange={(e) => setFormEncounterDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formPatientId}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Encounter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encounters Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Patient</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Chief Complaint</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Encounter Date</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((enc) => {
                const sc = STATUS_CONFIG[enc.status] || STATUS_CONFIG.scheduled
                return (
                  <tr key={enc.id} onClick={() => router.push(`/dashboard/encounters/${enc.id}`)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">
                        {enc.patients ? `${enc.patients.first_name} ${enc.patients.last_name}` : 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {ENCOUNTER_TYPE_LABELS[enc.encounter_type] || enc.encounter_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm truncate block max-w-[200px]">
                        {enc.chief_complaint || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {enc.encounter_date
                          ? new Date(enc.encounter_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(enc.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : encounters.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No encounters match the current filters</p>
          <button
            onClick={() => { setStatusFilter('all'); setTypeFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📋</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No encounters yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Create your first encounter to start tracking patient visits
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Create first encounter
          </button>
        </div>
      )}
    </div>
  )
}
