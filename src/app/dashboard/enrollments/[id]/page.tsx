'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Enrollment {
  id: string
  student_id: string
  program_id: string
  status: string
  enrolled_at: string
  completed_at: string | null
  grade: string | null
  notes: string | null
  created_at: string
  updated_at: string
  students: { id: string; first_name: string; last_name: string } | null
  programs: { id: string; name: string | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Дууссан', color: 'bg-blue-500/20 text-blue-400' },
  dropped: { label: 'Хасагдсан', color: 'bg-red-500/20 text-red-400' },
  suspended: { label: 'Түр зогсоосон', color: 'bg-yellow-500/20 text-yellow-400' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function EnrollmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formStatus, setFormStatus] = useState('')
  const [formGrade, setFormGrade] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadEnrollment = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/enrollments/${id}`)
      if (res.ok) {
        const data = await res.json()
        setEnrollment(data)
        setFormStatus(data.status || 'active')
        setFormGrade(data.grade || '')
        setFormNotes(data.notes || '')
      }
    } catch { /* */ }
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadEnrollment()
  }, [loadEnrollment])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/enrollments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formStatus,
          grade: formGrade || null,
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setEnrollment(data)
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

  if (!enrollment) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Бүртгэл олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/enrollments')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  const sc = STATUS_CONFIG[enrollment.status] || STATUS_CONFIG.active
  const studentName = enrollment.students
    ? `${enrollment.students.last_name} ${enrollment.students.first_name}`
    : 'Тодорхойгүй'
  const programName = enrollment.programs?.name || 'Тодорхойгүй'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/enrollments')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{studentName}</h1>
            <p className="text-slate-400 text-sm mt-1">{programName} — Элсэлтийн дэлгэрэнгүй</p>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all">Засах</button>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        {editing ? (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Төлөв</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                <option value="active">Идэвхтэй</option>
                <option value="completed">Дууссан</option>
                <option value="dropped">Хасагдсан</option>
                <option value="suspended">Түр зогсоосон</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Үнэлгээ</label>
              <input value={formGrade} onChange={e => setFormGrade(e.target.value)} placeholder="A, B, C..." className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">Болих</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-slate-400">Суралцагч</span>
                <p className="text-white font-medium">{studentName}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Хөтөлбөр</span>
                <p className="text-white">{programName}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төлөв</span>
                <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span></p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-slate-400">Элссэн огноо</span>
                <p className="text-white">{formatDate(enrollment.enrolled_at)}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Дууссан огноо</span>
                <p className="text-white">{enrollment.completed_at ? formatDate(enrollment.completed_at) : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Үнэлгээ</span>
                <p className="text-white text-lg font-semibold">{enrollment.grade || '-'}</p>
              </div>
            </div>
            {enrollment.notes && (
              <div>
                <span className="text-sm text-slate-400">Тэмдэглэл</span>
                <p className="text-slate-300 whitespace-pre-wrap">{enrollment.notes}</p>
              </div>
            )}
            <div className="pt-4 border-t border-slate-700 text-sm text-slate-500 flex gap-6">
              <span>Үүсгэсэн: {formatDate(enrollment.created_at)}</span>
              <span>Шинэчилсэн: {formatDate(enrollment.updated_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
