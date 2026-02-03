'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface DealDetail {
  id: string
  deal_number: string
  status: string
  deal_type: string
  asking_price: number | null
  offer_price: number | null
  final_price: number | null
  commission_rate: number | null
  commission_amount: number | null
  agent_share_rate: number | null
  agent_share_amount: number | null
  company_share_amount: number | null
  viewing_date: string | null
  offer_date: string | null
  contract_date: string | null
  closed_date: string | null
  withdrawn_date: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  products: { id: string; name: string; images: string[] | null; base_price: number; category: string | null; description: string | null } | null
  customers: { id: string; name: string; phone: string | null; email: string | null; address: string | null } | null
  staff: { id: string; name: string; phone: string | null; email: string | null } | null
  agent_commissions: Array<{
    id: string
    commission_amount: number
    agent_share: number
    company_share: number
    status: string
    paid_at: string | null
    created_at: string
  }>
}

const PIPELINE_STEPS = ['lead', 'viewing', 'offer', 'contract', 'closed']

const STATUS_LABELS: Record<string, string> = {
  lead: 'Лийд',
  viewing: 'Үзүүлэлт',
  offer: 'Санал',
  contract: 'Гэрээ',
  closed: 'Хаагдсан',
  withdrawn: 'Татгалзсан',
  lost: 'Алдагдсан',
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  sale: 'Худалдаа',
  rent: 'Түрээс',
  lease: 'Лийз',
}

const NEXT_STATUS: Record<string, string> = {
  lead: 'viewing',
  viewing: 'offer',
  offer: 'contract',
  contract: 'closed',
}

const NEXT_LABELS: Record<string, string> = {
  lead: 'Үзүүлэлтэнд шилжүүлэх',
  viewing: 'Санал болгох',
  offer: 'Гэрээнд шилжүүлэх',
  contract: 'Хэлцэл хаах',
}

