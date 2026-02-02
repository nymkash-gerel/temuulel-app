'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Enrollment {
  id: string
  student_id: string
  program_id: string
  status: 'active' | 'completed' | 'dropped' | 'suspended'
  enrolled_at: string
  completed_at: string | null
  grade: string | null
  notes: string | null
  students: { id: string; first_name: string; last_name: string } | null
  programs: { id: string; name: string | null } | null
}

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface Program {
  id: string
  name: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Completed', color: 'bg-blue-500/20 text-blue-400' },
  dropped: { label: 'Dropped', color: 'bg-red-500/20 text-red-400' },
  suspended: { label: 'Suspended', color: 'bg-yellow-500/20 text-yellow-400' },
}

export default function EnrollmentsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Create form state
  const [formStudentId, setFormStudentId] = useState('')
  const [formProgramId, setFormProgramId] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await fetch('/api/enrollments')
      if (res.ok) {
        const data = await res.json()
        setEnrollments(data.data || data.enrollments || data || [])
      }
    } catch {
      // Failed to load enrollments
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        const [studentsRes, programsRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, first_name, last_name')
            .eq('store_id', store.id)
            .order('first_name'),
          supabase
            .from('programs')
            .select('id, name')
            .eq('store_id', store.id)
            .order('name'),
        ])

        if (studentsRes.data) setStudents(studentsRes.data as Student[])
        if (programsRes.data) setPrograms(programsRes.data as Program[])
      }

      await loadEnrollments()
      setLoading(false)
    }
    load()
  }, [supabase, loadEnrollments])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return enrollments
    return enrollments.filter(e => e.status === statusFilter)
  }, [enrollments, statusFilter])

  const stats = useMemo(() => ({
    active: enrollments.filter(e => e.status === 'active').length,
    completed: enrollments.filter(e => e.status === 'completed').length,
    dropped: enrollments.filter(e => e.status === 'dropped').length,
    suspended: enrollments.filter(e => e.status === 'suspended').length,
  }), [enrollments])

  async function handleCreate() {
    if (!formStudentId || !formProgramId) return
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: formStudentId,
          program_id: formProgramId,
          notes: formNotes.trim() || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const newEnrollment = data.enrollment || data
        setEnrollments(prev => [newEnrollment, ...prev])
        setShowCreateForm(false)
        setFormStudentId('')
        setFormProgramId('')
        setFormNotes('')
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to create enrollment')
      }
    } catch {
      setError('An error occurred')
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
          <h1 className="text-2xl font-bold text-white">Enrollments</h1>
          <p className="text-slate-400 mt-1">
            Total {enrollments.length} enrollments
            {filtered.length !== enrollments.length && ` (${filtered.length} shown)`}
          </p>
        </div>
        <Link
          href="/dashboard/enrollments/new"
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
        >
          + New Enrollment
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Dropped</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.dropped}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Suspended</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.suspended}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">New Enrollment</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Student *</label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a student</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Program *</label>
                <select
                  value={formProgramId}
                  onChange={(e) => setFormProgramId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a program</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name || p.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Additional notes..."
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
                disabled={creating || !formStudentId || !formProgramId}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Enrollment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrollments Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Student</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Program</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Enrolled At</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Completed At</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Grade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((enrollment) => {
                const sc = STATUS_CONFIG[enrollment.status] || STATUS_CONFIG.active
                return (
                  <tr key={enrollment.id} onClick={() => router.push(`/dashboard/enrollments/${enrollment.id}`)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">
                        {enrollment.students ? `${enrollment.students.first_name} ${enrollment.students.last_name}` : 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">
                        {enrollment.programs?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(enrollment.enrolled_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {enrollment.completed_at
                          ? new Date(enrollment.completed_at).toLocaleDateString()
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white text-sm">
                        {enrollment.grade || '-'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : enrollments.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No enrollments match the selected filter</p>
          <button
            onClick={() => setStatusFilter('all')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📋</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No enrollments yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Create your first enrollment by clicking the button above
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Create first enrollment
          </button>
        </div>
      )}
    </div>
  )
}
