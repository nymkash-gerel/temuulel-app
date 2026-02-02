'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Program {
  id: string
  name: string
  description: string | null
  program_type: string
  duration_weeks: number
  price: number
  max_students: number
  is_active: boolean
  created_at: string
}

interface NewProgram {
  name: string
  description: string
  program_type: string
  duration_weeks: string
  price: string
  max_students: string
  is_active: boolean
}

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  course: 'Course',
  workshop: 'Workshop',
  seminar: 'Seminar',
  certification: 'Certification',
  tutoring: 'Tutoring',
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function ProgramsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [programs, setPrograms] = useState<Program[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewProgram>({
    name: '',
    description: '',
    program_type: 'course',
    duration_weeks: '',
    price: '',
    max_students: '',
    is_active: true,
  })

  const loadPrograms = useCallback(async () => {
    try {
      const res = await fetch('/api/programs')
      if (res.ok) {
        const data = await res.json()
        setPrograms(Array.isArray(data) ? data : data.data || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await loadPrograms()
    }
    init()
  }, [supabase, loadPrograms])

  const filtered = programs.filter((p) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.description?.toLowerCase().includes(q)
      ) {
        return false
      }
    }

    if (typeFilter !== 'all' && p.program_type !== typeFilter) {
      return false
    }

    if (activeFilter === 'active' && !p.is_active) return false
    if (activeFilter === 'inactive' && p.is_active) return false

    return true
  })

  const stats = {
    total: programs.length,
    active: programs.filter((p) => p.is_active).length,
    inactive: programs.filter((p) => !p.is_active).length,
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          program_type: form.program_type,
          duration_weeks: parseInt(form.duration_weeks) || 1,
          price: parseFloat(form.price) || 0,
          max_students: parseInt(form.max_students) || 1,
          is_active: form.is_active,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to create program')
      }

      await loadPrograms()
      setShowForm(false)
      setForm({
        name: '',
        description: '',
        program_type: 'course',
        duration_weeks: '',
        price: '',
        max_students: '',
        is_active: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create program')
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-bold text-white">Programs</h1>
          <p className="text-slate-400 mt-1">
            {programs.length} programs total
            {filtered.length !== programs.length && ` (${filtered.length} shown)`}
          </p>
        </div>
        <Link
          href="/dashboard/programs/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> New Program
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Programs</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Inactive</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inactive}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Program</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Program Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Web Development Bootcamp"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Program Type *</label>
                <select
                  value={form.program_type}
                  onChange={(e) => setForm({ ...form, program_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  {Object.entries(PROGRAM_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Program description"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Duration (weeks) *</label>
                <input
                  type="number"
                  value={form.duration_weeks}
                  onChange={(e) => setForm({ ...form, duration_weeks: e.target.value })}
                  placeholder="e.g. 12"
                  min={1}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Price *</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0"
                  min={0}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Max Students *</label>
                <input
                  type="number"
                  value={form.max_students}
                  onChange={(e) => setForm({ ...form, max_students: e.target.value })}
                  placeholder="e.g. 30"
                  min={1}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer pb-3">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500"
                  />
                  <span className="text-white">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Program'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">&#128269;</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search programs..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">All Types</option>
              <option value="course">Course</option>
              <option value="workshop">Workshop</option>
              <option value="seminar">Seminar</option>
              <option value="certification">Certification</option>
              <option value="tutoring">Tutoring</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Programs Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Type</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Duration</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Price</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Max Students</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((program) => (
                <tr key={program.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <div>
                      <p className="text-white font-medium">{program.name}</p>
                      {program.description && (
                        <p className="text-slate-400 text-sm mt-0.5 truncate max-w-[250px]">{program.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      {PROGRAM_TYPE_LABELS[program.program_type] || program.program_type}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-slate-300">{program.duration_weeks} weeks</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-white font-medium">{formatPrice(program.price)}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-slate-300">{program.max_students}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      program.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {program.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(program.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : programs.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No programs match your filters</p>
          <button
            onClick={() => { setSearch(''); setTypeFilter('all'); setActiveFilter('all') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#127891;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Programs Yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Create your first program to start managing courses, workshops, and more.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Create First Program
          </button>
        </div>
      )}
    </div>
  )
}
