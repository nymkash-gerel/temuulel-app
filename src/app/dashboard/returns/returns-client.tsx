'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/format'

interface ReturnRequest {
  id: string
  return_number: string
  return_type: 'full' | 'partial'
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  reason: string | null
  refund_amount: number | null
  handled_by: string | null
  created_at: string
  orders: { id: string; order_number: string; total_amount: number } | null
  customers: { id: string; name: string | null; phone: string | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:   { label: 'Хүлээгдэж буй', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-l-yellow-500' },
  approved:  { label: 'Зөвшөөрсөн',   dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-l-blue-500' },
  rejected:  { label: 'Татгалзсан',    dot: 'bg-red-400',    bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-l-red-500' },
  completed: { label: 'Дууссан',        dot: 'bg-emerald-400',bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-l-emerald-500' },
}

interface ReturnsClientProps {
  initialReturns: ReturnRequest[]
}

export default function ReturnsClient({ initialReturns }: ReturnsClientProps) {
  const [returns] = useState<ReturnRequest[]>(initialReturns)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    let result = returns
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r =>
        r.return_number.toLowerCase().includes(q) ||
        r.orders?.order_number?.toLowerCase().includes(q) ||
        r.customers?.name?.toLowerCase().includes(q) ||
        r.customers?.phone?.includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter)
    }
    return result
  }, [returns, search, statusFilter])

  const totalRefunded = returns.filter(r => r.status === 'completed' && r.refund_amount).reduce((s, r) => s + (r.refund_amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Буцаалт</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Нийт {returns.length} буцаалт
            {filtered.length !== returns.length && ` · ${filtered.length} илэрц`}
          </p>
        </div>
        <Link href="/dashboard/orders" className="px-3.5 py-2 text-sm bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 rounded-xl transition-all">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
            Захиалга
          </span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Хүлээгдэж буй', value: returns.filter(r => r.status === 'pending').length, gradient: 'from-yellow-500/20 to-yellow-600/5' },
          { label: 'Зөвшөөрсөн', value: returns.filter(r => r.status === 'approved').length, gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Дууссан', value: returns.filter(r => r.status === 'completed').length, gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Татгалзсан', value: returns.filter(r => r.status === 'rejected').length, gradient: 'from-red-500/20 to-red-600/5' },
          { label: 'Буцаасан дүн', value: null, display: formatPrice(totalRefunded), gradient: 'from-purple-500/20 to-purple-600/5' },
        ].map((stat) => (
          <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1.5 relative">
              {stat.value !== null ? stat.value : stat.display}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Дугаар, захиалга, харилцагч хайх..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]"
        >
          <option value="">Бүх төлөв</option>
          <option value="pending">Хүлээгдэж буй</option>
          <option value="approved">Зөвшөөрсөн</option>
          <option value="rejected">Татгалзсан</option>
          <option value="completed">Дууссан</option>
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter('') }}
            className="px-3 py-2.5 text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Returns Table */}
      {filtered.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(100px,1fr)_minmax(90px,0.8fr)_minmax(100px,1fr)_minmax(70px,0.6fr)_minmax(80px,0.7fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(60px,0.5fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Буцаалт</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Захиалга</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Харилцагч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төрөл</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Буцаах дүн</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төлөв</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Огноо</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Үйлдэл</p>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((ret) => {
              const sc = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending
              return (
                <div key={ret.id}>
                  {/* Desktop Row */}
                  <div className={`hidden md:grid grid-cols-[minmax(100px,1fr)_minmax(90px,0.8fr)_minmax(100px,1fr)_minmax(70px,0.6fr)_minmax(80px,0.7fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(60px,0.5fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors group border-l-2 ${sc.border}`}>
                    <div>
                      <Link href={`/dashboard/returns/${ret.id}`} className="text-white text-sm font-medium hover:text-blue-400 transition-colors">
                        #{ret.return_number}
                      </Link>
                    </div>
                    <div>
                      {ret.orders ? (
                        <Link href={`/dashboard/orders/${ret.orders.id}`} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                          #{ret.orders.order_number}
                        </Link>
                      ) : <span className="text-slate-600 text-sm">—</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-300 text-sm truncate">{ret.customers?.name || '—'}</p>
                      {ret.customers?.phone && <p className="text-slate-600 text-[11px]">{ret.customers.phone}</p>}
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        ret.return_type === 'full' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'
                      }`}>
                        {ret.return_type === 'full' ? 'Бүтэн' : 'Хэсэгчилсэн'}
                      </span>
                    </div>
                    <div>
                      <span className="text-white text-sm font-medium">
                        {ret.refund_amount ? formatPrice(ret.refund_amount) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">
                        {new Date(ret.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-right">
                      <Link
                        href={`/dashboard/returns/${ret.id}`}
                        className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all inline-flex opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </Link>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className={`md:hidden px-4 py-3 border-l-2 ${sc.border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/returns/${ret.id}`} className="text-white text-sm font-medium hover:text-blue-400 transition-colors">
                          #{ret.return_number}
                        </Link>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </div>
                      <span className="text-white text-sm font-medium">{ret.refund_amount ? formatPrice(ret.refund_amount) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-slate-500">
                        <span>{ret.customers?.name || '—'}</span>
                        {ret.orders && (
                          <Link href={`/dashboard/orders/${ret.orders.id}`} className="text-blue-400/70">#{ret.orders.order_number}</Link>
                        )}
                      </div>
                      <span className="text-slate-600">{new Date(ret.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
            <span className="text-slate-600 text-xs">{filtered.length} буцаалт</span>
          </div>
        </div>
      ) : returns.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <p className="text-slate-500">Хайлтад тохирох буцаалт олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Буцаалт байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Захиалгын буцаалт хүсэлт ирэхэд энд харагдана
          </p>
        </div>
      )}
    </div>
  )
}
