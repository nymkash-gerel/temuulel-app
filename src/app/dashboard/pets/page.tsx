'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Pet {
  id: string
  name: string
  species: string | null
  breed: string | null
  weight: number | null
  date_of_birth: string | null
  medical_notes: string | null
  is_active: boolean
  customer_id: string | null
  created_at: string
  customer?: {
    id: string
    name: string
  } | null
}

interface PetForm {
  name: string
  species: string
  breed: string
  weight: string
  date_of_birth: string
  medical_notes: string
  customer_id: string
}

interface Customer {
  id: string
  name: string | null
}

const SPECIES_OPTIONS = [
  { value: '', label: 'Сонгох...' },
  { value: 'dog', label: 'Нохой' },
  { value: 'cat', label: 'Муур' },
  { value: 'bird', label: 'Шувуу' },
  { value: 'rabbit', label: 'Туулай' },
  { value: 'hamster', label: 'Хамстер' },
  { value: 'fish', label: 'Загас' },
  { value: 'other', label: 'Бусад' },
]

const SPECIES_LABELS: Record<string, string> = {
  dog: 'Нохой',
  cat: 'Муур',
  bird: 'Шувуу',
  rabbit: 'Туулай',
  hamster: 'Хамстер',
  fish: 'Загас',
  other: 'Бусад',
}

const SPECIES_COLORS: Record<string, string> = {
  dog: 'bg-amber-500/20 text-amber-400',
  cat: 'bg-purple-500/20 text-purple-400',
  bird: 'bg-sky-500/20 text-sky-400',
  rabbit: 'bg-pink-500/20 text-pink-400',
  hamster: 'bg-orange-500/20 text-orange-400',
  fish: 'bg-cyan-500/20 text-cyan-400',
  other: 'bg-slate-500/20 text-slate-400',
}

const INITIAL_FORM: PetForm = {
  name: '',
  species: '',
  breed: '',
  weight: '',
  date_of_birth: '',
  medical_notes: '',
  customer_id: '',
}

export default function PetsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [pets, setPets] = useState<Pet[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PetForm>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPets = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/pets')
      if (!res.ok) {
        throw new Error('Failed to fetch pets')
      }
      const json = await res.json()
      setPets(Array.isArray(json) ? json : json.data || [])
    } catch {
      setError('Could not load pets')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('id, name')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setCustomers(data || [])
    } catch {
      // Customers dropdown is optional, silently fail
    }
  }, [supabase])

  useEffect(() => {
    fetchPets()
    fetchCustomers()
  }, [fetchPets, fetchCustomers])

  const filtered = useMemo(() => {
    let result = pets

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.breed?.toLowerCase().includes(q) ||
        p.customer?.name?.toLowerCase().includes(q)
      )
    }

    if (speciesFilter) {
      result = result.filter((p) => p.species === speciesFilter)
    }

    if (activeFilter === 'active') {
      result = result.filter((p) => p.is_active)
    } else if (activeFilter === 'inactive') {
      result = result.filter((p) => !p.is_active)
    }

    return result
  }, [pets, search, speciesFilter, activeFilter])

  const stats = useMemo(() => ({
    total: pets.length,
    active: pets.filter((p) => p.is_active).length,
    dogs: pets.filter((p) => p.species === 'dog').length,
    cats: pets.filter((p) => p.species === 'cat').length,
  }), [pets])

  function handleFormChange(field: keyof PetForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!form.name.trim()) {
      setError('Амьтны нэр оруулна уу')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          species: form.species || null,
          breed: form.breed.trim() || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          date_of_birth: form.date_of_birth || null,
          medical_notes: form.medical_notes.trim() || null,
          customer_id: form.customer_id || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to create pet')
      }

      setSuccess('Амьтан амжилттай бүртгэгдлээ')
      setForm(INITIAL_FORM)
      setShowForm(false)
      await fetchPets()
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
          <h1 className="text-2xl font-bold text-white">Амьтад</h1>
          <p className="text-slate-400 mt-1">
            Нийт {pets.length} амьтан
            {filtered.length !== pets.length && ` (${filtered.length} үр дүн)`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); setSuccess(null) }}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl text-sm transition-all inline-flex items-center gap-2"
        >
          {showForm ? 'Болих' : '+ Шинэ бүртгэл'}
        </button>
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

      {/* Create Pet Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Шинэ амьтан бүртгэх</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Нэр <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="Амьтны нэр"
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Species */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Зүйл
                </label>
                <select
                  value={form.species}
                  onChange={(e) => handleFormChange('species', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  {SPECIES_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Breed */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Үүлдэр
                </label>
                <input
                  type="text"
                  value={form.breed}
                  onChange={(e) => handleFormChange('breed', e.target.value)}
                  placeholder="Үүлдэр"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Жин (кг)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.weight}
                  onChange={(e) => handleFormChange('weight', e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Төрсөн огноо
                </label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => handleFormChange('date_of_birth', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Эзэмшигч
                </label>
                <select
                  value={form.customer_id}
                  onChange={(e) => handleFormChange('customer_id', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">Сонгох...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Medical Notes */}
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Эмнэлгийн тэмдэглэл
                </label>
                <textarea
                  value={form.medical_notes}
                  onChange={(e) => handleFormChange('medical_notes', e.target.value)}
                  placeholder="Эмнэлгийн тэмдэглэл..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all"
              >
                {submitting ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setError(null) }}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
              >
                Болих
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
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Нэр, үүлдэр, эзэмшигчээр хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх зүйл</option>
              {SPECIES_OPTIONS.filter((o) => o.value).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="all">Бүх төлөв</option>
              <option value="active">Идэвхтэй</option>
              <option value="inactive">Идэвхгүй</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Нийт амьтад</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <p className="text-amber-400 text-sm">Нохой</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.dogs}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Муур</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.cats}</p>
        </div>
      </div>

      {/* Pets Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зүйл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үүлдэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Жин</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Эзэмшигч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Бүртгэсэн</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pet) => (
                <tr key={pet.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{pet.name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      SPECIES_COLORS[pet.species || ''] || 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {pet.species ? (SPECIES_LABELS[pet.species] || pet.species) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{pet.breed || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">
                      {pet.weight != null ? `${pet.weight} кг` : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{pet.customer?.name || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      pet.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {pet.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(pet.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : pets.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтын үр дүн олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setSpeciesFilter(''); setActiveFilter('all') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21s-6-4.35-6-10A6 6 0 0118 11c0 5.65-6 10-6 10zM12 13a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Амьтан бүртгэгдээгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Дээрх &quot;+ Шинэ бүртгэл&quot; товчийг дарж эхний амьтнаа бүртгэнэ үү.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl transition-all inline-block"
          >
            + Шинэ бүртгэл
          </button>
        </div>
      )}
    </div>
  )
}
