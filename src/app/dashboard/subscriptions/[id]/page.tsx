'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { subscriptionTransitions } from '@/lib/status-machine'

interface Subscription {
  id: string
  customer_id: string
  plan_name: string
  amount: number
  billing_period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  status: 'active' | 'paused' | 'cancelled' | 'expired'
  auto_renew: boolean
  next_billing_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null } | null
}

interface SubscriptionItem {
  id: string
  subscription_id: string
  product_id: string
  quantity: number
  unit_price: number
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Түр зогссон', color: 'bg-yellow-500/20 text-yellow-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
  expired: { label: 'Дууссан', color: 'bg-slate-500/20 text-slate-400' },
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Идэвхтэй',
  paused: 'Түр зогссон',
  cancelled: 'Цуцлагдсан',
  expired: 'Дууссан',
}

const BILLING_PERIOD_LABELS: Record<string, string> = {
  weekly: '7 хоног',
  monthly: 'Сар бүр',
  quarterly: 'Улирал бүр',
  yearly: 'Жил бүр',
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function SubscriptionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState<boolean>(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [items, setItems] = useState<SubscriptionItem[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    const { data: subData } = await supabase
      .from('subscriptions')
      .select(`
        *,
        customers(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!subData) { router.push('/dashboard/subscriptions'); return }

    setSubscription(subData as unknown as Subscription)

    const { data: itemsData } = await supabase
      .from('subscription_items')
      .select('id, subscription_id, product_id, quantity, unit_price, created_at')
      .eq('subscription_id', id)
      .order('created_at', { ascending: true })

    if (itemsData) {
      setItems(itemsData as unknown as SubscriptionItem[])
    }

    setLoading(false)
  }, [supabase, router, id])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!subscription) return
    setEditData({
      plan_name: subscription.plan_name,
      billing_period: subscription.billing_period,
      amount: subscription.amount,
      next_billing_at: subscription.next_billing_at ? subscription.next_billing_at.slice(0, 10) : '',
      auto_renew: subscription.auto_renew,
      notes: subscription.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!subscription) return
    setSaving(true)
    try {
      const changed: Record<string, unknown> = {}
      if (editData.plan_name !== subscription.plan_name) changed.plan_name = editData.plan_name
      if (editData.billing_period !== subscription.billing_period) changed.billing_period = editData.billing_period
      if (Number(editData.amount) !== subscription.amount) changed.amount = Number(editData.amount)
      if ((editData.next_billing_at || '') !== (subscription.next_billing_at ? subscription.next_billing_at.slice(0, 10) : '')) {
        changed.next_billing_at = editData.next_billing_at || null
      }
      if (editData.auto_renew !== subscription.auto_renew) changed.auto_renew = editData.auto_renew
      if ((editData.notes || '') !== (subscription.notes || '')) changed.notes = editData.notes || null

      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Хадгалахад алдаа гарлаа')
      }

      setIsEditing(false)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!subscription) return null

  const sc = STATUS_CONFIG[subscription.status] || STATUS_CONFIG.active
  const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/subscriptions"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          &larr;
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{subscription.plan_name}</h1>
          <p className="text-slate-400 mt-1">
            {subscription.customers?.name || 'Нэргүй'} &middot; {BILLING_PERIOD_LABELS[subscription.billing_period] || subscription.billing_period}
          </p>
        </div>
        <span className={`px-4 py-2 rounded-xl text-sm font-medium ${sc.color}`}>
          {sc.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <StatusActions
          currentStatus={subscription.status}
          transitions={subscriptionTransitions}
          statusLabels={STATUS_LABELS}
          apiPath={`/api/subscriptions/${id}`}
          onSuccess={load}
        />
        {!isEditing ? (
          <button
            onClick={startEdit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            Засах
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              Болих
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Subscription Info Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Захиалгын мэдээлэл</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Багцын нэр</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.plan_name as string}
                  onChange={(e) => setEditData({ ...editData, plan_name: e.target.value })}
                  className={inputClassName + ' mt-1'}
                />
              ) : (
                <p className="text-white mt-1 font-medium">{subscription.plan_name}</p>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-sm">Төлбөрийн хугацаа</p>
              {isEditing ? (
                <select
                  value={editData.billing_period as string}
                  onChange={(e) => setEditData({ ...editData, billing_period: e.target.value })}
                  className={inputClassName + ' mt-1'}
                >
                  <option value="weekly">Долоо хоног</option>
                  <option value="monthly">Сар</option>
                  <option value="quarterly">Улирал</option>
                  <option value="yearly">Жил</option>
                </select>
              ) : (
                <p className="text-white mt-1">
                  {BILLING_PERIOD_LABELS[subscription.billing_period] || subscription.billing_period}
                </p>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-sm">Автомат сунгалт</p>
              {isEditing ? (
                <label className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={editData.auto_renew as boolean}
                    onChange={(e) => setEditData({ ...editData, auto_renew: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700/50 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-white text-sm">{editData.auto_renew ? 'Тийм' : 'Үгүй'}</span>
                </label>
              ) : (
                <p className="mt-1">
                  {subscription.auto_renew ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Тийм</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-400">Үгүй</span>
                  )}
                </p>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-sm">Төлөв</p>
              <p className="mt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Customer Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Харилцагч</h2>
          <div>
            <p className="text-slate-400 text-sm">Нэр</p>
            <p className="text-white mt-1 font-medium">{subscription.customers?.name || 'Нэргүй'}</p>
          </div>
          {subscription.customers?.id && (
            <Link
              href={`/dashboard/customers/${subscription.customers.id}`}
              className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm transition-all"
            >
              Харилцагчийн дэлгэрэнгүй &rarr;
            </Link>
          )}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-slate-400 text-sm">Үүсгэсэн огноо</p>
            <p className="text-white mt-1 text-sm">{formatDate(subscription.created_at)}</p>
          </div>
          <div className="mt-3">
            <p className="text-slate-400 text-sm">Шинэчилсэн огноо</p>
            <p className="text-white mt-1 text-sm">{formatDate(subscription.updated_at)}</p>
          </div>
        </div>

        {/* Financial Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Санхүүгийн мэдээлэл</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Захиалгын дүн</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.amount as number}
                  onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                  className={inputClassName + ' mt-1'}
                />
              ) : (
                <p className="text-white mt-1 text-xl font-bold">{formatPrice(subscription.amount)}</p>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-sm">Дараагийн төлбөр</p>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.next_billing_at as string}
                  onChange={(e) => setEditData({ ...editData, next_billing_at: e.target.value })}
                  className={inputClassName + ' mt-1'}
                />
              ) : (
                <p className="text-white mt-1">
                  {subscription.next_billing_at
                    ? formatDate(subscription.next_billing_at)
                    : '-'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Notes Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Тэмдэглэл</h2>
          {isEditing ? (
            <textarea
              value={editData.notes as string}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={4}
              className={inputClassName}
              placeholder="Тэмдэглэл бичих..."
            />
          ) : subscription.notes ? (
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{subscription.notes}</p>
          ) : (
            <p className="text-slate-500 text-sm italic">Тэмдэглэл байхгүй</p>
          )}
        </div>
      </div>

      {/* Subscription Items Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mb-6">
        <h2 className="p-4 text-lg font-semibold text-white border-b border-slate-700">
          Захиалгын бүтээгдэхүүнүүд
          {items.length > 0 && (
            <span className="text-slate-400 text-sm font-normal ml-2">({items.length})</span>
          )}
        </h2>
        {items.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-sm text-slate-400 font-medium">Бүтээгдэхүүн ID</th>
                <th className="text-right p-4 text-sm text-slate-400 font-medium">Тоо ширхэг</th>
                <th className="text-right p-4 text-sm text-slate-400 font-medium">Нэгж үнэ</th>
                <th className="text-right p-4 text-sm text-slate-400 font-medium">Нийт дүн</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="p-4 text-sm text-white font-mono">{item.product_id}</td>
                  <td className="p-4 text-right text-sm text-slate-300">{item.quantity}</td>
                  <td className="p-4 text-right text-sm text-slate-300">{formatPrice(item.unit_price)}</td>
                  <td className="p-4 text-right text-sm text-white font-medium">
                    {formatPrice(item.quantity * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600">
                <td colSpan={3} className="p-4 text-right text-sm text-slate-400 font-medium">Нийт:</td>
                <td className="p-4 text-right text-sm font-bold text-white">{formatPrice(itemsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm">Бүтээгдэхүүн бүртгэгдээгүй байна</p>
          </div>
        )}
      </div>

      {/* Back button */}
      <div>
        <Link
          href="/dashboard/subscriptions"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
        >
          &larr; Захиалгын жагсаалт руу буцах
        </Link>
      </div>
    </div>
  )
}
