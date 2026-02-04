'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Student {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  guardian_name: string | null
  guardian_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function StudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<Student | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formDob, setFormDob] = useState('')
  const [formGuardianName, setFormGuardianName] = useState('')
  const [formGuardianPhone, setFormGuardianPhone] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadStudent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/students/${id}`)
      if (res.ok) {
        const data = await res.json()
        setStudent(data)
        setFormFirstName(data.first_name || '')
        setFormLastName(data.last_name || '')
        setFormEmail(data.email || '')
        setFormPhone(data.phone || '')
        setFormDob(data.date_of_birth?.split('T')[0] || '')
        setFormGuardianName(data.guardian_name || '')
        setFormGuardianPhone(data.guardian_phone || '')
        setFormNotes(data.notes || '')
      }
    } catch { /* */ }
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadStudent()
  }, [loadStudent])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formFirstName,
          last_name: formLastName,
          email: formEmail || null,
          phone: formPhone || null,
          date_of_birth: formDob || null,
          guardian_name: formGuardianName || null,
          guardian_phone: formGuardianPhone || null,
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setStudent(data)
        setEditing(false)
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-64 bg-slate-700 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Суралцагч олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/students')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/students')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{student.last_name} {student.first_name}</h1>
            <p className="text-slate-400 text-sm mt-1">Суралцагчийн дэлгэрэнгүй</p>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all">Засах</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Info */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Хувийн мэдээлэл</h2>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Овог *</label>
                  <input value={formLastName} onChange={e => setFormLastName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Нэр *</label>
                  <input value={formFirstName} onChange={e => setFormFirstName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">И-мэйл</label>
                <input value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Утас</label>
                <input value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төрсөн огноо</label>
                <input type="date" value={formDob} onChange={e => setFormDob(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">Болих</button>
                <button onClick={handleSave} disabled={saving || !formFirstName.trim() || !formLastName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-slate-400">Овог</span>
                <p className="text-white">{student.last_name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Нэр</span>
                <p className="text-white">{student.first_name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">И-мэйл</span>
                <p className="text-white">{student.email || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Утас</span>
                <p className="text-white">{student.phone || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төрсөн огноо</span>
                <p className="text-white">{student.date_of_birth ? formatDate(student.date_of_birth) : '-'}</p>
              </div>
              {student.notes && (
                <div>
                  <span className="text-sm text-slate-400">Тэмдэглэл</span>
                  <p className="text-slate-300 whitespace-pre-wrap">{student.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Guardian Info */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Асран хамгаалагч</h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Нэр</label>
                <input value={formGuardianName} onChange={e => setFormGuardianName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Утас</label>
                <input value={formGuardianPhone} onChange={e => setFormGuardianPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-slate-400">Нэр</span>
                <p className="text-white">{student.guardian_name || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Утас</span>
                <p className="text-white">{student.guardian_phone || '-'}</p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-slate-700 text-sm text-slate-500 space-y-1">
            <p>Үүсгэсэн: {formatDate(student.created_at)}</p>
            <p>Шинэчилсэн: {formatDate(student.updated_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
