import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', user?.id ?? '')
    .single()

  const storeId = store?.id ?? ''

  // Get product count
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)

  // Get order count
  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)

  // Get customer count
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)

  // Get subscription
  const { data: subscription } = await supabase
    .from('store_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('store_id', storeId)
    .single()

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Сайн байна уу! 👋
        </h1>
        <p className="text-slate-400 mt-1">
          {store?.name || 'Таны дэлгүүр'} - өнөөдрийн тойм
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Бүтээгдэхүүн</p>
              <p className="text-3xl font-bold text-white mt-1">{productCount || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📦</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Захиалга</p>
              <p className="text-3xl font-bold text-white mt-1">{orderCount || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🛒</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Харилцагч</p>
              <p className="text-3xl font-bold text-white mt-1">{customerCount || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">AI мессеж</p>
              <p className="text-3xl font-bold text-white mt-1">
                {subscription?.messages_used || 0}
                <span className="text-sm text-slate-500 font-normal">
                  /{(subscription?.subscription_plans?.limits as Record<string, number> | undefined)?.messages || 500}
                </span>
              </p>
            </div>
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Дараагийн алхам</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/products/new"
            className="flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-all">
              <span>1️⃣</span>
            </div>
            <div>
              <p className="text-white font-medium">Бүтээгдэхүүн нэмэх</p>
              <p className="text-slate-400 text-sm">Эхний бүтээгдэхүүнээ нэмээрэй</p>
            </div>
          </Link>
          <Link
            href="/dashboard/settings/integrations"
            className="flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-all">
              <span>2️⃣</span>
            </div>
            <div>
              <p className="text-white font-medium">Messenger холбох</p>
              <p className="text-slate-400 text-sm">Facebook Page холбоорой</p>
            </div>
          </Link>
          <Link
            href="/dashboard/settings/chatbot"
            className="flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
              <span>3️⃣</span>
            </div>
            <div>
              <p className="text-white font-medium">Chatbot тохируулах</p>
              <p className="text-slate-400 text-sm">AI хариултуудыг тохируулаарай</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Сүүлийн үйл ажиллагаа</h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📭</span>
          </div>
          <p className="text-slate-400">Одоогоор үйл ажиллагаа алга байна</p>
          <p className="text-slate-500 text-sm mt-1">Бүтээгдэхүүн нэмж эхлээрэй</p>
        </div>
      </div>
    </div>
  )
}
