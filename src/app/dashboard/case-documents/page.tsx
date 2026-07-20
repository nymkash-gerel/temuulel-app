'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'
import { resolveStoreId } from '@/lib/resolve-store'

interface CaseRef {
  id: string
  title: string
  case_number: string
}

interface StaffRef {
  id: string
  name: string
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
  updated_at: string
  legal_cases: CaseRef | null
  staff: StaffRef | null
}

const DOC_TYPE_LABELS: Record<string, string> = {
  general: 'Ерөнхий',
  contract: 'Гэрээ',
  court_filing: 'Шүүхийн баримт',
  evidence: 'Нотлох баримт',
  correspondence: 'Захидал харилцаа',
  invoice: 'Нэхэмжлэх',
  other: 'Бусад',
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function CaseDocumentsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<CaseDocument[]>([])
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('')

  const loadDocuments = useCallback(async () => {
    const params = new URLSearchParams()
    if (documentTypeFilter) params.set('document_type', documentTypeFilter)
    const url = `/api/case-documents${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setDocuments(json.data || [])
      setTotal(json.total || 0)
    }
  }, [documentTypeFilter])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const storeId = await resolveStoreId(supabase, user.id)
      if (!storeId) return

      await loadDocuments()
      setLoading(false)
    }
    load()
  }, [supabase, loadDocuments])

  useEffect(() => {
    if (!loading) {
      loadDocuments()
    }
  }, [documentTypeFilter, loading, loadDocuments])

  const filtered = useMemo(() => {
    if (!search.trim()) return documents
    const q = search.trim().toLowerCase()
    return documents.filter(d =>
      d.name?.toLowerCase().includes(q) ||
      d.legal_cases?.title?.toLowerCase().includes(q) ||
      d.legal_cases?.case_number?.toLowerCase().includes(q)
    )
  }, [documents, search])

  const kpis = useMemo(() => {
    const total_count = documents.length
    const withFile = documents.filter(d => !!d.file_url).length
    const totalSize = documents.reduce((sum, d) => sum + (d.file_size || 0), 0)
    return [
      { label: 'Нийт баримт', value: total_count },
      { label: 'Файлтай', value: withFile },
      { label: 'Нийт хэмжээ', value: formatFileSize(totalSize) },
    ]
  }, [documents])

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
          <h1 className="text-2xl font-bold text-white">Хэргийн баримтууд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {total} баримт
            {filtered.length !== documents.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/legal-cases"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          Хэргүүд рүү
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
                placeholder="Баримтын нэр, хэргийн нэр эсвэл дугаараар хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={documentTypeFilter}
              onChange={(e) => setDocumentTypeFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="general">Ерөнхий</option>
              <option value="contract">Гэрээ</option>
              <option value="court_filing">Шүүхийн баримт</option>
              <option value="evidence">Нотлох баримт</option>
              <option value="correspondence">Захидал харилцаа</option>
              <option value="invoice">Нэхэмжлэх</option>
              <option value="other">Бусад</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Баримт</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Хэрэг</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төрөл</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Оруулсан</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Хэмжээ</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
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
                      {doc.notes && <p className="text-slate-500 text-xs mt-0.5">{doc.notes}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {doc.legal_cases ? (
                      <Link href={`/dashboard/legal-cases/${doc.case_id}`} className="block group">
                        <p className="text-white text-sm font-medium group-hover:text-blue-400 transition-colors">
                          {doc.legal_cases.title}
                        </p>
                        <p className="text-blue-400 font-mono text-xs mt-0.5">{doc.legal_cases.case_number}</p>
                      </Link>
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300 text-sm">
                      {DOC_TYPE_LABELS[doc.document_type || ''] || doc.document_type || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300 text-sm">{doc.staff?.name || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-slate-400 text-sm">{formatFileSize(doc.file_size)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-400 text-sm">{formatDate(doc.created_at)}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    {documents.length > 0
                      ? 'Хайлтад тохирох баримт олдсонгүй'
                      : 'Баримт бүртгэгдээгүй байна'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
