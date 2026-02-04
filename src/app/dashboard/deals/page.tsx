'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import * as XLSX from 'xlsx'

interface Deal {
  id: string
  deal_number: string
  status: string
  deal_type: string
  asking_price: number | null
  offer_price: number | null
  final_price: number | null
  commission_rate: number | null
  commission_amount: number | null
  agent_share_amount: number | null
  company_share_amount: number | null
  notes: string | null
  created_at: string
  products: { id: string; name: string; images: string[] | null; base_price: number } | null
  customers: { id: string; name: string; phone: string } | null
  staff: { id: string; name: string; phone: string } | null
}

interface Agent {
  id: string
  name: string
}

interface Property {
  id: string
  name: string
  base_price: number
}

interface Customer {
  id: string
  name: string | null
  phone: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Лийд', color: 'bg-slate-500/20 text-slate-400' },
  viewing: { label: 'Үзүүлэлт', color: 'bg-blue-500/20 text-blue-400' },
  offer: { label: 'Санал', color: 'bg-purple-500/20 text-purple-400' },
  contract: { label: 'Гэрээ', color: 'bg-orange-500/20 text-orange-400' },
  closed: { label: 'Хаагдсан', color: 'bg-green-500/20 text-green-400' },
  withdrawn: { label: 'Татгалзсан', color: 'bg-yellow-500/20 text-yellow-400' },
  lost: { label: 'Алдагдсан', color: 'bg-red-500/20 text-red-400' },
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  sale: 'Худалдаа',
  rent: 'Түрээс',
  lease: 'Лийз',
}

const STATUS_TABS = [
  { key: '', label: 'Бүгд' },
  { key: 'lead', label: 'Лийд' },
  { key: 'viewing', label: 'Үзүүлэлт' },
  { key: 'offer', label: 'Санал' },
  { key: 'contract', label: 'Гэрээ' },
  { key: 'closed', label: 'Хаагдсан' },
  { key: 'lost', label: 'Алдагдсан' },
]

