'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Encounter {
  id: string
  patient_id: string
  provider_id: string | null
  encounter_type: string
  status: string
  chief_complaint: string | null
  diagnosis: string | null
  treatment_plan: string | null
  notes: string | null
  encounter_date: string | null
  created_at: string
  updated_at: string
  patients: { id: string; first_name: string; last_name: string } | null
  staff: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Товлосон', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const TYPE_LABELS: Record<string, string> = {
  consultation: 'Зөвлөгөө',
  follow_up: 'Давтан үзлэг',
  emergency: 'Яаралтай',
  procedure: 'Процедур',
  lab_visit: 'Лабораторийн үзлэг',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function EncounterDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formStatus, setFormStatus] = useState('')
  const [formDiagnosis, setFormDiagnosis] = useState('')
  const [formTreatmentPlan, setFormTreatmentPlan] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    loadEncounter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadEncounter() {
    setLoading(true)
    try {
      const res = await fetch(`/api/encounters/${id}`)
      if (res.ok) {
        const data = await res.json()
        setEncounter(data)
        setFormStatus(data.status || 'scheduled')
        setFormDiagnosis(data.diagnosis || '')
        setFormTreatmentPlan(data.treatment_plan || '')
        setFormNotes(data.notes || '')
      }
    } catch { /* */ }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/encounters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formStatus,
          diagnosis: formDiagnosis || null,
          treatment_plan: formTreatmentPlan || null,
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setEncounter(data)
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

  if (!encounter) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Үзлэг олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/encounters')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  const sc = STATUS_CONFIG[encounter.status] || STATUS_CONFIG.scheduled
  const patientName = encounter.patients
    ? `${encounter.patients.last_name} ${encounter.patients.first_name}`
    : 'Тодорхойгүй'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/encounters')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">Үзлэг — {patientName}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {TYPE_LABELS[encounter.encounter_type] || encounter.encounter_type}
              {encounter.encounter_date && ` — ${formatDateTime(encounter.encounter_date)}`}
            </p>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all">Засах</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төлөв</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                  <option value="scheduled">Товлосон</option>
                  <option value="in_progress">Явагдаж буй</option>
                  <option value="completed">Дууссан</option>
                  <option value="cancelled">Цуцлагдсан</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Онош</label>
                <textarea value={formDiagnosis} onChange={e => setFormDiagnosis(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" placeholder="Оношийг бичнэ үү..." />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Эмчилгээний төлөвлөгөө</label>
                <textarea value={formTreatmentPlan} onChange={e => setFormTreatmentPlan(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" placeholder="Эмчилгээний төлөвлөгөө..." />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Нэмэлт тэмдэглэл</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">Болих</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <span className="text-sm text-slate-400">Гол зовиур</span>
                <p className="text-white mt-1">{encounter.chief_complaint || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Онош</span>
                <p className="text-white mt-1 whitespace-pre-wrap">{encounter.diagnosis || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Эмчилгээний төлөвлөгөө</span>
                <p className="text-white mt-1 whitespace-pre-wrap">{encounter.treatment_plan || '-'}</p>
              </div>
              {encounter.notes && (
                <div>
                  <span className="text-sm text-slate-400">Нэмэлт тэмдэглэл</span>
                  <p className="text-slate-300 mt-1 whitespace-pre-wrap">{encounter.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Мэдээлэл</h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500">Төлөв</span>
                <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span></p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Өвчтөн</span>
                <p className="text-white text-sm">{patientName}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Эмч</span>
                <p className="text-white text-sm">{encounter.staff?.name || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Төрөл</span>
                <p className="text-white text-sm">{TYPE_LABELS[encounter.encounter_type] || encounter.encounter_type}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Огноо</span>
                <p className="text-white text-sm">{encounter.encounter_date ? formatDateTime(encounter.encounter_date) : '-'}</p>
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-500 space-y-1">
            <p>Үүсгэсэн: {formatDate(encounter.created_at)}</p>
            <p>Шинэчилсэн: {formatDate(encounter.updated_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
