'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface EmergencyContact {
  name?: string
  phone?: string
  relationship?: string
}

interface InsuranceInfo {
  provider?: string
  policy_number?: string
  group_number?: string
  valid_until?: string
}

interface MedicalHistory {
  conditions?: string[]
  surgeries?: string[]
  medications?: string[]
  notes?: string
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string | null
  blood_type: string | null
  phone: string | null
  email: string | null
  emergency_contact: EmergencyContact | null
  allergies: string[]
  medical_history: MedicalHistory | null
  insurance_info: InsuranceInfo | null
  created_at: string
  updated_at: string
}

interface Encounter {
  id: string
  patient_id: string
  encounter_type: string
  chief_complaint: string | null
  diagnosis: string | null
  treatment_plan: string | null
  status: string
  encounter_date: string
  created_at: string
}

interface Prescription {
  id: string
  patient_id: string
  status: string
  notes: string | null
  created_at: string
}

interface MedicalNote {
  id: string
  patient_id: string
  note_type: string
  content: string
  created_at: string
}

const ENCOUNTER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Товлосон', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const PRESCRIPTION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Эрэгтэй',
  female: 'Эмэгтэй',
  other: 'Бусад',
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  progress: 'Явц',
  consultation: 'Зөвлөгөө',
  procedure: 'Процедур',
  discharge: 'Гаргах',
  general: 'Ерөнхий',
}

