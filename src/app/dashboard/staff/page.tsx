'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveStoreId } from '@/lib/resolve-store'

interface StaffMember {
  id: string
  name: string
  phone: string | null
  email: string | null
  avatar_url: string | null
  specialties: string[] | null
  status: 'active' | 'inactive'
  created_at: string
}

export default function StaffPage() {
  const supabase = createClient()
  const router = useRouter()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

  const specialtyOptions = [
    'Үс засалт',
    'Үс будалт',
    'Маникюр',
    'Педикюр',
    'Нүүр будалт',
    'Арьс арчилгаа',
    'Массаж',
    'Спа'
  ]

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const storeId = await resolveStoreId(supabase, user.id)
    const store = storeId ? { id: storeId } : null

    if (!store) return
    setStoreId(store.id)

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setStaff(data as StaffMember[])
    }
    setLoading(false)
  }

  const openModal = (staffMember?: StaffMember) => {
    if (staffMember) {
      setEditingStaff(staffMember)
      setName(staffMember.name)
      setPhone(staffMember.phone || '')
      setEmail(staffMember.email || '')
      setSpecialties(staffMember.specialties || [])
      setStatus(staffMember.status)
    } else {
      setEditingStaff(null)
      setName('')
      setPhone('')
      setEmail('')
      setSpecialties([])
      setStatus('active')
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!storeId || !name.trim()) return

    setSaving(true)
    try {
      if (editingStaff) {
        // Update existing
        const { error } = await supabase
          .from('staff')
          .update({
            name,
            phone: phone || null,
            email: email || null,
            specialties: specialties.length > 0 ? specialties : null,
            status
          })
          .eq('id', editingStaff.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('staff')
          .insert({
            store_id: storeId,
            name,
            phone: phone || null,
            email: email || null,
            specialties: specialties.length > 0 ? specialties : null,
            status
          })

        if (error) throw error
      }

      setShowModal(false)
      loadStaff()
    } catch (err) {
      console.error('Error saving staff:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Энэ ажилтныг устгах уу?')) return

    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadStaff()
    } catch (err) {
      console.error('Error deleting staff:', err)
    }
  }

  const toggleSpecialty = (specialty: string) => {
    if (specialties.includes(specialty)) {
      setSpecialties(specialties.filter(s => s !== specialty))
    } else {
      setSpecialties([...specialties, specialty])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Ажилтнууд</h1>
          <p className="text-slate-400 mt-1">Нийт {staff.length} ажилтан</p>
        </div>
        <Link
          href="/dashboard/staff/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Ажилтан нэмэх
        </Link>
      </div>

      {/* Staff List */}
      {staff.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">👩‍💼</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Ажилтан байхгүй</h3>
          <p className="text-slate-400 mb-6">Эхний ажилтнаа нэмж эхлээрэй.</p>
          <Link
            href="/dashboard/staff/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Ажилтан нэмэх
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => (
            <div
              key={member.id}
              onClick={() => router.push(`/dashboard/staff/${member.id}`)}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 cursor-pointer hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-full flex items-center justify-center">
                    {member.avatar_url ? (
                      <Image src={member.avatar_url} alt={member.name} width={48} height={48} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-xl">👤</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{member.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      member.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {member.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(member)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                {member.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-400">📱</span>
                    {member.phone}
                  </div>
                )}
                {member.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-400">📧</span>
                    {member.email}
                  </div>
                )}
              </div>

              {/* Specialties */}
              {member.specialties && member.specialties.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {member.specialties.map((specialty, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-pink-500/10 text-pink-400 text-xs rounded-full"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingStaff ? 'Ажилтан засах' : 'Шинэ ажилтан'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Нэр *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Ажилтны нэр"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Утасны дугаар
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="99112233"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  И-мэйл
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Мэргэшил
                </label>
                <div className="flex flex-wrap gap-2">
                  {specialtyOptions.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleSpecialty(option)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        specialties.includes(option)
                          ? 'bg-pink-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Төлөв
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="active">Идэвхтэй</option>
                  <option value="inactive">Идэвхгүй</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
