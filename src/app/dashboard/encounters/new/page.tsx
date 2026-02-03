'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Patient {
  id: string
  first_name: string
  last_name: string
}

interface Staff {
  id: string
  name: string
}

export default function NewEncounterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])

  const [patientId, setPatientId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [encounterType, setEncounterType] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [encounterDate, setEncounterDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .single()
        if (store) {
          setStoreId(store.id)
          const [pRes, sRes] = await Promise.all([
            supabase.from('patients').select('id, first_name, last_name').eq('store_id', store.id).order('first_name'),
            supabase.from('staff').select('id, name').eq('store_id', store.id).order('name'),
          ])
          if (pRes.data) setPatients(pRes.data)
          if (sRes.data) setStaffList(sRes.data)
        }
      }
    }
    init()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          provider_id: providerId || undefined,
          encounter_type: encounterType || undefined,
          chief_complaint: chiefComplaint || undefined,
          encounter_date: encounterDate || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Алдаа гарлаа')
      }
      router.push('/dashboard/encounters')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Үзлэг бүртгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/encounters" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ үзлэг</h1>
          <p className="text-slate-400 mt-1">Эмнэлгийн үзлэг бүртгэх</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үзлэгийн мэдээлэл</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Өвчтөн *</label>
                    <select value={patientId} onChange={(e) => setPatientId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                      <option value="">Сонгоно уу</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Эмч</label>
                    <select value={providerId} onChange={(e) => setProviderId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Сонгоно уу</option>
                      {staffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Үзлэгийн төрөл</label>
                    <select value={encounterType} onChange={(e) => setEncounterType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Сонгоно уу</option>
                      <option value="consultation">Зөвлөгөө</option>
                      <option value="follow_up">Дахин үзлэг</option>
                      <option value="emergency">Яаралтай</option>
                      <option value="procedure">Процедур</option>
                      <option value="lab_visit">Лаборатори</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Үзлэгийн огноо</label>
                    <input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Гол зовиур</label>
                  <textarea value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} rows={4}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Өвчтөний гол зовиур, шинж тэмдэг..." />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Зөвлөмж</h2>
              <p className="text-sm text-slate-400">
                Үзлэг бүртгэсний дараа дэлгэрэнгүй хуудаснаас онош, эмчилгээний төлөвлөгөө, жор зэргийг нэмж оруулах боломжтой.
              </p>
            </div>

            <button type="submit" disabled={loading || !patientId}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all">
              {loading ? 'Хадгалж байна...' : 'Үзлэг бүртгэх'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