type TabKey = 'encounters' | 'prescriptions' | 'notes'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PatientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [medicalNotes, setMedicalNotes] = useState<MedicalNote[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('encounters')

  useEffect(() => {
    loadPatient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPatient() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { setLoading(false); return }

    const { data } = await supabase
      .from('patients')
      .select(`
        id, first_name, last_name, date_of_birth, gender, blood_type, phone, email,
        emergency_contact, allergies, medical_history, insurance_info,
        created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (data) {
      const p: Patient = {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth || undefined as unknown as string | null,
        gender: data.gender || undefined as unknown as string | null,
        blood_type: data.blood_type || undefined as unknown as string | null,
        phone: data.phone || undefined as unknown as string | null,
        email: data.email || undefined as unknown as string | null,
        emergency_contact: data.emergency_contact as unknown as EmergencyContact | null,
        allergies: data.allergies ?? [],
        medical_history: data.medical_history as unknown as MedicalHistory | null,
        insurance_info: data.insurance_info as unknown as InsuranceInfo | null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
      setPatient(p)
      await loadChildRecords(store.id)
    }

    setLoading(false)
  }

  async function loadChildRecords(storeId: string) {
    const [encountersRes, prescriptionsRes, notesRes] = await Promise.all([
      supabase
        .from('encounters')
        .select('id, patient_id, encounter_type, chief_complaint, diagnosis, treatment_plan, status, encounter_date, created_at')
        .eq('patient_id', id)
        .eq('store_id', storeId)
        .order('encounter_date', { ascending: false }),
      supabase
        .from('prescriptions')
        .select('id, patient_id, status, notes, created_at')
        .eq('patient_id', id)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('medical_notes')
        .select('id, patient_id, note_type, content, created_at')
        .eq('patient_id', id)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false }),
    ])

    setEncounters((encountersRes.data as unknown as Encounter[]) ?? [])
    setPrescriptions((prescriptionsRes.data as unknown as Prescription[]) ?? [])
    setMedicalNotes((notesRes.data as unknown as MedicalNote[]) ?? [])
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-700 rounded-xl"></div>
            <div className="h-64 bg-slate-700 rounded-xl"></div>
          </div>
          <div className="h-64 bg-slate-700 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Өвчтөн олдсонгүй.</p>
        <button
          onClick={() => router.push('/dashboard/patients')}
          className="mt-4 text-blue-400 hover:underline"
        >
          Буцах
        </button>
      </div>
    )
  }

  const emergencyContact = patient.emergency_contact
  const insuranceInfo = patient.insurance_info
  const medicalHistory = patient.medical_history

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'encounters', label: 'Үзлэгүүд', count: encounters.length },
    { key: 'prescriptions', label: 'Жор', count: prescriptions.length },
    { key: 'notes', label: 'Тэмдэглэл', count: medicalNotes.length },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/patients')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          &larr; Буцах
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {patient.last_name} {patient.first_name}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Өвчтөний дэлгэрэнгүй мэдээлэл
          </p>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Patient Info Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Өвчтөний мэдээлэл</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Овог</span>
              <p className="text-white">{patient.last_name}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              <p className="text-white">{patient.first_name}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Төрсөн огноо</span>
              <p className="text-white">
                {patient.date_of_birth ? formatDate(patient.date_of_birth) : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Хүйс</span>
              <p className="text-white">
                {patient.gender ? (GENDER_LABELS[patient.gender] || patient.gender) : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Цусны бүлэг</span>
              <p className="text-white font-medium">{patient.blood_type || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Утас</span>
              <p className="text-white">{patient.phone || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Имэйл</span>
              <p className="text-white">{patient.email || '-'}</p>
            </div>
          </div>
        </div>

        {/* Emergency Contact Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Яаралтай холбоо барих</h2>
          {emergencyContact && (emergencyContact.name || emergencyContact.phone) ? (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-slate-400">Нэр</span>
                <p className="text-white">{emergencyContact.name || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Утас</span>
                <p className="text-white">{emergencyContact.phone || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Хамаарал</span>
                <p className="text-white">{emergencyContact.relationship || '-'}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Мэдээлэл оруулаагүй</p>
          )}
        </div>

        {/* Allergies Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Харшил</h2>
          {patient.allergies && patient.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-sm"
                >
                  {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Харшил бүртгэгдээгүй</p>
          )}
        </div>

        {/* Insurance Info Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Даатгал</h2>
          {insuranceInfo && (insuranceInfo.provider || insuranceInfo.policy_number) ? (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-slate-400">Даатгалын компани</span>
                <p className="text-white">{insuranceInfo.provider || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Полисын дугаар</span>
                <p className="text-white">{insuranceInfo.policy_number || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Бүлгийн дугаар</span>
                <p className="text-white">{insuranceInfo.group_number || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Хүчинтэй хугацаа</span>
                <p className="text-white">
                  {insuranceInfo.valid_until ? formatDate(insuranceInfo.valid_until) : '-'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Даатгалын мэдээлэл оруулаагүй</p>
          )}
        </div>
      </div>

      {/* Medical History Card (full width) */}
      {medicalHistory && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Эмнэлгийн түүх</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className="text-sm text-slate-400">Өвчин, эмгэг</span>
              {medicalHistory.conditions && medicalHistory.conditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {medicalHistory.conditions.map((c, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mt-1">-</p>
              )}
            </div>
            <div>
              <span className="text-sm text-slate-400">Мэс засал</span>
              {medicalHistory.surgeries && medicalHistory.surgeries.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {medicalHistory.surgeries.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mt-1">-</p>
              )}
            </div>
            <div>
              <span className="text-sm text-slate-400">Хэрэглэж буй эм</span>
              {medicalHistory.medications && medicalHistory.medications.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {medicalHistory.medications.map((m, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full text-xs">
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mt-1">-</p>
              )}
            </div>
          </div>
          {medicalHistory.notes && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <span className="text-sm text-slate-400">Нэмэлт тэмдэглэл</span>
              <p className="text-slate-300 text-sm mt-1 whitespace-pre-wrap">{medicalHistory.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/20'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.key
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-slate-600/50 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Encounters Tab */}
        {activeTab === 'encounters' && (
          <div className="overflow-x-auto">
            {encounters.length > 0 ? (
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Огноо</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Төрөл</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Гол зовиур</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Онош</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Эмчилгээний төлөвлөгөө</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Төлөв</th>
                  </tr>
                </thead>
                <tbody>
                  {encounters.map((enc) => {
                    const statusCfg = ENCOUNTER_STATUS_CONFIG[enc.status] || {
                      label: enc.status,
                      color: 'bg-slate-500/20 text-slate-400',
                    }
                    return (
                      <tr key={enc.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                        <td className="py-3 px-4 text-white text-sm">
                          {formatDate(enc.encounter_date)}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm capitalize">
                          {enc.encounter_type}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm max-w-[200px] truncate">
                          {enc.chief_complaint || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm max-w-[200px] truncate">
                          {enc.diagnosis || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm max-w-[200px] truncate">
                          {enc.treatment_plan || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">Үзлэгийн бүртгэл байхгүй</p>
              </div>
            )}
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <div className="overflow-x-auto">
            {prescriptions.length > 0 ? (
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Огноо</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Тэмдэглэл</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Төлөв</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx) => {
                    const statusCfg = PRESCRIPTION_STATUS_CONFIG[rx.status] || {
                      label: rx.status,
                      color: 'bg-slate-500/20 text-slate-400',
                    }
                    return (
                      <tr key={rx.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                        <td className="py-3 px-4 text-white text-sm">
                          {formatDateTime(rx.created_at)}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm max-w-[300px] truncate">
                          {rx.notes || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">Жорын бүртгэл байхгүй</p>
              </div>
            )}
          </div>
        )}

        {/* Medical Notes Tab */}
        {activeTab === 'notes' && (
          <div className="overflow-x-auto">
            {medicalNotes.length > 0 ? (
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Огноо</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Төрөл</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Агуулга</th>
                  </tr>
                </thead>
                <tbody>
                  {medicalNotes.map((note) => (
                    <tr key={note.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                      <td className="py-3 px-4 text-white text-sm">
                        {formatDateTime(note.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-600/50 text-slate-300 rounded-full text-xs">
                          {NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-sm max-w-[400px] truncate">
                        {note.content}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">Тэмдэглэл байхгүй</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-6 text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(patient.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(patient.updated_at)}</span>
      </div>
    </div>
  )
}
