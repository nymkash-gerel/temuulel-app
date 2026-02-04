'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface StaffMember {
  id: string
  name: string
}

interface FitnessClass {
  id: string
  name: string
  description: string | null
  class_type: string
  capacity: number | null
  duration_minutes: number | null
  instructor_id: string | null
  is_active: boolean
  created_at: string
  staff: { id: string; name: string } | null
}

interface NewClassForm {
  name: string
  description: string
  class_type: string
  capacity: string
  duration_minutes: string
  instructor_id: string
  is_active: boolean
}

const CLASS_TYPE_LABELS: Record<string, string> = {
  group: 'Бүлэг',
  personal: 'Хувийн',
  online: 'Онлайн',
  workshop: 'Семинар',
}

export default function FitnessClassesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<FitnessClass[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Filters
  const [classTypeFilter, setClassTypeFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState<NewClassForm>({
    name: '',
    description: '',
    class_type: 'group',
    capacity: '',
    duration_minutes: '',
    instructor_id: '',
    is_active: true,
  })

  const loadClasses = useCallback(async (sid: string) => {
    let query = supabase
      .from('fitness_classes')
      .select(`
        id, name, description, class_type, capacity,
        duration_minutes, instructor_id, is_active, created_at,
        staff!fitness_classes_instructor_id_fkey(id, name)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })

    if (classTypeFilter) {
      query = query.eq('class_type', classTypeFilter)
    }
    if (activeFilter === 'active') {
      query = query.eq('is_active', true)
    } else if (activeFilter === 'inactive') {
      query = query.eq('is_active', false)
    }

    const { data } = await query
    if (data) {
      setClasses(data as unknown as FitnessClass[])
    }
  }, [supabase, classTypeFilter, activeFilter])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)

        const { data: staffData } = await supabase
          .from('staff')
          .select('id, name')
          .eq('store_id', store.id)
          .order('name')

        if (staffData) setStaffList(staffData)

        await loadClasses(store.id)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router, loadClasses])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadClasses(storeId) }
    reload()
  }, [classTypeFilter, activeFilter, storeId, loading, loadClasses])

  const filtered = useMemo(() => {
    if (!search.trim()) return classes
    const q = search.trim().toLowerCase()
    return classes.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.staff?.name?.toLowerCase().includes(q)
    )
  }, [classes, search])

  const stats = useMemo(() => {
    const total = classes.length
    const active = classes.filter(c => c.is_active).length
    const group = classes.filter(c => c.class_type === 'group').length
    const personal = classes.filter(c => c.class_type === 'personal').length
    return { total, active, group, personal }
  }, [classes])

  function startEdit(cls: FitnessClass) {
    setEditingId(cls.id)
    setForm({
      name: cls.name,
      description: cls.description || '',
      class_type: cls.class_type,
      capacity: cls.capacity != null ? String(cls.capacity) : '',
      duration_minutes: cls.duration_minutes != null ? String(cls.duration_minutes) : '',
      instructor_id: cls.instructor_id || '',
      is_active: cls.is_active,
    })
    setShowForm(true)
    setError('')
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      name: '',
      description: '',
      class_type: 'group',
      capacity: '',
      duration_minutes: '',
      instructor_id: '',
      is_active: true,
    })
    setShowForm(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        class_type: form.class_type,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined,
        instructor_id: form.instructor_id || null,
        is_active: form.is_active,
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('fitness_classes')
          .update(payload)
          .eq('id', editingId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('fitness_classes')
          .insert({ ...payload, store_id: storeId })

        if (insertError) throw insertError
      }

      await loadClasses(storeId)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Хадгалахад алдаа гарлаа')
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
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Фитнесс хичээлүүд</h1>
          <p className="text-gray-400 mt-1">
            Нийт {classes.length} хичээл
            {filtered.length !== classes.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/fitness-classes/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Шинэ хичээл
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Нийт хичээл</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Бүлэг хичээл</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.group}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Хувийн хичээл</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.personal}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Хичээлийн нэр, багш хайх..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={classTypeFilter}
              onChange={(e) => setClassTypeFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="group">Бүлэг</option>
              <option value="personal">Хувийн</option>
              <option value="online">Онлайн</option>
              <option value="workshop">Семинар</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="active">Идэвхтэй</option>
              <option value="inactive">Идэвхгүй</option>
            </select>
          </div>
        </div>
        {(classTypeFilter || activeFilter || search) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setClassTypeFilter(''); setActiveFilter(''); setSearch('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Хичээл засах' : 'Шинэ хичээл нэмэх'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Хичээлийн нэр *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Жишээ: Йога анхан шат"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Тайлбар</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Хичээлийн тайлбар"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Хичээлийн төрөл *</label>
                  <select
                    value={form.class_type}
                    onChange={(e) => setForm({ ...form, class_type: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="group">Бүлэг</option>
                    <option value="personal">Хувийн</option>
                    <option value="online">Онлайн</option>
                    <option value="workshop">Семинар</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Багтаамж</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Хугацаа (минут)</label>
                  <input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    placeholder="60"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Багш</label>
                  <select
                    value={form.instructor_id}
                    onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="">-- Сонгох --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500"
                  />
                  <span className="text-white">Идэвхтэй</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
                >
                  {saving ? 'Хадгалж байна...' : editingId ? 'Шинэчлэх' : 'Нэмэх'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Багш</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Багтаамж</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Хугацаа</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cls) => (
                <tr key={cls.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <div>
                      <p className="text-white font-medium">{cls.name}</p>
                      {cls.description && (
                        <p className="text-gray-400 text-sm mt-0.5 truncate max-w-[250px]">{cls.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      cls.class_type === 'group' ? 'bg-blue-500/20 text-blue-400' :
                      cls.class_type === 'personal' ? 'bg-purple-500/20 text-purple-400' :
                      cls.class_type === 'online' ? 'bg-cyan-500/20 text-cyan-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {CLASS_TYPE_LABELS[cls.class_type] || cls.class_type}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-gray-300">{cls.staff?.name || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className="text-white">{cls.capacity ?? '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className="text-gray-300">
                      {cls.duration_minutes ? `${cls.duration_minutes} мин` : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      cls.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {cls.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-gray-400 text-sm">
                      {new Date(cls.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <button
                      onClick={() => startEdit(cls)}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                    >
                      Засах
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : classes.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-400">Хайлтад тохирох хичээл олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setClassTypeFilter(''); setActiveFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#127947;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Хичээл бүртгэгдээгүй байна</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Фитнесс хичээлүүдээ бүртгэж эхэлнэ үү
          </p>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Эхний хичээл нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
