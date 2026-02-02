'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string | null
  blood_type: string | null
  phone: string | null
  email: string | null
  created_at: string
}

interface PatientForm {
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  phone: string
  email: string
}

const GENDER_OPTIONS = [
  { value: '', label: 'Сонгох...' },
  { value: 'male', label: 'Эрэгтэй' },
  { value: 'female', label: 'Эмэгтэй' },
  { value: 'other', label: 'Бусад' },
]

const BLOOD_TYPE_OPTIONS = [
  { value: '', label: 'Сонгох...' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
]

const GENDER_LABELS: Record<string, string> = {
  male: 'Эрэгтэй',
  female: 'Эмэгтэй',
  other: 'Бусад',
}

const INITIAL_FORM: PatientForm = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  blood_type: '',
  phone: '',
  email: '',
}

export default function PatientsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PatientForm>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPatients = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/patients')
      if (!res.ok) {
        throw new Error('Failed to fetch patients')
      }
      const data = await res.json()
      setPatients(Array.isArray(data) ? data : data.patients || [])
    } catch {
      setError('Could not load patients')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  const filtered = useMemo(() => {
    if (!search.trim()) return patients

    const q = search.trim().toLowerCase()
    return patients.filter((p) =>
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  }, [patients, search])

  function handleFormChange(field: keyof PatientForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          blood_type: form.blood_type || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to create patient')
      }

      setSuccess('Patient created successfully')
      setForm(INITIAL_FORM)
      setShowForm(false)
      await fetchPatients()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
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
          <h1 className="text-2xl font-bold text-white">Patients</h1>
          <p className="text-slate-400 mt-1">
            Total {patients.length} patients
            {filtered.length !== patients.length && ` (${filtered.length} results)`}
          </p>
        </div>
        <Link
          href="/dashboard/patients/new"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm transition-all inline-flex items-center gap-2"
        >
          + New Patient
        </Link>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Create Patient Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Patient</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  First Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => handleFormChange('first_name', e.target.value)}
                  placeholder="First name"
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Last Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => handleFormChange('last_name', e.target.value)}
                  placeholder="Last name"
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => handleFormChange('date_of_birth', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Gender
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => handleFormChange('gender', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Blood Type */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Blood Type
                </label>
                <select
                  value={form.blood_type}
                  onChange={(e) => handleFormChange('blood_type', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  {BLOOD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  placeholder="Email address"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all"
              >
                {submitting ? 'Saving...' : 'Save Patient'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setError(null) }}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or email..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total Patients</p>
          <p className="text-2xl font-bold text-white mt-1">{patients.length}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Male</p>
          <p className="text-2xl font-bold text-white mt-1">
            {patients.filter((p) => p.gender === 'male').length}
          </p>
        </div>
        <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-4">
          <p className="text-pink-400 text-sm">Female</p>
          <p className="text-2xl font-bold text-white mt-1">
            {patients.filter((p) => p.gender === 'female').length}
          </p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Other / Unknown</p>
          <p className="text-2xl font-bold text-white mt-1">
            {patients.filter((p) => p.gender !== 'male' && p.gender !== 'female').length}
          </p>
        </div>
      </div>

      {/* Patients Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">First Name</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Last Name</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Gender</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Blood Type</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Phone</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Email</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((patient) => (
                <tr key={patient.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{patient.first_name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white">{patient.last_name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      patient.gender === 'male'
                        ? 'bg-blue-500/20 text-blue-400'
                        : patient.gender === 'female'
                        ? 'bg-pink-500/20 text-pink-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {patient.gender ? (GENDER_LABELS[patient.gender] || patient.gender) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium text-sm">
                      {patient.blood_type || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{patient.phone || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{patient.email || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(patient.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : patients.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No patients match your search</p>
          <button
            onClick={() => setSearch('')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No patients yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Add your first patient by clicking the &quot;+ New Patient&quot; button above.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all inline-block"
          >
            + New Patient
          </button>
        </div>
      )}
    </div>
  )
}
