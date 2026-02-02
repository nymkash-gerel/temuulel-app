'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Equipment {
  id: string
  name: string
  equipment_type: string | null
  serial_number: string | null
  status: string
  location: string | null
  purchase_date: string | null
  last_maintenance: string | null
  next_maintenance: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  operational: { label: 'Хэвийн', color: 'bg-green-500/20 text-green-400' },
  maintenance: { label: 'Засварт', color: 'bg-yellow-500/20 text-yellow-400' },
  broken: { label: 'Эвдэрсэн', color: 'bg-red-500/20 text-red-400' },
  retired: { label: 'Ашиглахгүй', color: 'bg-slate-500/20 text-slate-400' },
}

const TYPE_LABELS: Record<string, string> = {
  cardio: 'Кардио',
  strength: 'Хүчний',
  flexibility: 'Уян хатан',
  other: 'Бусад',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function EquipmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('')
  const [formSerial, setFormSerial] = useState('')
  const [formStatus, setFormStatus] = useState('operational')
  const [formLocation, setFormLocation] = useState('')
  const [formPurchaseDate, setFormPurchaseDate] = useState('')
  const [formLastMaint, setFormLastMaint] = useState('')
  const [formNextMaint, setFormNextMaint] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    loadEquipment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadEquipment() {
    setLoading(true)
    try {
      const res = await fetch(`/api/equipment/${id}`)
      if (res.ok) {
        const data = await res.json()
        setEquipment(data)
        setFormName(data.name || '')
        setFormType(data.equipment_type || '')
        setFormSerial(data.serial_number || '')
        setFormStatus(data.status || 'operational')
        setFormLocation(data.location || '')
        setFormPurchaseDate(data.purchase_date?.split('T')[0] || '')
        setFormLastMaint(data.last_maintenance?.split('T')[0] || '')
        setFormNextMaint(data.next_maintenance?.split('T')[0] || '')
        setFormNotes(data.notes || '')
      }
    } catch { /* */ }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/equipment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          equipment_type: formType || null,
          serial_number: formSerial || null,
          status: formStatus,
          location: formLocation || null,
          purchase_date: formPurchaseDate || null,
          last_maintenance: formLastMaint || null,
          next_maintenance: formNextMaint || null,
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setEquipment(data)
        setEditing(false)
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Тоног төхөөрөмжийг устгах уу?')) return
    const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/dashboard/equipment')
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

  if (!equipment) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Тоног төхөөрөмж олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/equipment')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  const sc = STATUS_CONFIG[equipment.status] || STATUS_CONFIG.operational

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/equipment')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{equipment.name}</h1>
            <p className="text-slate-400 text-sm mt-1">Тоног төхөөрөмжийн дэлгэрэнгүй</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төрөл</label>
                <select value={formType} onChange={e => setFormType(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                  <option value="">Сонгоогүй</option>
                  <option value="cardio">Кардио</option>
                  <option value="strength">Хүчний</option>
                  <option value="flexibility">Уян хатан</option>
                  <option value="other">Бусад</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төлөв</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                  <option value="operational">Хэвийн</option>
                  <option value="maintenance">Засварт</option>
                  <option value="broken">Эвдэрсэн</option>
                  <option value="retired">Ашиглахгүй</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Сериал дугаар</label>
                <input value={formSerial} onChange={e => setFormSerial(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Байршил</label>
                <input value={formLocation} onChange={e => setFormLocation(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Худалдан авсан</label>
                <input type="date" value={formPurchaseDate} onChange={e => setFormPurchaseDate(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Сүүлийн засвар</label>
                <input type="date" value={formLastMaint} onChange={e => setFormLastMaint(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Дараагийн засвар</label>
                <input type="date" value={formNextMaint} onChange={e => setFormNextMaint(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">Болих</button>
              <button onClick={handleSave} disabled={saving || !formName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-slate-400">Нэр</span>
                <p className="text-white font-medium">{equipment.name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төрөл</span>
                <p className="text-white">{equipment.equipment_type ? (TYPE_LABELS[equipment.equipment_type] || equipment.equipment_type) : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төлөв</span>
                <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span></p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-400">Сериал дугаар</span>
                <p className="text-white">{equipment.serial_number || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Байршил</span>
                <p className="text-white">{equipment.location || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-slate-400">Худалдан авсан огноо</span>
                <p className="text-white">{equipment.purchase_date ? formatDate(equipment.purchase_date) : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Сүүлийн засвар</span>
                <p className="text-white">{equipment.last_maintenance ? formatDate(equipment.last_maintenance) : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Дараагийн засвар</span>
                <p className="text-white">{equipment.next_maintenance ? formatDate(equipment.next_maintenance) : '-'}</p>
              </div>
            </div>
            {equipment.notes && (
              <div>
                <span className="text-sm text-slate-400">Тэмдэглэл</span>
                <p className="text-slate-300 whitespace-pre-wrap">{equipment.notes}</p>
              </div>
            )}
            <div className="pt-4 border-t border-slate-700 text-sm text-slate-500 flex gap-6">
              <span>Үүсгэсэн: {formatDate(equipment.created_at)}</span>
              <span>Шинэчилсэн: {formatDate(equipment.updated_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
