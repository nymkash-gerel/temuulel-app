'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToFile } from '@/lib/export-utils'
import { formatPrice } from '@/lib/format'

interface Payout {
  id: string
  driver_id: string
  period_start: string
  period_end: string
  total_amount: number
  delivery_count: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paid_at: string | null
  notes: string | null
  created_at: string
  delivery_drivers: { id: string; name: string; phone: string } | null
}

interface Driver {
  id: string
  name: string
  phone: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:   { label: 'Хүлээгдэж буй', dot: 'bg-amber-400',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-l-amber-500' },
  approved:  { label: 'Зөвшөөрсөн',    dot: 'bg-blue-400',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-l-blue-500' },
  paid:      { label: 'Төлсөн',         dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-l-emerald-500' },
  cancelled: { label: 'Цуцлагдсан',     dot: 'bg-red-400',     bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-l-red-500' },
}

interface DriverPayoutsClientProps {
  initialStoreId: string
}

export default function DriverPayoutsClient({ initialStoreId }: DriverPayoutsClientProps) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Generate form state
  const [genStart, setGenStart] = useState('')
  const [genEnd, setGenEnd] = useState('')

  // Form state
  const [formDriverId, setFormDriverId] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formCount, setFormCount] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    async function load() {
      const [payoutsRes, driversRes] = await Promise.all([
        fetch('/api/driver-payouts'),
        supabase
          .from('delivery_drivers')
          .select('id, name, phone')
          .eq('store_id', initialStoreId)
          .order('name'),
      ])

      if (payoutsRes.ok) {
        const data = await payoutsRes.json()
        setPayouts(data.payouts)
      }
      if (driversRes.data) setDrivers(driversRes.data)

      setLoading(false)
    }
    load()
  }, [supabase, initialStoreId])