function formatPrice(amount: number | null) {
  if (!amount) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DealDetailPage() {
  const { id } = useParams()
  const [deal, setDeal] = useState<DealDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [finalPrice, setFinalPrice] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  async function loadDeal() {
    const res = await fetch(`/api/deals/${id}`)
    if (res.ok) {
      const data = await res.json()
      setDeal(data)
      setNotesValue(data.notes || '')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDeal()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function advanceStatus() {
    if (!deal) return
    const nextStatus = NEXT_STATUS[deal.status]
    if (!nextStatus) return

    // If advancing to 'closed', show final price modal
    if (nextStatus === 'closed') {
      setFinalPrice(String(deal.offer_price || deal.asking_price || ''))
      setShowCloseModal(true)
      return
    }

    setUpdating(true)
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) await loadDeal()
    } finally {
      setUpdating(false)
    }
  }

  async function closeDeal() {
    setUpdating(true)
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          final_price: Number(finalPrice) || null,
        }),
      })
      if (res.ok) {
        setShowCloseModal(false)
        await loadDeal()
      }
    } finally {
      setUpdating(false)
    }
  }

  async function markLost() {
    if (!deal || ['closed', 'withdrawn', 'lost'].includes(deal.status)) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'lost' }),
      })
      if (res.ok) await loadDeal()
    } finally {
      setUpdating(false)
    }
  }

  async function markWithdrawn() {
    if (!deal || deal.status !== 'contract') return
    setUpdating(true)
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      })
      if (res.ok) await loadDeal()
    } finally {
      setUpdating(false)
    }
  }

  async function saveNotes() {
    setUpdating(true)
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      })
      if (res.ok) {
        setEditingNotes(false)
        await loadDeal()
      }
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Хэлцэл олдсонгүй</p>
        <Link href="/dashboard/deals" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">Буцах</Link>
      </div>
    )
  }

  const isTerminal = ['closed', 'withdrawn', 'lost'].includes(deal.status)
  const pipelineIndex = PIPELINE_STEPS.indexOf(deal.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/deals" className="text-slate-400 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{deal.deal_number}</h1>
            <p className="text-sm text-slate-400">{DEAL_TYPE_LABELS[deal.deal_type]} &middot; {formatDate(deal.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isTerminal && deal.status !== 'contract' && (
            <button onClick={markLost} disabled={updating} className="px-4 py-2 text-sm bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 disabled:opacity-50">
              Алдагдсан
            </button>
          )}
          {deal.status === 'contract' && (
            <button onClick={markWithdrawn} disabled={updating} className="px-4 py-2 text-sm bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30 disabled:opacity-50">
              Татгалзсан
            </button>
          )}
          {!isTerminal && NEXT_STATUS[deal.status] && (
            <button onClick={advanceStatus} disabled={updating} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
              {updating ? '...' : NEXT_LABELS[deal.status]}
            </button>
          )}
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2">
          {PIPELINE_STEPS.map((step, i) => {
            const isCurrent = step === deal.status
            const isPast = pipelineIndex >= 0 && i < pipelineIndex
            const isCompleted = deal.status === 'closed' && i <= PIPELINE_STEPS.indexOf('closed')
            const active = isCurrent || isPast || isCompleted

            return (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 text-center text-sm font-medium transition-colors ${
                  active
                    ? isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-green-600/20 text-green-400'
                    : 'bg-slate-700/50 text-slate-500'
                }`}>
                  {active && !isCurrent && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                  {STATUS_LABELS[step]}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#22c55e' : '#475569'} strokeWidth="2" className="shrink-0 mx-1">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
        {isTerminal && deal.status !== 'closed' && (
          <div className="mt-3 text-center">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              deal.status === 'lost' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {STATUS_LABELS[deal.status]}
            </span>
          </div>
        )}
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Property Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm text-slate-400 font-medium mb-3">Үл хөдлөх</h3>
          {deal.products ? (
            <div>
              <p className="text-white font-medium">{deal.products.name}</p>
              {deal.products.category && <p className="text-sm text-slate-400">{deal.products.category}</p>}
              <p className="text-blue-400 mt-1">{formatPrice(deal.products.base_price)}</p>
              {deal.products.description && <p className="text-sm text-slate-500 mt-2 line-clamp-3">{deal.products.description}</p>}
            </div>
          ) : (
            <p className="text-slate-500">Сонгоогүй</p>
          )}
        </div>

        {/* Customer Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm text-slate-400 font-medium mb-3">Үйлчлүүлэгч</h3>
          {deal.customers ? (
            <div>
              <p className="text-white font-medium">{deal.customers.name}</p>
              {deal.customers.phone && <p className="text-sm text-slate-400">{deal.customers.phone}</p>}
              {deal.customers.email && <p className="text-sm text-slate-400">{deal.customers.email}</p>}
              {deal.customers.address && <p className="text-sm text-slate-500 mt-2">{deal.customers.address}</p>}
            </div>
          ) : (
            <p className="text-slate-500">Сонгоогүй</p>
          )}
        </div>

        {/* Agent Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm text-slate-400 font-medium mb-3">Агент</h3>
          {deal.staff ? (
            <div>
              <p className="text-white font-medium">{deal.staff.name}</p>
              {deal.staff.phone && <p className="text-sm text-slate-400">{deal.staff.phone}</p>}
              {deal.staff.email && <p className="text-sm text-slate-400">{deal.staff.email}</p>}
            </div>
          ) : (
            <p className="text-slate-500">Сонгоогүй</p>
          )}
        </div>
      </div>

      {/* Financial Breakdown */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-4">Санхүүгийн мэдээлэл</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">Зарын үнэ</p>
            <p className="text-lg text-white font-medium">{formatPrice(deal.asking_price)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Саналын үнэ</p>
            <p className="text-lg text-white font-medium">{formatPrice(deal.offer_price)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Эцсийн үнэ</p>
            <p className="text-lg text-green-400 font-medium">{formatPrice(deal.final_price)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Комисс ({deal.commission_rate || 0}%)</p>
            <p className="text-lg text-blue-400 font-medium">{formatPrice(deal.commission_amount)}</p>
          </div>
        </div>

        {deal.commission_amount && (
          <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Агентын хувь ({deal.agent_share_rate || 0}%)</p>
              <p className="text-lg text-purple-400 font-medium">{formatPrice(deal.agent_share_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Компанийн хувь</p>
              <p className="text-lg text-orange-400 font-medium">{formatPrice(deal.company_share_amount)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-4">Хугацаа</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Үүсгэсэн</span>
            <span className="text-white">{formatDate(deal.created_at)}</span>
          </div>
          {deal.viewing_date && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Үзүүлэлт</span>
              <span className="text-white">{formatDate(deal.viewing_date)}</span>
            </div>
          )}
          {deal.offer_date && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Санал</span>
              <span className="text-white">{formatDate(deal.offer_date)}</span>
            </div>
          )}
          {deal.contract_date && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Гэрээ</span>
              <span className="text-white">{formatDate(deal.contract_date)}</span>
            </div>
          )}
          {deal.closed_date && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Хаагдсан</span>
              <span className="text-green-400">{formatDate(deal.closed_date)}</span>
            </div>
          )}
          {deal.withdrawn_date && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Татгалзсан</span>
              <span className="text-yellow-400">{formatDate(deal.withdrawn_date)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Commission Records */}
      {deal.agent_commissions && deal.agent_commissions.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Комиссын бүртгэл</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-2 py-2 text-xs text-slate-500">Комисс</th>
                <th className="text-left px-2 py-2 text-xs text-slate-500">Агентын хувь</th>
                <th className="text-left px-2 py-2 text-xs text-slate-500">Компанийн хувь</th>
                <th className="text-left px-2 py-2 text-xs text-slate-500">Төлөв</th>
                <th className="text-left px-2 py-2 text-xs text-slate-500">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {deal.agent_commissions.map(c => (
                <tr key={c.id} className="border-b border-slate-700/50">
                  <td className="px-2 py-2 text-sm text-white">{formatPrice(c.commission_amount)}</td>
                  <td className="px-2 py-2 text-sm text-purple-400">{formatPrice(c.agent_share)}</td>
                  <td className="px-2 py-2 text-sm text-orange-400">{formatPrice(c.company_share)}</td>
                  <td className="px-2 py-2 text-sm text-slate-300">{c.status}</td>
                  <td className="px-2 py-2 text-sm text-slate-400">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-slate-400 font-medium">Тэмдэглэл</h3>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="text-xs text-blue-400 hover:text-blue-300">
              Засах
            </button>
          )}
        </div>
        {editingNotes ? (
          <div>
            <textarea
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setEditingNotes(false); setNotesValue(deal.notes || '') }} className="px-3 py-1 text-sm text-slate-400">
                Болих
              </button>
              <button onClick={saveNotes} disabled={updating} className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                Хадгалах
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{deal.notes || 'Тэмдэглэл байхгүй'}</p>
        )}
      </div>

      {/* Close Deal Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Хэлцэл хаах</h2>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Эцсийн үнэ</label>
              <input
                type="number"
                value={finalPrice}
                onChange={e => setFinalPrice(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">
              Комисс ({deal.commission_rate}%): {formatPrice(Number(finalPrice) * ((deal.commission_rate || 5) / 100))}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 text-sm text-slate-400">
                Болих
              </button>
              <button onClick={closeDeal} disabled={updating || !finalPrice} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50">
                {updating ? '...' : 'Хаах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
