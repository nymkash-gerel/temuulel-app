'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Guest {
  id: string
  first_name: string
  last_name: string
  document_type: string | null
  document_number: string | null
  nationality: string | null
  phone: string | null
  email: string | null
  vip_level: string | null
  notes: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
}

const VIP_LABELS: Record<string, string> = {
  none: 'Энгийн',
  silver: 'Мөнгө',
  gold: 'Алт',
  platinum: 'Платинум',
}

const DOC_LABELS: Record<string, string> = {
  passport: 'Гадаад паспорт',
  national_id: 'Иргэний үнэмлэх',
  drivers_license: 'Жолоочийн үнэмлэх',
  other: 'Бусад',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function GuestDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formDocType, setFormDocType] = useState('')
  const [formDocNumber, setFormDocNumber] = useState('')
  const [formNationality, setFormNationality] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formVipLevel, setFormVipLevel] = useState('none')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    loadGuest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadGuest() {
    setLoading(true)
    try {
      const res = await fetch(`/api/guests/${id}`)
      if (res.ok) {
        const data = await res.json()
        setGuest(data)
        setFormFirstName(data.first_name || '')
        setFormLastName(data.last_name || '')
        setFormDocType(data.document_type || '')
        setFormDocNumber(data.document_number || '')
        setFormNationality(data.nationality || '')
        setFormPhone(data.phone || '')
        setFormEmail(data.email || '')
        setFormVipLevel(data.vip_level || 'none')
        setFormNotes(data.notes || '')
      }
    } catch { /* */ }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/guests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formFirstName,
          last_name: formLastName,
          document_type: formDocType || null,
          document_number: formDocNumber || null,
          nationality: formNationality || null,
          phone: formPhone || null,
          email: formEmail || null,
          vip_level: formVipLevel || 'none',
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setGuest(data)
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

  if (!guest) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Зочин олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/guests')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  const vipColor = guest.vip_level === 'platinum' ? 'bg-purple-500/20 text-purple-400' :
    guest.vip_level === 'gold' ? 'bg-yellow-500/20 text-yellow-400' :
    guest.vip_level === 'silver' ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-600/20 text-slate-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/guests')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{guest.last_name} {guest.first_name}</h1>
            <p className="text-slate-400 text-sm mt-1">Зочны дэлгэрэнгүй</p>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all">Засах</button>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        {editing ? (
          <div className="space-y-4 max-w-lg">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Баримт бичгийн төрөл</label>
                <select value={formDocType} onChange={e => setFormDocType(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                  <option value="">Сонгоогүй</option>
                  <option value="passport">Гадаад паспорт</option>
                  <option value="national_id">Иргэний үнэмлэх</option>
                  <option value="drivers_license">Жолоочийн үнэмлэх</option>
                  <option value="other">Бусад</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Баримт бичгийн дугаар</label>
                <input value={formDocNumber} onChange={e => setFormDocNumber(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Иргэншил</label>
              <input value={formNationality} onChange={e => setFormNationality(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Утас</label>
                <input value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">И-мэйл</label>
                <input value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">VIP түвшин</label>
              <select value={formVipLevel} onChange={e => setFormVipLevel(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                <option value="none">Энгийн</option>
                <option value="silver">Мөнгө</option>
                <option value="gold">Алт</option>
                <option value="platinum">Платинум</option>
              </select>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-400">Овог, Нэр</span>
                <p className="text-white">{guest.last_name} {guest.first_name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">VIP түвшин</span>
                <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${vipColor}`}>{VIP_LABELS[guest.vip_level || 'none'] || 'Энгийн'}</span></p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Баримт бичгийн төрөл</span>
                <p className="text-white">{guest.document_type ? (DOC_LABELS[guest.document_type] || guest.document_type) : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Баримт бичгийн дугаар</span>
                <p className="text-white">{guest.document_number || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Иргэншил</span>
                <p className="text-white">{guest.nationality || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Утас</span>
                <p className="text-white">{guest.phone || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">И-мэйл</span>
                <p className="text-white">{guest.email || '-'}</p>
              </div>
            </div>
            {guest.notes && (
              <div>
                <span className="text-sm text-slate-400">Тэмдэглэл</span>
                <p className="text-slate-300 whitespace-pre-wrap">{guest.notes}</p>
              </div>
            )}
            <div className="pt-4 border-t border-slate-700 text-sm text-slate-500 flex gap-6">
              <span>Үүсгэсэн: {formatDate(guest.created_at)}</span>
              <span>Шинэчилсэн: {formatDate(guest.updated_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