  const stats = useMemo(() => {
    const pendingTotal = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.total_amount), 0)
    const approvedTotal = payouts.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.total_amount), 0)
    const paidTotal = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.total_amount), 0)
    const totalDeliveries = payouts.reduce((s, p) => s + p.delivery_count, 0)
    return { pendingTotal, approvedTotal, paidTotal, totalDeliveries }
  }, [payouts])

  const filteredPayouts = useMemo(() => {
    if (!statusFilter) return payouts
    return payouts.filter(p => p.status === statusFilter)
  }, [payouts, statusFilter])

  async function handleCreate() {
    if (!formDriverId || !formStart || !formEnd || !formAmount) return
    setCreating(true)

    try {
      const res = await fetch('/api/driver-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: formDriverId,
          period_start: formStart,
          period_end: formEnd,
          total_amount: Number(formAmount),
          delivery_count: Number(formCount) || 0,
          notes: formNotes.trim() || undefined,
        }),
      })

      if (res.ok) {
        const { payout } = await res.json()
        const driver = drivers.find(d => d.id === formDriverId)
        setPayouts(prev => [{
          ...payout,
          delivery_drivers: driver ? { id: driver.id, name: driver.name, phone: driver.phone } : null,
        }, ...prev])
        setShowForm(false)
        setFormDriverId(''); setFormStart(''); setFormEnd(''); setFormAmount(''); setFormCount(''); setFormNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
  }

  async function handleStatusUpdate(payoutId: string, newStatus: string) {
    setUpdating(payoutId)
    try {
      const res = await fetch(`/api/driver-payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const { payout } = await res.json()
        setPayouts(prev => prev.map(p =>
          p.id === payoutId ? { ...p, ...payout } : p
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setUpdating(null)
    }
  }

  async function handleGenerate() {
    if (!genStart || !genEnd) return
    setGenerating(true)
    try {
      const res = await fetch('/api/driver-payouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_start: genStart, period_end: genEnd }),
      })
      const data = await res.json()
      if (data.payouts && data.payouts.length > 0) {
        setPayouts(prev => [...data.payouts, ...prev])
        setShowGenerate(false)
        setGenStart(''); setGenEnd('')
        alert(`${data.created_count} төлбөр амжилттай үүсгэлээ${data.skipped_count > 0 ? ` (${data.skipped_count} давхардсан)` : ''}`)
      } else {
        alert(data.message || data.error || 'Хүргэгдсэн захиалга олдсонгүй')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filteredPayouts.map(p => ({
      'Жолооч': p.delivery_drivers?.name || '',
      'Эхлэх огноо': new Date(p.period_start).toLocaleDateString('mn-MN'),
      'Дуусах огноо': new Date(p.period_end).toLocaleDateString('mn-MN'),
      'Хүргэлт тоо': p.delivery_count,
      'Нийт дүн': Number(p.total_amount),
      'Төлөв': STATUS_CONFIG[p.status]?.label || p.status,
    }))
    exportToFile(data, 'joloochiin-tolbor', format, 'Жолоочийн төлбөр')
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Ачааллаж байна...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Жолоочийн төлбөр</h1>
          <p className="text-slate-500 mt-1 text-sm">Нийт {payouts.length} төлбөр</p>
        </div>
        <div className="flex items-center gap-2">
          {payouts.length > 0 && (
            <div className="relative group">
              <button className="px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-400 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-[#141520] border border-white/[0.1] rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px] shadow-xl">
                <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">Excel</button>
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">CSV</button>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowGenerate(true)}
            className="px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-amber-500/20"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
              Автомат
            </span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Төлбөр нэмэх
            </span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Хүлээгдэж буй', display: formatPrice(stats.pendingTotal), gradient: 'from-amber-500/20 to-amber-600/5' },
          { label: 'Зөвшөөрсөн', display: formatPrice(stats.approvedTotal), gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Төлсөн (нийт)', display: formatPrice(stats.paidTotal), gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Нийт хүргэлт', display: stats.totalDeliveries.toLocaleString(), gradient: 'from-slate-500/20 to-slate-600/5' },
        ].map((stat) => (
          <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1.5 relative">{stat.display}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]"
        >
          <option value="">Бүх төлөв</option>
          <option value="pending">Хүлээгдэж буй</option>
          <option value="approved">Зөвшөөрсөн</option>
          <option value="paid">Төлсөн</option>
          <option value="cancelled">Цуцлагдсан</option>
        </select>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')}
            className="px-3 py-2.5 text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-[#141520] border border-white/[0.08] rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ төлбөр</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Жолооч *</label>
                <select value={formDriverId} onChange={(e) => setFormDriverId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.15]">
                  <option value="">Жолооч сонгох...</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Эхлэх огноо *</label>
                  <input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.15]" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Дуусах огноо *</label>
                  <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.15]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Нийт дүн *</label>
                  <input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="50000"
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/[0.15]" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Хүргэлтийн тоо</label>
                  <input type="number" value={formCount} onChange={(e) => setFormCount(e.target.value)} placeholder="25"
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/[0.15]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Тэмдэглэл</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Нэмэлт мэдээлэл..."
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/[0.15] resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl transition-all text-sm">Цуцлах</button>
              <button onClick={handleCreate} disabled={creating || !formDriverId || !formStart || !formEnd || !formAmount}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all disabled:opacity-40 text-sm">
                {creating ? 'Үүсгэж байна...' : 'Төлбөр үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGenerate(false)}>
          <div className="bg-[#141520] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2">Автомат тооцоолох</h2>
            <p className="text-slate-500 text-sm mb-4">Хугацааны хүрээнд хүргэгдсэн захиалгаар жолооч бүрийн төлбөрийг автомат тооцоолно.</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Эхлэх огноо *</label>
                <input type="date" value={genStart} onChange={(e) => setGenStart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.15]" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Дуусах огноо *</label>
                <input type="date" value={genEnd} onChange={(e) => setGenEnd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.15]" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowGenerate(false)} className="flex-1 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl transition-all text-sm">Цуцлах</button>
              <button onClick={handleGenerate} disabled={generating || !genStart || !genEnd}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium rounded-xl transition-all disabled:opacity-40 text-sm">
                {generating ? 'Тооцоолж байна...' : 'Тооцоолох'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payouts Table */}
      {filteredPayouts.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(120px,1.2fr)_minmax(140px,1.3fr)_minmax(80px,0.8fr)_minmax(60px,0.5fr)_minmax(100px,1fr)_minmax(100px,1fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Жолооч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Хугацаа</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Дүн</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-center">Хүргэлт</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төлөв</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Үйлдэл</p>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/[0.04]">
            {filteredPayouts.map(p => {
              const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
              const isExpanded = expandedId === p.id

              return (
                <div key={p.id}>
                  {/* Desktop Row */}
                  <div className={`hidden md:grid grid-cols-[minmax(120px,1.2fr)_minmax(140px,1.3fr)_minmax(80px,0.8fr)_minmax(60px,0.5fr)_minmax(100px,1fr)_minmax(100px,1fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors border-l-2 ${sc.border}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500/30 to-blue-500/30 rounded-lg flex items-center justify-center shrink-0 border border-white/[0.08]">
                        <span className="text-white text-xs font-semibold">{p.delivery_drivers?.name?.charAt(0) || '?'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{p.delivery_drivers?.name || '—'}</p>
                        <p className="text-slate-600 text-[10px]">{p.delivery_drivers?.phone || ''}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs">
                        {new Date(p.period_start).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })} — {new Date(p.period_end).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white text-sm font-semibold">{formatPrice(Number(p.total_amount))}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-400 text-sm">{p.delivery_count}</span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      {p.paid_at && <p className="text-slate-600 text-[10px] mt-0.5">{new Date(p.paid_at).toLocaleDateString('mn-MN')}</p>}
                    </div>
                    <div className="flex gap-1.5 justify-end">
                      {p.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatusUpdate(p.id, 'approved')} disabled={updating === p.id}
                            className="px-2.5 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all disabled:opacity-40 font-medium">
                            Зөвшөөрөх
                          </button>
                          <button onClick={() => handleStatusUpdate(p.id, 'cancelled')} disabled={updating === p.id}
                            className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all disabled:opacity-40 font-medium">
                            Цуцлах
                          </button>
                        </>
                      )}
                      {p.status === 'approved' && (
                        <button onClick={() => handleStatusUpdate(p.id, 'paid')} disabled={updating === p.id}
                          className="px-2.5 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all disabled:opacity-40 font-medium">
                          Төлсөн
                        </button>
                      )}
                      {['paid', 'cancelled'].includes(p.status) && (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className={`md:hidden border-l-2 ${sc.border}`}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500/30 to-blue-500/30 rounded-lg flex items-center justify-center shrink-0 border border-white/[0.08]">
                        <span className="text-white text-xs font-semibold">{p.delivery_drivers?.name?.charAt(0) || '?'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{p.delivery_drivers?.name || '—'}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-slate-600 text-xs mt-0.5">
                          {new Date(p.period_start).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })} — {new Date(p.period_end).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <span className="text-white text-sm font-semibold shrink-0">{formatPrice(Number(p.total_amount))}</span>
                      <svg className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2 bg-white/[0.02]">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Хүргэлт</p>
                            <p className="text-white">{p.delivery_count}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Утас</p>
                            <p className="text-slate-400">{p.delivery_drivers?.phone || '—'}</p>
                          </div>
                        </div>
                        {p.notes && <p className="text-slate-500 text-xs">{p.notes}</p>}
                        <div className="flex items-center gap-2 pt-1">
                          {p.status === 'pending' && (
                            <>
                              <button onClick={() => handleStatusUpdate(p.id, 'approved')} disabled={updating === p.id}
                                className="flex-1 py-2 text-center text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-all font-medium disabled:opacity-40">
                                Зөвшөөрөх
                              </button>
                              <button onClick={() => handleStatusUpdate(p.id, 'cancelled')} disabled={updating === p.id}
                                className="flex-1 py-2 text-center text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all font-medium disabled:opacity-40">
                                Цуцлах
                              </button>
                            </>
                          )}
                          {p.status === 'approved' && (
                            <button onClick={() => handleStatusUpdate(p.id, 'paid')} disabled={updating === p.id}
                              className="flex-1 py-2 text-center text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all font-medium disabled:opacity-40">
                              Төлсөн гэж тэмдэглэх
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
            <span className="text-slate-600 text-xs">{filteredPayouts.length} төлбөр</span>
          </div>
        </div>
      ) : payouts.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <p className="text-slate-500">Шүүлтүүрт тохирох төлбөр олдсонгүй</p>
          <button onClick={() => setStatusFilter('')} className="mt-4 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all">Шүүлтүүр цэвэрлэх</button>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Төлбөр байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">Жолоочдод төлбөр үүсгэхийн тулд дээрх товчийг дарна уу</p>
        </div>
      )}
    </div>
  )
}
