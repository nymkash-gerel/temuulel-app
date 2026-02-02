'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { legalCaseTransitions } from '@/lib/status-machine'

interface LegalCaseDetail {
  id: string
  case_number: string
  title: string
  customer_id: string | null
  assigned_to: string | null
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
  created_at: string
  updated_at: string
  customers: { id: string; name: string } | null
  staff: { id: string; name: string } | null
}

interface CaseDocument {
  id: string
  case_id: string
  name: string
  document_type: string | null
  file_url: string | null
  file_size: number | null
  uploaded_by: string | null
  notes: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Нээлттэй',
  in_progress: 'Явагдаж байна',
  pending_hearing: 'Шүүх хүлээгдэж буй',
  settled: 'Шийдвэрлэгдсэн',
  closed: 'Хаагдсан',
  archived: 'Архивлагдсан',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Нээлттэй', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  on_hold: { label: 'Түр зогссон', color: 'bg-orange-500/20 text-orange-400' },
  closed_won: { label: 'Хожсон', color: 'bg-green-500/20 text-green-400' },
  closed_lost: { label: 'Алдсан', color: 'bg-red-500/20 text-red-400' },
  closed: { label: 'Хаагдсан', color: 'bg-slate-500/20 text-slate-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  medium: { label: 'Дунд', color: 'bg-yellow-500/20 text-yellow-400' },
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

const DOC_TYPE_LABELS: Record<string, string> = {
  complaint: 'Нэхэмжлэл',
  contract: 'Гэрээ',
  evidence: 'Нотлох баримт',
  court_order: 'Шүүхийн шийдвэр',
  correspondence: 'Захидал харилцаа',
  invoice: 'Нэхэмжлэх',
  other: 'Бусад',
}

function formatPrice(amount: number | null) {
  if (!amount) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function LegalCaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [legalCase, setLegalCase] = useState<LegalCaseDetail | null>(null)
  const [documents, setDocuments] = useState<CaseDocument[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    const { data } = await supabase
      .from('legal_cases')
      .select(`
        id, case_number, title, customer_id, assigned_to, case_type, status, priority,
        description, court_name, filing_date, next_hearing, total_fees, amount_paid,
        notes, created_at, updated_at,
        customers(id, name),
        staff(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/legal-cases')
      return
    }

    setLegalCase(data as unknown as LegalCaseDetail)

    // Load case documents
    const { data: docs } = await supabase
      .from('case_documents')
      .select('id, case_id, name, document_type, file_url, file_size, uploaded_by, notes, created_at')
      .eq('case_id', id)
      .order('created_at', { ascending: false })

    setDocuments(docs || [])
    setLoading(false)
  }

  function startEdit() {
    if (!legalCase) return
    setEditData({
      title: legalCase.title || '',
      case_type: legalCase.case_type || '',
      priority: legalCase.priority || '',
      description: legalCase.description || '',
      court_name: legalCase.court_name || '',
      filing_date: legalCase.filing_date ? legalCase.filing_date.slice(0, 10) : '',
      next_hearing: legalCase.next_hearing ? legalCase.next_hearing.slice(0, 10) : '',
      total_fees: legalCase.total_fees ?? '',
      notes: legalCase.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!legalCase) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        title: legalCase.title || '',
        case_type: legalCase.case_type || '',
        priority: legalCase.priority || '',
        description: legalCase.description || '',
        court_name: legalCase.court_name || '',
        filing_date: legalCase.filing_date ? legalCase.filing_date.slice(0, 10) : '',
        next_hearing: legalCase.next_hearing ? legalCase.next_hearing.slice(0, 10) : '',
        total_fees: legalCase.total_fees ?? '',
        notes: legalCase.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'total_fees') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else if ((key === 'filing_date' || key === 'next_hearing') && editData[key] === '') {
            changes[key] = null
          } else {
            changes[key] = editData[key]
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/legal-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Алдаа гарлаа' }))
        throw new Error(err.error || 'Алдаа гарлаа')
      }

      setIsEditing(false)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!legalCase) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Хэрэг олдсонгүй</p>
        <Link href="/dashboard/legal-cases" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[legalCase.status] || { label: legalCase.status, color: 'bg-slate-500/20 text-slate-400' }
  const pc = PRIORITY_CONFIG[legalCase.priority] || { label: legalCase.priority, color: 'bg-slate-500/20 text-slate-400' }
  const balance = (legalCase.total_fees || 0) - (legalCase.amount_paid || 0)
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

    return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/legal-cases"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{legalCase.case_number}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              {isEditing ? (
                <select
                  value={editData.priority as string}
                  onChange={e => setEditData({ ...editData, priority: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="low">Бага</option>
                  <option value="medium">Дунд</option>
                  <option value="high">Өндөр</option>
                  <option value="urgent">Яаралтай</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${pc.color}`}>
                  {pc.label}
                </span>
              )}
              <StatusActions
                currentStatus={legalCase.status}
                transitions={legalCaseTransitions}
                statusLabels={STATUS_LABELS}
                apiPath={`/api/legal-cases/${id}`}
                onSuccess={load}
              />
              {!isEditing ? (
                <button
                  onClick={startEdit}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Засах
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editData.title as string}
                onChange={e => setEditData({ ...editData, title: e.target.value })}
                className={`${inputClassName} mt-1`}
              />
            ) : (
              <p className="text-slate-400 mt-1">{legalCase.title}</p>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Case Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Хэргийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Хэргийн дугаар</p>
              <p className="text-white font-mono mt-1">{legalCase.case_number}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хэргийн нэр</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.title as string}
                  onChange={e => setEditData({ ...editData, title: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{legalCase.title}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төрөл</p>
              {isEditing ? (
                <select
                  value={editData.case_type as string}
                  onChange={e => setEditData({ ...editData, case_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
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
              ) : (
                <p className="text-white mt-1">{CASE_TYPE_LABELS[legalCase.case_type] || legalCase.case_type}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Шүүх</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.court_name as string}
                  onChange={e => setEditData({ ...editData, court_name: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{legalCase.court_name || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Нэхэмжлэл гаргасан</p>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.filing_date as string}
                  onChange={e => setEditData({ ...editData, filing_date: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{formatDate(legalCase.filing_date)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Дараагийн шүүх хурал</p>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.next_hearing as string}
                  onChange={e => setEditData({ ...editData, next_hearing: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className={`mt-1 ${legalCase.next_hearing ? 'text-blue-400 font-medium' : 'text-white'}`}>
                  {formatDate(legalCase.next_hearing)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(legalCase.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(legalCase.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Client + Attorney */}
        <div className="space-y-4">
          {/* Client Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Үйлчлүүлэгч</h3>
            {legalCase.customers ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {legalCase.customers.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{legalCase.customers.name}</p>
                  <Link
                    href={`/dashboard/customers/${legalCase.customers.id}`}
                    className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                  >
                    Дэлгэрэнгүй
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Сонгоогүй</p>
            )}
          </div>

          {/* Attorney Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хуульч</h3>
            {legalCase.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {legalCase.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{legalCase.staff.name}</p>
                  <p className="text-slate-400 text-xs">Хариуцсан хуульч</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Томилоогүй</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-4">Төлбөрийн мэдээлэл</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Нийт хураамж</p>
            {isEditing ? (
              <input
                type="number"
                value={editData.total_fees as string | number}
                onChange={e => setEditData({ ...editData, total_fees: e.target.value })}
                className={`${inputClassName} mt-1`}
                min="0"
                step="1"
              />
            ) : (
              <p className="text-lg text-white font-medium mt-1">{formatPrice(legalCase.total_fees)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Төлсөн</p>
            <p className="text-lg text-green-400 font-medium mt-1">{formatPrice(legalCase.amount_paid)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Үлдэгдэл</p>
            <p className={`text-lg font-medium mt-1 ${balance > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
              {legalCase.total_fees ? formatPrice(balance) : '-'}
            </p>
          </div>
        </div>
        {legalCase.total_fees && legalCase.total_fees > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Төлбөрийн явц</span>
              <span>{Math.round(((legalCase.amount_paid || 0) / legalCase.total_fees) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((legalCase.amount_paid || 0) / legalCase.total_fees) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Description Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Хэргийн тайлбар</h3>
        {isEditing ? (
          <textarea
            value={editData.description as string}
            onChange={e => setEditData({ ...editData, description: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {legalCase.description || 'Тайлбар оруулаагүй'}
          </p>
        )}
      </div>

      {/* Notes Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тэмдэглэл</h3>
        {isEditing ? (
          <textarea
            value={editData.notes as string}
            onChange={e => setEditData({ ...editData, notes: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {legalCase.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Documents Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-slate-400 font-medium">
              Бичиг баримтууд ({documents.length})
            </h3>
          </div>
        </div>
        {documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Нэр</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Төрөл</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Хэмжээ</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Огноо</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        {doc.file_url ? (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-all"
                          >
                            {doc.name}
                          </a>
                        ) : (
                          <span className="text-white text-sm font-medium">{doc.name}</span>
                        )}
                        {doc.notes && (
                          <p className="text-slate-500 text-xs mt-0.5">{doc.notes}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">
                        {DOC_TYPE_LABELS[doc.document_type || ''] || doc.document_type || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400 text-sm">{formatFileSize(doc.file_size)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400 text-sm">{formatDate(doc.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm">Бичиг баримт бүртгэгдээгүй</p>
          </div>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(legalCase.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(legalCase.updated_at)}</span>
      </div>
    </div>
  )
}
