'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface LegalCase {
  id: string
  case_number: string
  title: string
  case_type: string
  status: string
  priority: string
  description: string | null
  court_name: string | null
  filing_date: string | null
  next_hearing: string | null
  total_fees: number | null
  amount_paid: number | null
  notes: string | null
  customer_id: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

interface Customer {
  id: string
  name: string | null
}

interface Staff {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Нээлттэй', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  pending_hearing: { label: 'Шүүх хүлээгдэж буй', color: 'bg-purple-500/20 text-purple-400' },
  settled: { label: 'Шийдвэрлэсэн', color: 'bg-green-500/20 text-green-400' },
  closed: { label: 'Хаагдсан', color: 'bg-slate-500/20 text-slate-400' },
  archived: { label: 'Архивлагдсан', color: 'bg-slate-500/20 text-slate-500' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  medium: { label: 'Дунд', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

const CASE_TYPE_LABELS: Record<string, string> = {
  civil: 'Иргэний',
  criminal: 'Эрүүгийн',
  corporate: 'Компанийн',
  family: 'Гэр бүлийн',
  real_estate: 'Үл хөдлөх',
  immigration: 'Цагаачлал',
  tax: 'Татварын',
  labor: 'Хөдөлмөрийн',
  other: 'Бусад',
}

function formatPrice(amount: number | null) {
  if (!amount) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function LegalCasesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<LegalCase[]>([])
  const [total, setTotal] = useState(0)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Staff[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [caseTypeFilter, setCaseTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formCaseType, setFormCaseType] = useState('civil')
  const [formPriority, setFormPriority] = useState('medium')
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCourtName, setFormCourtName] = useState('')
  const [formFilingDate, setFormFilingDate] = useState('')
  const [formNextHearing, setFormNextHearing] = useState('')
  const [formTotalFees, setFormTotalFees] = useState('')
  const [formNotes, setFormNotes] = useState('')

  async function loadCases() {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (caseTypeFilter) params.set('case_type', caseTypeFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    const url = `/api/legal-cases${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setCases(json.data || [])
      setTotal(json.total || 0)
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) return

      const [, customersRes, staffRes] = await Promise.all([
        loadCases(),
        supabase.from('customers').select('id, name').eq('store_id', store.id).order('name'),
        supabase.from('staff').select('id, name').eq('store_id', store.id).order('name'),
      ])

      if (customersRes.data) setCustomers(customersRes.data)
      if (staffRes.data) setStaff(staffRes.data)

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loading) {
      loadCases()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, caseTypeFilter, priorityFilter])

  const filtered = useMemo(() => {
    if (!search.trim()) return cases
    const q = search.trim().toLowerCase()
    return cases.filter(c =>
      c.case_number?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.court_name?.toLowerCase().includes(q)
    )
  }, [cases, search])

  const kpis = useMemo(() => {
    const total_count = cases.length
    const active = cases.filter(c => ['open', 'in_progress', 'pending_hearing'].includes(c.status)).length
    const settled = cases.filter(c => c.status === 'settled').length
    const totalFeesSum = cases.reduce((sum, c) => sum + (c.total_fees || 0), 0)
    return [
      { label: 'Нийт хэрэг', value: total_count },
      { label: 'Идэвхтэй', value: active },
      { label: 'Шийдвэрлэгдсэн', value: settled },
      { label: 'Нийт хураамж', value: new Intl.NumberFormat('mn-MN').format(totalFeesSum) + '₮' },
    ]
  }, [cases])

  // Lookup helpers
  const customerMap = useMemo(() => {
    const map: Record<string, string> = {}
    customers.forEach(c => { map[c.id] = c.name || 'N/A' })
    return map
  }, [customers])

  const staffMap = useMemo(() => {
    const map: Record<string, string> = {}
    staff.forEach(s => { map[s.id] = s.name })
    return map
  }, [staff])

  async function handleCreate() {
    if (!formTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/legal-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          case_type: formCaseType,
          priority: formPriority,
          customer_id: formCustomerId || null,
          assigned_to: formAssignedTo || null,
          description: formDescription || null,
          court_name: formCourtName || null,
          filing_date: formFilingDate || null,
          next_hearing: formNextHearing || null,
          total_fees: formTotalFees ? Number(formTotalFees) : null,
          notes: formNotes || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadCases()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormTitle('')
    setFormCaseType('civil')
    setFormPriority('medium')
    setFormCustomerId('')
    setFormAssignedTo('')
    setFormDescription('')
    setFormCourtName('')
    setFormFilingDate('')
    setFormNextHearing('')
    setFormTotalFees('')
    setFormNotes('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Хууль зүйн хэргүүд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {total} хэрэг
            {filtered.length !== cases.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/legal-cases/new"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ хэрэг
        </Link>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filter Bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Хэргийн дугаар, нэр, шүүхээр хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="open">Нээлттэй</option>
              <option value="in_progress">Явагдаж буй</option>
              <option value="pending_hearing">Шүүх хүлээгдэж буй</option>
              <option value="settled">Шийдвэрлэсэн</option>
              <option value="closed">Хаагдсан</option>
              <option value="archived">Архивлагдсан</option>
            </select>
            <select
              value={caseTypeFilter}
              onChange={(e) => setCaseTypeFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="civil">Иргэний</option>
              <option value="criminal">Эрүүгийн</option>
              <option value="corporate">Компанийн</option>
              <option value="family">Гэр бүлийн</option>
              <option value="real_estate">Үл хөдлөх</option>
              <option value="immigration">Цагаачлал</option>
              <option value="tax">Татварын</option>
              <option value="labor">Хөдөлмөрийн</option>
              <option value="other">Бусад</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх зэрэглэл</option>
              <option value="low">Бага</option>
              <option value="medium">Дунд</option>
              <option value="high">Өндөр</option>
              <option value="urgent">Яаралтай</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Дугаар</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Нэр</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төрөл</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төлөв</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Зэрэглэл</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Хариуцагч</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Дараагийн шүүх</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Хураамж</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(legalCase => {
                const sc = STATUS_CONFIG[legalCase.status] || STATUS_CONFIG.open
                const pc = PRIORITY_CONFIG[legalCase.priority] || PRIORITY_CONFIG.medium
                return (
                  <tr key={legalCase.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-blue-400 font-mono text-sm">{legalCase.case_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">{legalCase.title}</p>
                        {legalCase.customer_id && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            {customerMap[legalCase.customer_id] || '-'}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">
                        {CASE_TYPE_LABELS[legalCase.case_type] || legalCase.case_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${pc.color}`}>
                        {pc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">
                        {legalCase.assigned_to ? (staffMap[legalCase.assigned_to] || '-') : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">
                        {legalCase.next_hearing
                          ? new Date(legalCase.next_hearing).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <p className="text-white text-sm">{formatPrice(legalCase.total_fees)}</p>
                        {legalCase.amount_paid && legalCase.total_fees && legalCase.amount_paid < legalCase.total_fees && (
                          <p className="text-xs text-yellow-400 mt-0.5">
                            Төлсөн: {formatPrice(legalCase.amount_paid)}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    {cases.length > 0
                      ? 'Хайлтад тохирох хэрэг олдсонгүй'
                      : 'Хэрэг бүртгэгдээгүй байна'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Legal Case Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ хэрэг бүртгэх</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Хэргийн нэр *</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Хэргийн нэр оруулах"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хэргийн төрөл</label>
                <select
                  value={formCaseType}
                  onChange={e => setFormCaseType(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="civil">Иргэний</option>
                  <option value="criminal">Эрүүгийн</option>
                  <option value="corporate">Компанийн</option>
                  <option value="family">Гэр бүлийн</option>
                  <option value="real_estate">Үл хөдлөх</option>
                  <option value="immigration">Цагаачлал</option>
                  <option value="tax">Татварын</option>
                  <option value="labor">Хөдөлмөрийн</option>
                  <option value="other">Бусад</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Зэрэглэл</label>
                <select
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="low">Бага</option>
                  <option value="medium">Дунд</option>
                  <option value="high">Өндөр</option>
                  <option value="urgent">Яаралтай</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Үйлчлүүлэгч</label>
              <select
                value={formCustomerId}
                onChange={e => setFormCustomerId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Сонгох --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name || 'N/A'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Хариуцагч</label>
              <select
                value={formAssignedTo}
                onChange={e => setFormAssignedTo(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Сонгох --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тайлбар</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                rows={3}
                placeholder="Хэргийн дэлгэрэнгүй тайлбар"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Шүүхийн нэр</label>
              <input
                type="text"
                value={formCourtName}
                onChange={e => setFormCourtName(e.target.value)}
                placeholder="Жишээ: Сүхбаатар дүүргийн шүүх"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Нэхэмжлэл гаргасан огноо</label>
                <input
                  type="date"
                  value={formFilingDate}
                  onChange={e => setFormFilingDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Дараагийн шүүх хурал</label>
                <input
                  type="date"
                  value={formNextHearing}
                  onChange={e => setFormNextHearing(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Нийт хураамж</label>
              <input
                type="number"
                value={formTotalFees}
                onChange={e => setFormTotalFees(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Нэмэлт тэмдэглэл"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Болих
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formTitle.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Бүртгэж байна...' : 'Бүртгэх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
