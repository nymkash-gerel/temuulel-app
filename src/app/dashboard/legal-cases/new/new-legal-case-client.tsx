'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Customer { id: string; name: string | null; email: string | null }
interface Staff { id: string; name: string }

const caseTypes = [
  { value: 'civil', label: 'Иргэний' },
  { value: 'criminal', label: 'Эрүүгийн' },
  { value: 'corporate', label: 'Аж ахуйн' },
  { value: 'family', label: 'Гэр бүлийн' },
  { value: 'real_estate', label: 'Үл хөдлөх' },
  { value: 'immigration', label: 'Цагаачлал' },
  { value: 'tax', label: 'Татварын' },
  { value: 'labor', label: 'Хөдөлмөрийн' },
  { value: 'other', label: 'Бусад' },
]

const priorities = [
  { value: 'low', label: 'Бага' },
  { value: 'medium', label: 'Дунд' },
  { value: 'high', label: 'Өндөр' },
  { value: 'urgent', label: 'Яаралтай' },
]

interface NewLegalCaseClientProps {
  initialCustomers: Customer[]
  initialStaff: Staff[]
}

export default function NewLegalCaseClient({ initialCustomers, initialStaff }: NewLegalCaseClientProps) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customers] = useState<Customer[]>(initialCustomers)
  const [staff] = useState<Staff[]>(initialStaff)

  const [caseNumber, setCaseNumber] = useState(`LC-${Date.now()}`)
  const [title, setTitle] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [caseType, setCaseType] = useState('')
  const [priority, setPriority] = useState('')
  const [description, setDescription] = useState('')
  const [courtName, setCourtName] = useState('')
  const [filingDate, setFilingDate] = useState('')
  const [nextHearing, setNextHearing] = useState('')
  const [totalFees, setTotalFees] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = { case_number: caseNumber, title }
      if (customerId) body.customer_id = customerId
      if (assignedTo) body.assigned_to = assignedTo
      if (caseType) body.case_type = caseType
      if (priority) body.priority = priority
      if (description) body.description = description
      if (courtName) body.court_name = courtName
      if (filingDate) body.filing_date = filingDate
      if (nextHearing) body.next_hearing = nextHearing
      if (totalFees) body.total_fees = parseFloat(totalFees)
      if (notes) body.notes = notes

      const res = await fetch('/api/legal-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Хэрэг үүсгэхэд алдаа гарлаа')
      }

      router.push('/dashboard/legal-cases')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Хэрэг үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/legal-cases" className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <div><h1 className="text-2xl font-bold text-white">Шинэ хэрэг</h1><p className="text-slate-400 mt-1">Шинэ хэрэг бүртгэх</p></div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үндсэн мэдээлэл</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Хэргийн дугаар *</label><input type="text" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="LC-1234567890" required /></div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Хэргийн нэр *</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Хэргийн нэр оруулах..." required /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Хэрэглэгч / Үйлчлүүлэгч</label><select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Сонгоно уу</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Хариуцсан хуульч</label><select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Сонгоно уу</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Хэргийн төрөл</label><select value={caseType} onChange={(e) => setCaseType(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Сонгоно уу</option>{caseTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Ачаалал</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Сонгоно уу</option>{priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-300 mb-2">Тайлбар</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Хэргийн дэлгэрэнгүй тайлбар..." /></div>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Шүүхийн мэдээлэл</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-300 mb-2">Шүүхийн нэр</label><input type="text" value={courtName} onChange={(e) => setCourtName(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Шүүхийн нэр оруулах..." /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Нэхэмжлэл гаргасан огноо</label><input type="date" value={filingDate} onChange={(e) => setFilingDate(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Дараагийн шүүх хуралдаан</label><input type="date" value={nextHearing} onChange={(e) => setNextHearing(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Тэмдэглэл</h2>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Нэмэлт тэмдэглэл..." />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Төлбөр</h2>
              <div><label className="block text-sm font-medium text-slate-300 mb-2">Нийт төлбөр (₮)</label><input type="number" value={totalFees} onChange={(e) => setTotalFees(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" min="0" step="any" /></div>
            </div>
            <div className="space-y-3">
              <button type="submit" disabled={loading || !caseNumber || !title} className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Хадгалж байна...' : 'Хэрэг үүсгэх'}</button>
              <Link href="/dashboard/legal-cases" className="block w-full py-3 text-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-xl transition-all">Цуцлах</Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