function formatPrice(amount: number | null) {
  if (!amount) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function DealsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<Deal[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formPropertyId, setFormPropertyId] = useState('')
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formAgentId, setFormAgentId] = useState('')
  const [formDealType, setFormDealType] = useState('sale')
  const [formAskingPrice, setFormAskingPrice] = useState('')
  const [formCommissionRate, setFormCommissionRate] = useState('5')
  const [formAgentShareRate, setFormAgentShareRate] = useState('50')
  const [formNotes, setFormNotes] = useState('')

  const loadDeals = useCallback(async (status?: string) => {
    const url = status ? `/api/deals?status=${status}&limit=100` : '/api/deals?limit=100'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setDeals(data.data || [])
    }
  }, [])

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

      const [, agentsRes, propertiesRes, customersRes] = await Promise.all([
        loadDeals(),
        supabase.from('staff').select('id, name').eq('store_id', store.id).eq('status', 'active').order('name'),
        supabase.from('products').select('id, name, base_price').eq('store_id', store.id).eq('status', 'active').order('name'),
        supabase.from('customers').select('id, name, phone').eq('store_id', store.id).order('name'),
      ])

      if (agentsRes.data) setAgents(agentsRes.data)
      if (propertiesRes.data) setProperties(propertiesRes.data)
      if (customersRes.data) setCustomers(customersRes.data)

      setLoading(false)
    }
    load()
  }, [supabase, loadDeals])

  async function handleStatusFilter(status: string) {
    setStatusFilter(status)
    await loadDeals(status || undefined)
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: formPropertyId || null,
          customer_id: formCustomerId || null,
          agent_id: formAgentId || null,
          deal_type: formDealType,
          asking_price: formAskingPrice ? Number(formAskingPrice) : null,
          commission_rate: Number(formCommissionRate),
          agent_share_rate: Number(formAgentShareRate),
          notes: formNotes || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        setFormPropertyId('')
        setFormCustomerId('')
        setFormAgentId('')
        setFormDealType('sale')
        setFormAskingPrice('')
        setFormCommissionRate('5')
        setFormAgentShareRate('50')
        setFormNotes('')
        await loadDeals(statusFilter || undefined)
      }
    } finally {
      setCreating(false)
    }
  }

  function exportToExcel() {
    const rows = deals.map(d => ({
      'Дугаар': d.deal_number,
      'Төлөв': STATUS_CONFIG[d.status]?.label || d.status,
      'Төрөл': DEAL_TYPE_LABELS[d.deal_type] || d.deal_type,
      'Зар': d.products?.name || '-',
      'Үйлчлүүлэгч': d.customers?.name || '-',
      'Агент': d.staff?.name || '-',
      'Үнэ': d.asking_price || 0,
      'Санал': d.offer_price || 0,
      'Эцсийн': d.final_price || 0,
      'Комисс': d.commission_amount || 0,
      'Огноо': new Date(d.created_at).toLocaleDateString('mn-MN'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Хэлцэлүүд')
    XLSX.writeFile(wb, `deals_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // KPI calculations
  const activeDeals = deals.filter(d => !['closed', 'withdrawn', 'lost'].includes(d.status)).length
  const closedDeals = deals.filter(d => d.status === 'closed').length
  const totalCommission = deals.filter(d => d.status === 'closed').reduce((sum, d) => sum + (d.commission_amount || 0), 0)
  const pendingCommissions = deals.filter(d => d.status === 'closed' && d.commission_amount).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Хэлцэлүүд</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Excel татах
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            + Шинэ хэлцэл
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Идэвхтэй хэлцэл</p>
          <p className="text-2xl font-bold text-white mt-1">{activeDeals}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Хаагдсан хэлцэл</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{closedDeals}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Нийт комисс</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{formatPrice(totalCommission)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Хүлээгдэж буй комисс</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{pendingCommissions}</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Deals Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Дугаар</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Зар</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Үйлчлүүлэгч</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Агент</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төрөл</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Үнэ</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төлөв</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => (
                <tr key={deal.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/deals/${deal.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-sm">
                      {deal.deal_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">{deal.products?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{deal.customers?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{deal.staff?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{DEAL_TYPE_LABELS[deal.deal_type] || deal.deal_type}</td>
                  <td className="px-4 py-3 text-sm text-white text-right">{formatPrice(deal.final_price || deal.offer_price || deal.asking_price)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${STATUS_CONFIG[deal.status]?.color || 'bg-slate-500/20 text-slate-400'}`}>
                      {STATUS_CONFIG[deal.status]?.label || deal.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{new Date(deal.created_at).toLocaleDateString('mn-MN')}</td>
                </tr>
              ))}
              {deals.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Хэлцэл олдсонгүй
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Deal Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ хэлцэл</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Зар (үл хөдлөх)</label>
              <select value={formPropertyId} onChange={e => setFormPropertyId(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">-- Сонгох --</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.base_price)})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Үйлчлүүлэгч</label>
              <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">-- Сонгох --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Агент</label>
              <select value={formAgentId} onChange={e => setFormAgentId(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">-- Сонгох --</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хэлцэлийн төрөл</label>
                <select value={formDealType} onChange={e => setFormDealType(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="sale">Худалдаа</option>
                  <option value="rent">Түрээс</option>
                  <option value="lease">Лийз</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Үнэ</label>
                <input type="number" value={formAskingPrice} onChange={e => setFormAskingPrice(e.target.value)} placeholder="0" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Комиссын хувь (%)</label>
                <input type="number" value={formCommissionRate} onChange={e => setFormCommissionRate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Агентын хувь (%)</label>
                <input type="number" value={formAgentShareRate} onChange={e => setFormAgentShareRate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
                Болих
              </button>
              <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                {creating ? 'Үүсгэж байна...' : 'Үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
