'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'

interface Plan {
  id: string
  name: string
  price: number
  limits: {
    products: number
    messages: number
    team_members: number
  }
  features: string[]
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    limits: { products: 50, messages: 500, team_members: 1 },
    features: ['50 бүтээгдэхүүн', '500 AI мессеж/сар', '1 хэрэглэгч', 'Messenger холболт', 'Үндсэн тайлан'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 29900,
    limits: { products: 200, messages: 2000, team_members: 3 },
    features: ['200 бүтээгдэхүүн', '2,000 AI мессеж/сар', '3 хэрэглэгч', 'Messenger + Instagram', 'Дэлгэрэнгүй тайлан', 'Excel экспорт'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79900,
    limits: { products: 1000, messages: 10000, team_members: 10 },
    features: ['1,000 бүтээгдэхүүн', '10,000 AI мессеж/сар', '10 хэрэглэгч', 'Бүх суваг', 'API хандалт', 'Webhook', 'Тусгай тайлан'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199900,
    limits: { products: -1, messages: -1, team_members: -1 },
    features: ['Хязгааргүй бүтээгдэхүүн', 'Хязгааргүй мессеж', 'Хязгааргүй хэрэглэгч', 'Бүх боломжууд', 'Тусгай хөгжүүлэлт', '24/7 дэмжлэг'],
  },
]

function formatPrice(price: number): string {
  if (price === 0) return 'Үнэгүй'
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function BillingSettingsPage() {
  const { allowed, loading: roleLoading } = useRoleGuard(['owner', 'admin'])
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState('free')
  const [messagesUsed, setMessagesUsed] = useState(0)
  const [messagesLimit, setMessagesLimit] = useState(500)
  const [productsUsed, setProductsUsed] = useState(0)
  const [productsLimit, setProductsLimit] = useState(50)
  const [storeId, setStoreId] = useState('')
  const [subscriptionId, setSubscriptionId] = useState('')
  const [switching, setSwitching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)

        const { data: sub } = await supabase
          .from('store_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('store_id', store.id)
          .single()

        if (sub) {
          setSubscriptionId(sub.id)
          setCurrentPlan(sub.subscription_plans?.name?.toLowerCase() || 'free')
          setMessagesUsed(sub.messages_used || 0)
          const limits = sub.subscription_plans?.limits as Record<string, number> | undefined
          setMessagesLimit(limits?.messages || 500)
          setProductsLimit(limits?.products || 50)
        }

        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', store.id)

        setProductsUsed(count || 0)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleSwitchPlan(planSlug: string) {
    if (!storeId) return
    setError(null)
    setSwitching(planSlug)

    try {
      // Look up the plan by slug
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('id, name, limits')
        .eq('slug', planSlug)
        .single()

      if (!plan) {
        setError('План олдсонгүй')
        setSwitching(null)
        return
      }

      if (subscriptionId) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from('store_subscriptions')
          .update({
            plan_id: plan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', subscriptionId)

        if (updateError) {
          setError('План шинэчлэхэд алдаа гарлаа: ' + updateError.message)
          setSwitching(null)
          return
        }
      } else {
        // Create new subscription
        const { error: insertError } = await supabase
          .from('store_subscriptions')
          .insert({
            store_id: storeId,
            plan_id: plan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })

        if (insertError) {
          setError('План идэвхжүүлэхэд алдаа гарлаа: ' + insertError.message)
          setSwitching(null)
          return
        }
      }

      // Update local state
      setCurrentPlan(planSlug)
      const limits = plan.limits as Record<string, number> | null
      setMessagesLimit(limits?.messages || 500)
      setProductsLimit(limits?.products || 50)
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setSwitching(null)
    }
  }

  if (loading || roleLoading || !allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Төлбөрийн план</h1>
          <p className="text-slate-400 mt-1">Таны одоогийн план болон шинэчлэх</p>
        </div>
      </div>

      {/* Current Usage */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
        <h3 className="text-white font-medium mb-4">Одоогийн хэрэглээ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">AI мессеж</span>
              <span className="text-white">{messagesUsed}/{messagesLimit === -1 ? '∞' : messagesLimit}</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  messagesLimit > 0 && messagesUsed / messagesLimit > 0.8 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`}
                style={{ width: messagesLimit > 0 ? `${Math.min(100, (messagesUsed / messagesLimit) * 100)}%` : '5%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">Бүтээгдэхүүн</span>
              <span className="text-white">{productsUsed}/{productsLimit === -1 ? '∞' : productsLimit}</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  productsLimit > 0 && productsUsed / productsLimit > 0.8 ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}
                style={{ width: productsLimit > 0 ? `${Math.min(100, (productsUsed / productsLimit) * 100)}%` : '5%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.name.toLowerCase() === currentPlan
          return (
            <div
              key={plan.id}
              className={`relative bg-slate-800/50 border rounded-2xl p-6 ${
                isCurrent ? 'border-blue-500/50 ring-1 ring-blue-500/20' :
                plan.id === 'pro' ? 'border-cyan-500/30' : 'border-slate-700'
              }`}
            >
              {plan.id === 'pro' && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-medium rounded-full">
                  Санал болгох
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                  Одоогийн план
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-white text-lg font-bold">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-white">{formatPrice(plan.price)}</span>
                  {plan.price > 0 && <span className="text-slate-400 text-sm">/сар</span>}
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent || switching === plan.id}
                onClick={() => !isCurrent && handleSwitchPlan(plan.id)}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                  isCurrent
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
                }`}
              >
                {switching === plan.id ? 'Шинэчилж байна...' : isCurrent ? 'Одоогийн план' : plan.price === 0 ? 'Сонгох' : 'Шинэчлэх'}
              </button>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Billing History */}
      <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-medium mb-4">Төлбөрийн түүх</h3>
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">Төлбөрийн түүх байхгүй байна</p>
        </div>
      </div>
    </div>
  )
}
