'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'

interface ReturnItem {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  reason: string | null
  order_items: {
    id: string
    variant_label: string | null
    products: { id: string; name: string; images: unknown } | null
    product_variants: {
      size: string | null
      color: string | null
      products: { id: string; name: string; images: unknown } | null
    } | null
  } | null
}

interface ReturnRequest {
  id: string
  return_number: string
  return_type: 'full' | 'partial'
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  reason: string | null
  refund_amount: number | null
  refund_method: string | null
  handled_by: string | null
  handled_by_user_id: string | null
  admin_notes: string | null
  approved_at: string | null
  completed_at: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
  orders: {
    id: string
    order_number: string
    total_amount: number
    status: string
    payment_status: string
  } | null
  customers: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
  } | null
  return_items: ReturnItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '⏳' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '✅' },
  rejected: { label: 'Татгалзсан', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '❌' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '✓' },
}

const REFUND_METHOD_LABELS: Record<string, string> = {
  qpay: 'QPay',
  bank: 'Дансаар',
  cash: 'Бэлэн',
  original: 'Анхны хэлбэрээр',
}


export default function ReturnDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const returnId = params.id as string

  const [returnReq, setReturnReq] = useState<ReturnRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [handledBy, setHandledBy] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch(`/api/returns/${returnId}`)
      if (!res.ok) {
        router.push('/dashboard/returns')
        return
      }

      const data = await res.json()
      setReturnReq(data)
      setHandledBy(data.handled_by || '')
      setAdminNotes(data.admin_notes || '')
      setRefundAmount(data.refund_amount ? String(data.refund_amount) : '')
      setRefundMethod(data.refund_method || '')
      setLoading(false)
    }
    load()
  }, [returnId, supabase, router])

  async function handleAction(status: 'approved' | 'rejected' | 'completed') {
    if (!returnReq) return

    const confirmMsg: Record<string, string> = {
      approved: 'Буцаалтыг зөвшөөрөх үү?',
      rejected: 'Буцаалтыг татгалзах уу?',
      completed: 'Буцаалт дуусгах уу? Захиалгын төлбөр "буцаасан" болно.',
    }

    if (!confirm(confirmMsg[status])) return

    setActionLoading(true)

    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          handled_by: handledBy || undefined,
          refund_amount: refundAmount ? Number(refundAmount) : undefined,
          refund_method: refundMethod || undefined,
          admin_notes: adminNotes || undefined,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setReturnReq({
          ...returnReq,
          ...updated,
          orders: returnReq.orders,
          customers: returnReq.customers,
          return_items: returnReq.return_items,
        })
      }
    } catch {
      // keep state unchanged
    }

    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!returnReq) return null

  const sc = STATUS_CONFIG[returnReq.status] || STATUS_CONFIG.pending

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/returns" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            ←
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">#{returnReq.return_number}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                {sc.icon} {sc.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                returnReq.return_type === 'full' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'
              }`}>
                {returnReq.return_type === 'full' ? 'Бүтэн буцаалт' : 'Хэсэгчилсэн буцаалт'}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {new Date(returnReq.created_at).toLocaleDateString('mn-MN', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {returnReq.status === 'pending' && (
            <>
              <button
                onClick={() => handleAction('rejected')}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                ❌ Татгалзах
              </button>
              <button
                onClick={() => handleAction('approved')}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {actionLoading ? '...' : '✅ Зөвшөөрөх'}
              </button>
            </>
          )}
          {returnReq.status === 'approved' && (
            <>
              <button
                onClick={() => handleAction('rejected')}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                ❌ Татгалзах
              </button>
              <button
                onClick={() => handleAction('completed')}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {actionLoading ? '...' : '✓ Буцаалт дуусгах'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reason */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Шалтгаан</h3>
            <p className="text-slate-300 text-sm">
              {returnReq.reason || 'Шалтгаан оруулаагүй'}
            </p>
          </div>

          {/* Return Items (for partial returns) */}
          {returnReq.return_type === 'partial' && returnReq.return_items?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Буцааж буй бүтээгдэхүүнүүд</h3>
              <div className="space-y-4">
                {returnReq.return_items.map((item) => {
                  const product = item.order_items?.products || item.order_items?.product_variants?.products
                  const variant = item.order_items?.variant_label ||
                    [item.order_items?.product_variants?.size, item.order_items?.product_variants?.color].filter(Boolean).join(' / ')

                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-700/20 rounded-xl">
                      <div className="w-14 h-14 bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                        {(product?.images as string[])?.[0] ? (
                          <img
                            src={(product?.images as string[])[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{product?.name || 'Бүтээгдэхүүн'}</p>
                        {variant && <p className="text-slate-400 text-sm">{variant}</p>}
                        {item.reason && <p className="text-orange-400 text-xs mt-1">Шалтгаан: {item.reason}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-white">{formatPrice(item.unit_price)}</p>
                        <p className="text-slate-400 text-sm">x{item.quantity}</p>
                      </div>
                      <div className="text-right w-28">
                        <p className="text-white font-medium">{formatPrice(item.subtotal)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                <span className="text-slate-400">Буцааж буй нийт дүн</span>
                <span className="text-white font-medium text-lg">
                  {formatPrice(returnReq.return_items.reduce((sum, item) => sum + item.subtotal, 0))}
                </span>
              </div>
            </div>
          )}

          {/* Admin Fields */}
          {(returnReq.status === 'pending' || returnReq.status === 'approved') && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Шийдвэрлэх</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Хариуцсан хүний нэр</label>
                  <input
                    value={handledBy}
                    onChange={(e) => setHandledBy(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Жишээ: Бат-Эрдэнэ"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Буцаах дүн</label>
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Буцаах хэлбэр</label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="">Сонгох</option>
                      <option value="qpay">QPay</option>
                      <option value="bank">Дансаар</option>
                      <option value="cash">Бэлэн</option>
                      <option value="original">Анхны хэлбэрээр</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Тэмдэглэл</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                    placeholder="Дотоод тэмдэглэл..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Completed/Rejected Info */}
          {(returnReq.status === 'completed' || returnReq.status === 'rejected') && returnReq.admin_notes && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Тэмдэглэл</h3>
              <p className="text-slate-300 text-sm">{returnReq.admin_notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Return Summary */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Буцаалтын мэдээлэл</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Төрөл</span>
                <span className="text-white">
                  {returnReq.return_type === 'full' ? 'Бүтэн буцаалт' : 'Хэсэгчилсэн буцаалт'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Буцаах дүн</span>
                <span className="text-white font-medium">
                  {returnReq.refund_amount ? formatPrice(returnReq.refund_amount) : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Буцаах хэлбэр</span>
                <span className="text-white">
                  {returnReq.refund_method ? REFUND_METHOD_LABELS[returnReq.refund_method] || returnReq.refund_method : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Хариуцсан</span>
                <span className="text-white">{returnReq.handled_by || '-'}</span>
              </div>
              {returnReq.approved_at && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Зөвшөөрсөн</span>
                  <span className="text-slate-300 text-xs">
                    {new Date(returnReq.approved_at).toLocaleDateString('mn-MN')}
                  </span>
                </div>
              )}
              {returnReq.completed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Дууссан</span>
                  <span className="text-slate-300 text-xs">
                    {new Date(returnReq.completed_at).toLocaleDateString('mn-MN')}
                  </span>
                </div>
              )}
              {returnReq.rejected_at && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Татгалзсан</span>
                  <span className="text-slate-300 text-xs">
                    {new Date(returnReq.rejected_at).toLocaleDateString('mn-MN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Order Info */}
          {returnReq.orders && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Захиалга</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Дугаар</span>
                  <Link href={`/dashboard/orders/${returnReq.orders.id}`} className="text-blue-400 hover:text-blue-300 transition-all">
                    #{returnReq.orders.order_number}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Нийт дүн</span>
                  <span className="text-white">{formatPrice(returnReq.orders.total_amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Төлбөр</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    returnReq.orders.payment_status === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : returnReq.orders.payment_status === 'refunded'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {returnReq.orders.payment_status === 'paid' ? 'Төлсөн' :
                     returnReq.orders.payment_status === 'refunded' ? 'Буцаасан' : 'Төлөөгүй'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Customer Info */}
          {returnReq.customers && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Харилцагч</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {returnReq.customers.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{returnReq.customers.name || 'Нэргүй'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {returnReq.customers.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">📱</span>
                    <span className="text-slate-300">{returnReq.customers.phone}</span>
                  </div>
                )}
                {returnReq.customers.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">📧</span>
                    <span className="text-slate-300">{returnReq.customers.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
