'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Prescription {
  id: string
  patient_id: string
  encounter_id: string | null
  prescribed_by: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  patients: { id: string; first_name: string; last_name: string } | null
  prescription_items: PrescriptionItem[]
}

interface PrescriptionItem {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  duration: string | null
  instructions: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  expired: 'bg-slate-500/20 text-slate-400',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Идэвхтэй',
  completed: 'Олгосон',
  cancelled: 'Цуцалсан',
  expired: 'Хугацаа дууссан',
}

export default function PharmacyPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dispensing, setDispensing] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) { setLoading(false); return }

        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)

        const res = await fetch(`/api/prescriptions?${params}`)
        if (cancelled) return
        if (!res.ok) throw new Error('Failed to fetch prescriptions')
        const json = await res.json()
        setPrescriptions(json.data || [])
      } catch {
        if (!cancelled) setError('Could not load prescriptions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase, statusFilter])

  async function fetchPrescriptions() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/prescriptions?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setPrescriptions(json.data || [])
    } catch {
      setError('Could not load prescriptions')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => ({
    total: prescriptions.length,
    active: prescriptions.filter(p => p.status === 'active').length,
    completed: prescriptions.filter(p => p.status === 'completed').length,
    totalMeds: prescriptions.reduce((sum, p) => sum + (p.prescription_items?.length || 0), 0),
  }), [prescriptions])

  async function handleDispense(prescriptionId: string) {
    setDispensing(prescriptionId)
    try {
      const res = await fetch(`/api/prescriptions/${prescriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (!res.ok) throw new Error('Failed to dispense')
      await fetchPrescriptions()
    } catch {
      setError('Failed to mark as dispensed')
    } finally {
      setDispensing(null)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Pharmacy</h1>
          <p className="text-slate-400 mt-1">Prescription queue and dispensing</p>
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
          <p className="text-blue-400 text-sm">Total Prescriptions</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Pending Dispense</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Dispensed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Total Medications</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalMeds}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
          <option value="">All Statuses</option>
          <option value="active">Active (Pending)</option>
          <option value="completed">Dispensed</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Prescription Cards */}
      {prescriptions.length > 0 ? (
        <div className="space-y-4">
          {prescriptions.map(rx => (
            <div key={rx.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-white font-medium">
                    {rx.patients ? `${rx.patients.first_name} ${rx.patients.last_name}` : 'Unknown Patient'}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {new Date(rx.created_at).toLocaleDateString('mn-MN')} &middot; {rx.prescription_items?.length || 0} medications
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[rx.status] || ''}`}>
                    {STATUS_LABELS[rx.status] || rx.status}
                  </span>
                  {rx.status === 'active' && (
                    <button
                      onClick={() => handleDispense(rx.id)}
                      disabled={dispensing === rx.id}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all"
                    >
                      {dispensing === rx.id ? 'Dispensing...' : 'Mark Dispensed'}
                    </button>
                  )}
                </div>
              </div>

              {/* Medication List */}
              {rx.prescription_items && rx.prescription_items.length > 0 && (
                <div className="border-t border-slate-700 pt-4">
                  <div className="grid gap-3">
                    {rx.prescription_items.map(item => (
                      <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                        <span className="text-white font-medium min-w-[200px]">{item.medication_name}</span>
                        <span className="text-slate-400">{item.dosage}</span>
                        <span className="text-slate-400">{item.frequency}</span>
                        {item.duration && <span className="text-slate-400">{item.duration}</span>}
                        {item.instructions && <span className="text-slate-500 italic">{item.instructions}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rx.notes && (
                <p className="text-slate-400 text-sm mt-3 border-t border-slate-700 pt-3">{rx.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold text-white mb-2">No prescriptions yet</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Prescriptions will appear here when created from patient encounters.
          </p>
        </div>
      )}
    </div>
  )
}
