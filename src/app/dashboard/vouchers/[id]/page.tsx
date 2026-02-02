'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface VoucherDetail {
  id: string
  voucher_code: string
  compensation_type: string
  compensation_value: number
  max_discount_amount: number | null
  complaint_category: string
  complaint_summary: string | null
  status: string
  approved_by: string | null
  approved_by_user_id: string | null
  admin_notes: string | null
  valid_until: string | null
  redeemed_at: string | null
  redeemed_order_id: string | null
  conversation_id: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null; phone: string | null; email: string | null } | null
  compensation_policies: { id: string; name: string; complaint_category: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'Зөвшөөрөл хүлээж буй', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  approved: { label: 'Зөвшөөрсөн', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
  rejected: { label: 'Татгалзсан', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  redeemed: { label: 'Ашигласан', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  expired: { label: 'Хугацаа дууссан', color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' },
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

const COMP_TYPE_LABELS: Record<string, string> = {
  percent_discount: 'Хувийн хөнгөлөлт',
  fixed_discount: 'Тогтмол хөнгөлөлт',
  free_shipping: 'Үнэгүй хүргэлт',
  free_item: 'Үнэгүй бараа',
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function VoucherDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [approvedBy, setApprovedBy] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }

      const { data } = await supabase
        .from('vouchers')
        .select(`
          *,
          customers(id, name, phone, email),
          compensation_policies(id, name, complaint_category)
        `)
        .eq('id', id)
        .eq('store_id', store.id)
        .single()

      if (!data) { router.push('/dashboard/vouchers'); return }

      // Check expired on-the-fly
      const now = new Date().toISOString()
      if (data.status === 'approved' && data.valid_until && data.valid_until < now) {
        data.status = 'expired'
      }

      setVoucher(data as unknown as VoucherDetail)
      setLoading(false)
    }
    load()
  }, [supabase, router, id])

  async function handleAction(status: 'approved' | 'rejected' | 'redeemed') {
    if (!voucher) return
    setActionLoading(true)

    try {
      const res = await fetch(`/api/vouchers/${voucher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          approved_by: approvedBy || undefined,
          admin_notes: adminNotes || undefined,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setVoucher(prev => prev ? { ...prev, ...updated } : prev)
        setAdminNotes('')
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!voucher) return null

  const sc = STATUS_CONFIG[voucher.status] || STATUS_CONFIG.pending_approval
  const isPending = voucher.status === 'pending_approval'
  const isApproved = voucher.status === 'approved'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/vouchers"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white font-mono">{voucher.voucher_code}</h1>
          <p className="text-slate-400 mt-1">
            {CATEGORY_LABELS[voucher.complaint_category] || voucher.complaint_category}
          </p>
        </div>
        <span className={`px-4 py-2 rounded-xl text-sm font-medium border ${sc.bg} ${sc.color}`}>
          {sc.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Compensation Details */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Хөнгөлөлтийн мэдээлэл</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Төрөл</p>
                <p className="text-white mt-1">{COMP_TYPE_LABELS[voucher.compensation_type] || voucher.compensation_type}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Дүн</p>
                <p className="text-white mt-1 text-lg font-bold">
                  {voucher.compensation_type === 'percent_discount'
                    ? `${voucher.compensation_value}%`
                    : voucher.compensation_type === 'fixed_discount'
                      ? formatPrice(voucher.compensation_value)
                      : '-'}
                </p>
              </div>
              {voucher.max_discount_amount && (
                <div>
                  <p className="text-slate-400 text-sm">Дээд хязгаар</p>
                  <p className="text-white mt-1">{formatPrice(voucher.max_discount_amount)}</p>
                </div>
              )}
              <div>
                <p className="text-slate-400 text-sm">Хүчинтэй хугацаа</p>
                <p className="text-white mt-1">
                  {voucher.valid_until
                    ? new Date(voucher.valid_until).toLocaleDateString('mn-MN', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Complaint Info */}
          {voucher.complaint_summary && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Гомдлын мэдээлэл</h2>
              <div className="mb-4">
                <p className="text-slate-400 text-sm mb-1">Ангилал</p>
                <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">
                  {CATEGORY_LABELS[voucher.complaint_category] || voucher.complaint_category}
                </span>
              </div>
              <div>
                <p className="text-slate-400 text-sm mb-1">Товч тайлбар</p>
                <p className="text-white leading-relaxed">{voucher.complaint_summary}</p>
              </div>
              {voucher.conversation_id && (
                <Link
                  href={`/dashboard/chat/${voucher.conversation_id}`}
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
                >
                  💬 Чат харах
                </Link>
              )}
            </div>
          )}

          {/* Actions */}
          {(isPending || isApproved) && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үйлдэл</h2>

              {isPending && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Зөвшөөрсөн хүн</label>
                    <input
                      type="text"
                      value={approvedBy}
                      onChange={(e) => setApprovedBy(e.target.value)}
                      placeholder="Нэр оруулах..."
                      className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Тэмдэглэл</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Нэмэлт тэмдэглэл..."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleAction('approved')}
                      disabled={actionLoading}
                      className="px-6 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    >
                      {actionLoading ? '...' : '✅ Зөвшөөрөх'}
                    </button>
                    <button
                      onClick={() => handleAction('rejected')}
                      disabled={actionLoading}
                      className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    >
                      {actionLoading ? '...' : '❌ Татгалзах'}
                    </button>
                  </div>
                </div>
              )}

              {isApproved && (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <p className="text-blue-400 text-sm">
                      Энэ хөнгөлөлтийн эрх зөвшөөрөгдсөн. Харилцагч ашиглахад &ldquo;Ашигласан&rdquo; гэж тэмдэглэнэ үү.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAction('redeemed')}
                    disabled={actionLoading}
                    className="px-6 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {actionLoading ? '...' : '🎉 Ашигласан гэж тэмдэглэх'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Харилцагч</h3>
            <p className="text-white font-medium">{voucher.customers?.name || 'N/A'}</p>
            {voucher.customers?.phone && (
              <p className="text-slate-400 text-sm mt-1">{voucher.customers.phone}</p>
            )}
            {voucher.customers?.email && (
              <p className="text-slate-400 text-sm mt-1">{voucher.customers.email}</p>
            )}
            {voucher.customers?.id && (
              <Link
                href={`/dashboard/customers/${voucher.customers.id}`}
                className="inline-block mt-3 text-blue-400 hover:text-blue-300 text-sm transition-all"
              >
                Дэлгэрэнгүй →
              </Link>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Түүх</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-slate-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="text-white text-sm">Үүсгэсэн</p>
                  <p className="text-slate-400 text-xs">
                    {new Date(voucher.created_at).toLocaleString('mn-MN')}
                  </p>
                </div>
              </div>
              {voucher.approved_by && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm">Зөвшөөрсөн: {voucher.approved_by}</p>
                    <p className="text-slate-400 text-xs">
                      {new Date(voucher.updated_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                </div>
              )}
              {voucher.status === 'rejected' && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm">Татгалзсан</p>
                    <p className="text-slate-400 text-xs">
                      {new Date(voucher.updated_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                </div>
              )}
              {voucher.redeemed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm">Ашигласан</p>
                    <p className="text-slate-400 text-xs">
                      {new Date(voucher.redeemed_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin Notes */}
          {voucher.admin_notes && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Тэмдэглэл</h3>
              <p className="text-white text-sm leading-relaxed">{voucher.admin_notes}</p>
            </div>
          )}

          {/* Policy Info */}
          {voucher.compensation_policies && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Бодлого</h3>
              <p className="text-white text-sm">{voucher.compensation_policies.name}</p>
              <Link
                href="/dashboard/settings/compensation"
                className="inline-block mt-3 text-blue-400 hover:text-blue-300 text-sm transition-all"
              >
                Бодлого тохиргоо →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
