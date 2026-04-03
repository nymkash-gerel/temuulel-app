'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'

interface Voucher {
  id: string
  voucher_code: string
  compensation_type: string
  compensation_value: number
  max_discount_amount: number | null
  complaint_category: string
  complaint_summary: string | null
  status: string
  approved_by: string | null
  valid_until: string | null
  redeemed_at: string | null
  created_at: string
  customers: { id: string; name: string | null; phone: string | null } | null
  compensation_policies: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending_approval: { label: 'Хүлээгдэж буй', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-l-yellow-500' },
  approved:         { label: 'Зөвшөөрсөн',    dot: 'bg-emerald-400',bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-l-emerald-500' },
  rejected:         { label: 'Татгалзсан',     dot: 'bg-red-400',    bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-l-red-500' },
  redeemed:         { label: 'Ашигласан',       dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-l-blue-500' },
  expired:          { label: 'Хугацаа дууссан', dot: 'bg-slate-400',  bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-l-slate-500' },
}

const CATEGORY_LABELS: Record<string, string> = {
  food_quality: 'Хоолны чанар',
  wrong_item: 'Буруу бараа',
  delivery_delay: 'Хүргэлт удсан',
  service_quality: 'Үйлчилгээний чанар',
  damaged_item: 'Гэмтэлтэй бараа',
  pricing_error: 'Үнийн алдаа',
  staff_behavior: 'Ажилтны зан',
  other: 'Бусад',
}

function formatCompensation(type: string, value: number, maxDiscount: number | null) {
  switch (type) {
    case 'percent_discount':
      return maxDiscount
        ? `${value}% (дээд ${formatPrice(maxDiscount)})`
        : `${value}%`
    case 'fixed_discount':
      return formatPrice(value)
    case 'free_shipping':
      return 'Үнэгүй хүргэлт'
    case 'free_item':
      return 'Үнэгүй бараа'
    default:
      return `${value}`
  }
}

export default function VouchersClient({ storeId }: { storeId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      if (storeId) {
        const { data } = await supabase
          .from('vouchers')
          .select(`
            id, voucher_code, compensation_type, compensation_value, max_discount_amount,
            complaint_category, complaint_summary, status, approved_by,
            valid_until, redeemed_at, created_at,
            customers(id, name, phone),
            compensation_policies(id, name)
          `)
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })

        if (data) {
          const now = new Date().toISOString()
          const processed = data.map(v => {
            if (v.status === 'approved' && v.valid_until && v.valid_until < now) {
              return { ...v, status: 'expired' }
            }
            return v
          })
          setVouchers(processed as unknown as Voucher[])
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = vouchers
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(v =>
        v.voucher_code.toLowerCase().includes(q) ||
        v.customers?.name?.toLowerCase().includes(q) ||
        v.customers?.phone?.includes(q) ||
        v.complaint_summary?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter(v => v.status === statusFilter)
    }
    return result
  }, [vouchers, search, statusFilter])

  const stats = useMemo(() => ({
    pending: vouchers.filter(v => v.status === 'pending_approval').length,
    approved: vouchers.filter(v => v.status === 'approved').length,
    redeemed: vouchers.filter(v => v.status === 'redeemed').length,
    rejected: vouchers.filter(v => v.status === 'rejected').length,
    expired: vouchers.filter(v => v.status === 'expired').length,
  }), [vouchers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Нөхөн олговор</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Нийт {vouchers.length} хөнгөлөлтийн эрх
            {filtered.length !== vouchers.length && ` · ${filtered.length} илэрц`}
          </p>
        </div>
        <Link
          href="/dashboard/settings/compensation"
          className="px-3.5 py-2 text-sm bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 rounded-xl transition-all inline-flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Бодлого тохируулах
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Хүлээгдэж буй', value: stats.pending, gradient: 'from-yellow-500/20 to-yellow-600/5' },
          { label: 'Зөвшөөрсөн', value: stats.approved, gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Ашигласан', value: stats.redeemed, gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Татгалзсан', value: stats.rejected, gradient: 'from-red-500/20 to-red-600/5' },
          { label: 'Хугацаа дууссан', value: stats.expired, gradient: 'from-slate-500/20 to-slate-600/5' },
        ].map((stat) => (
          <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1.5 relative">{stat.value}</p>
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
            placeholder="Код, харилцагч, гомдлоор хайх..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]"
        >
          <option value="">Бүх төлөв</option>
          <option value="pending_approval">Хүлээгдэж буй</option>
          <option value="approved">Зөвшөөрсөн</option>
          <option value="rejected">Татгалзсан</option>
          <option value="redeemed">Ашигласан</option>
          <option value="expired">Хугацаа дууссан</option>
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter('') }}
            className="px-3 py-2.5 text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Vouchers Table */}
      {filtered.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(120px,1.2fr)_minmax(100px,1fr)_minmax(100px,0.9fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(50px,0.4fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Код</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Харилцагч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Гомдлын ангилал</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Хөнгөлөлт</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төлөв</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Хугацаа</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Үйлдэл</p>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((v) => {
              const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending_approval
              const isExpanded = expandedId === v.id
              return (
                <div key={v.id}>
                  {/* Desktop Row */}
                  <div className={`hidden md:grid grid-cols-[minmax(120px,1.2fr)_minmax(100px,1fr)_minmax(100px,0.9fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(50px,0.4fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors group border-l-2 ${sc.border}`}>
                    <div>
                      <Link href={`/dashboard/vouchers/${v.id}`} className="text-white text-sm font-mono font-medium hover:text-blue-400 transition-colors">
                        {v.voucher_code}
                      </Link>
                      <p className="text-slate-600 text-[11px]">{new Date(v.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-300 text-sm truncate">{v.customers?.name || '—'}</p>
                      {v.customers?.phone && <p className="text-slate-600 text-[11px]">{v.customers.phone}</p>}
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">
                        {CATEGORY_LABELS[v.complaint_category] || v.complaint_category}
                      </span>
                    </div>
                    <div>
                      <span className="text-white text-sm font-medium">
                        {formatCompensation(v.compensation_type, v.compensation_value, v.max_discount_amount)}
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
                        {v.valid_until ? new Date(v.valid_until).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <Link
                        href={`/dashboard/vouchers/${v.id}`}
                        className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all inline-flex opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </Link>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left border-l-2 ${sc.border}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono font-medium">{v.voucher_code}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{v.customers?.name || '—'} · {CATEGORY_LABELS[v.complaint_category] || v.complaint_category}</p>
                      </div>
                      <span className="text-white text-sm font-medium shrink-0">{formatCompensation(v.compensation_type, v.compensation_value, v.max_discount_amount)}</span>
                      <svg className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2 bg-white/[0.02]">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Харилцагч</p>
                            <p className="text-slate-300">{v.customers?.name || '—'}</p>
                            {v.customers?.phone && <p className="text-slate-500 text-xs">{v.customers.phone}</p>}
                          </div>
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Хугацаа</p>
                            <p className="text-slate-400 text-sm">{v.valid_until ? new Date(v.valid_until).toLocaleDateString('mn-MN') : '—'}</p>
                          </div>
                        </div>
                        {v.complaint_summary && (
                          <p className="text-slate-500 text-xs bg-white/[0.03] px-3 py-1.5 rounded-lg">{v.complaint_summary}</p>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{new Date(v.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <Link href={`/dashboard/vouchers/${v.id}`} className="text-blue-400 hover:text-blue-300 font-medium">Дэлгэрэнгүй</Link>
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
            <span className="text-slate-600 text-xs">{filtered.length} хөнгөлөлтийн эрх</span>
          </div>
        </div>
      ) : vouchers.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <p className="text-slate-500">Хайлтад тохирох хөнгөлөлтийн эрх олдсонгүй</p>
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
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Хөнгөлөлтийн эрх байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Гомдол ирэхэд AI ангилж, тохирох нөхөн олговор автоматаар үүсгэнэ
          </p>
          <Link
            href="/dashboard/settings/compensation"
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 inline-block"
          >
            Бодлого тохируулах
          </Link>
        </div>
      )}
    </div>
  )
}
