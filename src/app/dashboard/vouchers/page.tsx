'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveStoreId } from '@/lib/resolve-store'

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending_approval: { label: 'Зөвшөөрөл хүлээж буй', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  rejected: { label: 'Татгалзсан', color: 'bg-red-500/20 text-red-400', icon: '❌' },
  redeemed: { label: 'Ашигласан', color: 'bg-blue-500/20 text-blue-400', icon: '🎉' },
  expired: { label: 'Хугацаа дууссан', color: 'bg-slate-500/20 text-slate-400', icon: '⌛' },
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

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
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

export default function VouchersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const storeId = await resolveStoreId(supabase, user.id)
      const store = storeId ? { id: storeId } : null

      if (store) {
        const { data } = await supabase
          .from('vouchers')
          .select(`
            id, voucher_code, compensation_type, compensation_value, max_discount_amount,
            complaint_category, complaint_summary, status, approved_by,
            valid_until, redeemed_at, created_at,
            customers(id, name, phone),
            compensation_policies(id, name)
          `)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })

        if (data) {
          // Mark expired on-the-fly
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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Нөхөн олговор</h1>
          <p className="text-slate-400 mt-1">
            Нийт {vouchers.length} хөнгөлөлтийн эрх
            {filtered.length !== vouchers.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/settings/compensation"
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all inline-flex items-center gap-2"
        >
          ⚙️ Бодлого тохируулах
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Код, харилцагч, гомдлоор хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="pending_approval">Зөвшөөрөл хүлээж буй</option>
              <option value="approved">Зөвшөөрсөн</option>
              <option value="rejected">Татгалзсан</option>
              <option value="redeemed">Ашигласан</option>
              <option value="expired">Хугацаа дууссан</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.pending}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Зөвшөөрсөн</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.approved}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Ашигласан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.redeemed}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Татгалзсан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.rejected}</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Хугацаа дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.expired}</p>
        </div>
      </div>

      {/* Vouchers Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Код</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Гомдлын ангилал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хөнгөлөлт</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүчинтэй хугацаа</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending_approval
                return (
                  <tr key={v.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-mono text-sm">{v.voucher_code}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white">{v.customers?.name || 'N/A'}</p>
                        <p className="text-slate-400 text-sm">{v.customers?.phone || ''}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {CATEGORY_LABELS[v.complaint_category] || v.complaint_category}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium text-sm">
                        {formatCompensation(v.compensation_type, v.compensation_value, v.max_discount_amount)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {v.valid_until
                          ? new Date(v.valid_until).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(v.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/dashboard/vouchers/${v.id}`}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all inline-block"
                      >
                        👁️
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : vouchers.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох хөнгөлөлтийн эрх олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎫</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Хөнгөлөлтийн эрх байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Гомдол ирэхэд AI ангилж, тохирох нөхөн олговор автоматаар үүсгэнэ.
            Эхлээд бодлого тохируулна уу.
          </p>
          <Link
            href="/dashboard/settings/compensation"
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all inline-block"
          >
            Бодлого тохируулах
          </Link>
        </div>
      )}
    </div>
  )
}
