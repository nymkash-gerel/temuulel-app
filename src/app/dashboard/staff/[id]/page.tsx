'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Staff {
  id: string
  name: string
  phone: string | null
  email: string | null
  specialties: string[] | null
  status: string
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  inactive: { label: 'Идэвхгүй', color: 'bg-red-500/20 text-red-400' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function StaffDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formSpecialties, setFormSpecialties] = useState('')
  const [formStatus, setFormStatus] = useState('active')

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${id}`)
      if (res.ok) {
        const data = await res.json()
        const s = data.staff || data
        setStaff(s)
        setFormName(s.name || '')
        setFormPhone(s.phone || '')
        setFormEmail(s.email || '')
        setFormSpecialties((s.specialties || []).join(', '))
        setFormStatus(s.status || 'active')
      }
    } catch { /* */ }
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          phone: formPhone || null,
          email: formEmail || null,
          specialties: formSpecialties ? formSpecialties.split(',').map(s => s.trim()).filter(Boolean) : [],
          status: formStatus,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setStaff(data.staff || data)
        setEditing(false)
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Ажилтныг устгах уу?')) return
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/dashboard/staff')
    else alert('Устгах үед алдаа гарлаа')
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

  if (!staff) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Ажилтан олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/staff')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  const sc = STATUS_CONFIG[staff.status] || STATUS_CONFIG.active

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/staff')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{staff.name}</h1>
            <p className="text-slate-400 text-sm mt-1">Ажилтны дэлгэрэнгүй</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all">Засах</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl text-sm transition-all">Устгах</button>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        {editing ? (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Нэр *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Утас</label>
              <input value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">И-мэйл</label>
              <input value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Мэргэшил (таслалаар тусгаарлана)</label>
              <input value={formSpecialties} onChange={e => setFormSpecialties(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Төлөв</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                <option value="active">Идэвхтэй</option>
                <option value="inactive">Идэвхгүй</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">Болих</button>
              <button onClick={handleSave} disabled={saving || !formName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-400">Нэр</span>
                <p className="text-white">{staff.name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төлөв</span>
                <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span></p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Утас</span>
                <p className="text-white">{staff.phone || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">И-мэйл</span>
                <p className="text-white">{staff.email || '-'}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-slate-400">Мэргэшил</span>
              {staff.specialties && staff.specialties.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {staff.specialties.map((s, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">{s}</span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">-</p>
              )}
            </div>
            <div className="pt-4 border-t border-slate-700 text-sm text-slate-500 flex gap-6">
              <span>Үүсгэсэн: {formatDate(staff.created_at)}</span>
              <span>Шинэчилсэн: {formatDate(staff.updated_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
