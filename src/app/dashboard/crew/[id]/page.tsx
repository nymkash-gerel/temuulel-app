'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface CrewMember {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  specialty: string | null
  certifications: string[] | null
  hourly_rate: number | null
  daily_rate: number | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  inactive: { label: 'Идэвхгүй', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function CrewMemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const memberId = params.id as string

  const [member, setMember] = useState<CrewMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }

      const res = await fetch(`/api/crew-members/${memberId}`)
      if (!res.ok) {
        router.push('/dashboard/crew')
        return
      }

      const data = await res.json()
      setMember(data)
      setNotes(data.notes || '')
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  async function handleStatusToggle() {
    if (!member) return
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    setSaving(true)
    try {
      const res = await fetch(`/api/crew-members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMember(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes() {
    if (!member) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crew-members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMember(updated)
        setEditing(false)
      }
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

  if (!member) return null

  const sc = STATUS_CONFIG[member.status] || { label: member.status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/crew" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{member.name}</h1>
              {member.role && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  {member.role}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              Багийн гишүүний мэдээлэл
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStatusToggle}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
              member.status === 'active'
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
            }`}
          >
            {saving ? '...' : member.status === 'active' ? 'Идэвхгүй болгох' : 'Идэвхтэй болгох'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хувийн мэдээлэл</h3>
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-2xl">
                  {member.name.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Нэр</p>
                  <p className="text-white text-sm font-medium">{member.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Үүрэг</p>
                  <p className="text-white text-sm">{member.role || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Утасны дугаар</p>
                  <p className="text-white text-sm">{member.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Имэйл</p>
                  <p className="text-white text-sm">{member.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Мэргэжил</p>
                  <p className="text-white text-sm">{member.specialty || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Төлөв</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                    {sc.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rates */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Цалин / Хөлс</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-700/30 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Цагийн цалин</p>
                <p className="text-white text-lg font-medium">
                  {member.hourly_rate != null ? formatPrice(member.hourly_rate) : '-'}
                </p>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Өдрийн цалин</p>
                <p className="text-white text-lg font-medium">
                  {member.daily_rate != null ? formatPrice(member.daily_rate) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Certifications */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Гэрчилгээ / Мэргэшил</h3>
            {member.certifications && member.certifications.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {member.certifications.map((cert, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-sm rounded-lg border border-blue-500/20"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Гэрчилгээ бүртгэгдээгүй</p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Тэмдэглэл</h3>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-all"
                >
                  Засах
                </button>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  placeholder="Тэмдэглэл оруулах..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setEditing(false); setNotes(member.notes || '') }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {member.notes || 'Тэмдэглэл байхгүй'}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хураангуй</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Төлөв</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              {member.role && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Үүрэг</span>
                  <span className="text-white">{member.role}</span>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Утас</span>
                  <span className="text-white">{member.phone}</span>
                </div>
              )}
              {member.hourly_rate != null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Цагийн цалин</span>
                  <span className="text-white font-medium">{formatPrice(member.hourly_rate)}</span>
                </div>
              )}
              {member.certifications && member.certifications.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Гэрчилгээ</span>
                  <span className="text-white">{member.certifications.length} ширхэг</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Холбоо барих</h3>
            <div className="space-y-3 text-sm">
              {member.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <span className="text-slate-300">{member.phone}</span>
                </div>
              )}
              {member.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <span className="text-slate-300">{member.email}</span>
                </div>
              )}
              {!member.phone && !member.email && (
                <p className="text-slate-500 text-sm">Холбоо барих мэдээлэл байхгүй</p>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Огноо</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Бүртгэсэн</span>
                <span className="text-slate-300">
                  {new Date(member.created_at).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шинэчилсэн</span>
                <span className="text-slate-300">
                  {new Date(member.updated_at).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
