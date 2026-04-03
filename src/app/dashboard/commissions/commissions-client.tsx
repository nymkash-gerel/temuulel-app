'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { exportToFile } from '@/lib/export-utils'
import { formatPrice } from '@/lib/format'

interface Commission {
  id: string
  commission_amount: number
  agent_share: number
  company_share: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paid_at: string | null
  notes: string | null
  created_at: string
  deals: {
    id: string
    deal_number: string
    final_price: number | null
    deal_type: string
    status: string
    products: { id: string; name: string } | null
  } | null
  staff: { id: string; name: string; phone: string } | null
}

interface Agent {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-blue-500/20 text-blue-400' },
  paid: { label: 'Төлсөн', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

interface CommissionsClientProps {
  initialCommissions: Commission[]
  agents: Agent[]
}

export default function CommissionsClient({ initialCommissions, agents }: CommissionsClientProps) {
  const [commissions, setCommissions] = useState<Commission[]>(initialCommissions)
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [generating, setGenerating] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const loadCommissions = useCallback(async (status?: string, agentId?: string) => {
    const params = new URLSearchParams({ limit: '100' })
    if (status) params.set('status', status)
    if (agentId) params.set('agent_id', agentId)

    const res = await fetch(`/api/commissions?${params}`)
    if (res.ok) {
      const data = await res.json()
      setCommissions(data.data || [])
    }
  }, [])

  useEffect(() => {
    loadCommissions()
  }, [loadCommissions])

  async function handleFilterChange(newStatus: string, newAgent: string) {
    await loadCommissions(newStatus, newAgent)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/commissions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.generated > 0) {
          await loadCommissions(statusFilter, agentFilter)
        }
        alert(`${data.generated} комисс үүсгэлээ`)
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleStatusChange(commissionId: string, newStatus: string) {
    setUpdating(commissionId)
    try {
      const res = await fetch(`/api/commissions/${commissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) await loadCommissions(statusFilter, agentFilter)
    } finally {
      setUpdating(null)
    }
  }

  function exportToExcel() {
    const rows = commissions.map(c => ({
      'Агент': c.staff?.name || '-',
      'Хэлцэл': c.deals?.deal_number || '-',
      'Зар': c.deals?.products?.name || '-',
      'Эцсийн үнэ': c.deals?.final_price || 0,
      'Комисс': c.commission_amount,
      'Агентын хувь': c.agent_share,
      'Компанийн хувь': c.company_share,
      'Төлөв': STATUS_CONFIG[c.status]?.label || c.status,
      'Огноо': new Date(c.created_at).toLocaleDateString('mn-MN'),
    }))
    exportToFile(rows, `commissions_${new Date().toISOString().split('T')[0]}`, 'xlsx', 'Комисс')
  }

  // Summary calculations
  const pendingTotal = useMemo(() => commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.agent_share, 0), [commissions])
  const approvedTotal = useMemo(() => commissions.filter(c => c.status === 'approved').reduce((s, c) => s + c.agent_share, 0), [commissions])
  const paidTotal = useMemo(() => commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.agent_share, 0), [commissions])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Агентын комисс</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 text-sm bg-white/[0.06] text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Excel татах
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Тооцоолж байна...' : 'Автомат тооцоолох'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-sm text-yellow-400">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(pendingTotal)}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-sm text-blue-400">Зөвшөөрсөн</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(approvedTotal)}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-sm text-green-400">Төлсөн</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(paidTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={agentFilter}
          onChange={e => { setAgentFilter(e.target.value); handleFilterChange(statusFilter, e.target.value) }}
          className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">Бүх агент</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); handleFilterChange(e.target.value, agentFilter) }}
          className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">Бүх төлөв</option>
          <option value="pending">Хүлээгдэж буй</option>
          <option value="approved">Зөвшөөрсөн</option>
          <option value="paid">Төлсөн</option>
          <option value="cancelled">Цуцлагдсан</option>
        </select>
      </div>

      {/* Commissions Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Агент</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Хэлцэл</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Зар</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Комисс</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Агентын хувь</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Компанийн хувь</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төлөв</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map(c => (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.08]/20 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{c.staff?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.deals ? (
                      <a href={`/dashboard/deals/${c.deals.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-xs">
                        {c.deals.deal_number}
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{c.deals?.products?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-white text-right">{formatPrice(c.commission_amount)}</td>
                  <td className="px-4 py-3 text-sm text-purple-400 text-right">{formatPrice(c.agent_share)}</td>
                  <td className="px-4 py-3 text-sm text-orange-400 text-right">{formatPrice(c.company_share)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${STATUS_CONFIG[c.status]?.color}`}>
                      {STATUS_CONFIG[c.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {c.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(c.id, 'approved')}
                          disabled={updating === c.id}
                          className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 disabled:opacity-50"
                        >
                          Зөвшөөрөх
                        </button>
                      )}
                      {c.status === 'approved' && (
                        <button
                          onClick={() => handleStatusChange(c.id, 'paid')}
                          disabled={updating === c.id}
                          className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50"
                        >
                          Төлсөн
                        </button>
                      )}
                      {(c.status === 'pending' || c.status === 'approved') && (
                        <button
                          onClick={() => handleStatusChange(c.id, 'cancelled')}
                          disabled={updating === c.id}
                          className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 disabled:opacity-50"
                        >
                          Цуцлах
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Комисс олдсонгүй
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
