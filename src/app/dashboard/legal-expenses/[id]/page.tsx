'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface LegalExpenseDetail {
  id: string
  case_id: string | null
  expense_type: string | null
  description: string | null
  amount: number | null
  incurred_date: string | null
  is_billable: boolean | null
  receipt_url: string | null
  created_at: string
  updated_at: string
  legal_cases: { id: string; case_number: string; title: string } | null
}

const EXPENSE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  filing_fee: { label: 'Нэхэмжлэлийн хураамж', color: 'bg-blue-500/20 text-blue-400' },
  court_fee: { label: 'Шүүхийн хураамж', color: 'bg-purple-500/20 text-purple-400' },
  expert_witness: { label: 'Шинжээчийн зардал', color: 'bg-cyan-500/20 text-cyan-400' },
  travel: { label: 'Зорчих зардал', color: 'bg-yellow-500/20 text-yellow-400' },
  research: { label: 'Судалгааны зардал', color: 'bg-green-500/20 text-green-400' },
  other: { label: 'Бусад', color: 'bg-slate-500/20 text-slate-400' },
}

function formatPrice(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
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

export default function LegalExpenseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expense, setExpense] = useState<LegalExpenseDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/legal-expenses/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/legal-cases')
          return
        }
        throw new Error('Мэдээлэл ачаалахад алдаа гарлаа')
      }
      const data = await res.json()
      setExpense(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!expense) return
    setEditData({
      amount: expense.amount ?? '',
      expense_type: expense.expense_type || '',
      is_billable: expense.is_billable ?? false,
      description: expense.description || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!expense) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        amount: expense.amount ?? '',
        expense_type: expense.expense_type || '',
        is_billable: expense.is_billable ?? false,
        description: expense.description || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'amount') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
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

      const res = await fetch(`/api/legal-expenses/${id}`, {
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

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <Link href="/dashboard/legal-cases" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Зардлын мэдээлэл олдсонгүй</p>
        <Link href="/dashboard/legal-cases" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const expenseTypeConfig = EXPENSE_TYPE_CONFIG[expense.expense_type || ''] || { label: expense.expense_type || '-', color: 'bg-slate-500/20 text-slate-400' }

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
              <h1 className="text-2xl font-bold text-white">Хэргийн зардал</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${expenseTypeConfig.color}`}>
                {expenseTypeConfig.label}
              </span>
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{expense.id.slice(0, 8)}...</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Expense Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Зардлын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Зардлын төрөл</p>
              {isEditing ? (
                <select
                  value={editData.expense_type as string}
                  onChange={e => setEditData({ ...editData, expense_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="filing_fee">Нэхэмжлэлийн хураамж</option>
                  <option value="court_fee">Шүүхийн хураамж</option>
                  <option value="expert_witness">Шинжээчийн зардал</option>
                  <option value="travel">Зорчих зардал</option>
                  <option value="research">Судалгааны зардал</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${expenseTypeConfig.color}`}>
                  {expenseTypeConfig.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Дүн</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.amount as string | number}
                  onChange={e => setEditData({ ...editData, amount: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="1"
                />
              ) : (
                <p className="text-lg text-blue-400 font-medium mt-1">{formatPrice(expense.amount)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Огноо</p>
              <p className="text-white mt-1">{formatDate(expense.incurred_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Нэхэмжлэгдэх эсэх</p>
              {isEditing ? (
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editData.is_billable as boolean}
                    onChange={e => setEditData({ ...editData, is_billable: e.target.checked })}
                    className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white text-sm">{editData.is_billable ? 'Тийм' : 'Үгүй'}</span>
                </label>
              ) : (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${expense.is_billable ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {expense.is_billable ? 'Тийм' : 'Үгүй'}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(expense.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(expense.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Case + Receipt */}
        <div className="space-y-4">
          {/* Case Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Холбогдох хэрэг</h3>
            {expense.legal_cases ? (
              <div>
                <p className="text-white font-medium">{expense.legal_cases.case_number}</p>
                <p className="text-slate-400 text-sm mt-1">{expense.legal_cases.title}</p>
                <Link
                  href={`/dashboard/legal-cases/${expense.legal_cases.id}`}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-all mt-2 inline-block"
                >
                  Хэрэг харах
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Хэрэг холбоогүй</p>
            )}
          </div>

          {/* Receipt Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Баримт</h3>
            {expense.receipt_url ? (
              <a
                href={expense.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-all flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Баримт харах
              </a>
            ) : (
              <p className="text-slate-500 text-sm">Баримт оруулаагүй</p>
            )}
          </div>

          {/* Amount Summary Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Дүнгийн мэдээлэл</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Дүн</span>
                <span className="text-blue-400 text-sm font-medium">{formatPrice(expense.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Төрөл</span>
                <span className="text-white text-sm">{expenseTypeConfig.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Нэхэмжлэгдэх</span>
                <span className={`text-sm ${expense.is_billable ? 'text-green-400' : 'text-slate-400'}`}>
                  {expense.is_billable ? 'Тийм' : 'Үгүй'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тайлбар</h3>
        {isEditing ? (
          <textarea
            value={editData.description as string}
            onChange={e => setEditData({ ...editData, description: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {expense.description || 'Тайлбар оруулаагүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(expense.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(expense.updated_at)}</span>
      </div>
    </div>
  )
}
