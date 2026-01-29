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
  const serviceBasedTypes = ['beauty_salon', 'fitness', 'education', 'services']
  const isServiceBased = serviceBasedTypes.includes(store?.business_type || '')

  // Get counts based on business type
  let itemCount = 0
  let bookingCount = 0
  let todayAppointments = 0
  let staffCount = 0

  if (isServiceBased) {
    // Beauty salon: services and appointments
    const { count: servicesCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
    itemCount = servicesCount || 0

    const { count: appointmentsCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
    bookingCount = appointmentsCount || 0

    // Today's appointments
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { count: todayCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
    todayAppointments = todayCount || 0

    const { count: staffMemberCount } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('status', 'active')
    staffCount = staffMemberCount || 0
  } else {
    // E-commerce: products and orders
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
    itemCount = productCount || 0

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
    bookingCount = orderCount || 0
  }

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

  // Get upcoming appointments for beauty salon
  let upcomingAppointments: Array<{
    id: string
    scheduled_at: string
    customer_name: string | null
    duration_minutes: number
    services: { name: string } | null
    staff: { name: string } | null
    status: string
  }> = []

  if (isServiceBased) {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        customer_name,
        duration_minutes,
        status,
        services(name),
        staff(name)
      `)
      .eq('store_id', storeId)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5)

    upcomingAppointments = appointments || []
  }

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
        {isServiceBased ? (
          <>
            {/* Beauty Salon Stats */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Өнөөдрийн захиалга</p>
                  <p className="text-3xl font-bold text-white mt-1">{todayAppointments}</p>
                </div>
                <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Үйлчилгээ</p>
                  <p className="text-3xl font-bold text-white mt-1">{itemCount}</p>
                </div>
                <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💅</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Ажилтан</p>
                  <p className="text-3xl font-bold text-white mt-1">{staffCount}</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👩‍💼</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Нийт захиалга</p>
                  <p className="text-3xl font-bold text-white mt-1">{bookingCount}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* E-commerce Stats */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Бүтээгдэхүүн</p>
                  <p className="text-3xl font-bold text-white mt-1">{itemCount}</p>
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
                  <p className="text-3xl font-bold text-white mt-1">{bookingCount}</p>
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
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Дараагийн алхам</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isServiceBased ? (
            <>
              {/* Beauty Salon Quick Actions */}
              <Link
                href="/dashboard/services/new"
                className="flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all group"
              >
                <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center group-hover:bg-pink-500/30 transition-all">
                  <span>1️⃣</span>
                </div>
                <div>
                  <p className="text-white font-medium">Үйлчилгээ нэмэх</p>
                  <p className="text-slate-400 text-sm">Эхний үйлчилгээгээ нэмээрэй</p>
                </div>
              </Link>
              <Link
                href="/dashboard/staff"
                className="flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all group"
              >
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
                  <span>2️⃣</span>
                </div>
                <div>
                  <p className="text-white font-medium">Ажилтан нэмэх</p>
                  <p className="text-slate-400 text-sm">Багаа бүртгээрэй</p>
                </div>
              </Link>
              <Link
                href="/dashboard/calendar"
                className="flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all group"
              >
                <div className="w-10 h-10 bg-rose-500/20 rounded-lg flex items-center justify-center group-hover:bg-rose-500/30 transition-all">
                  <span>3️⃣</span>
                </div>
                <div>
                  <p className="text-white font-medium">Хуанли харах</p>
                  <p className="text-slate-400 text-sm">Захиалгуудаа удирдаарай</p>
                </div>
              </Link>
            </>
          ) : (
            <>
              {/* E-commerce Quick Actions */}
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
            </>
          )}
        </div>
      </div>

      {/* Upcoming Appointments (Beauty Salon) or Recent Activity (E-commerce) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        {isServiceBased ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Удахгүй болох захиалгууд</h2>
              <Link href="/dashboard/calendar" className="text-sm text-pink-400 hover:text-pink-300">
                Бүгдийг харах →
              </Link>
            </div>
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📅</span>
                </div>
                <p className="text-slate-400">Одоогоор захиалга байхгүй</p>
                <Link href="/dashboard/calendar" className="text-pink-400 hover:text-pink-300 text-sm mt-2 inline-block">
                  Захиалга нэмэх →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((apt) => {
                  const date = new Date(apt.scheduled_at)
                  const statusColors: Record<string, string> = {
                    pending: 'bg-yellow-500',
                    confirmed: 'bg-green-500',
                    in_progress: 'bg-blue-500',
                    completed: 'bg-slate-500',
                    cancelled: 'bg-red-500'
                  }
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-xl"
                    >
                      <div className={`w-2 h-12 ${statusColors[apt.status] || 'bg-pink-500'} rounded-full`} />
                      <div className="flex-1">
                        <p className="text-white font-medium">{apt.customer_name || 'Нэр тодорхойгүй'}</p>
                        <p className="text-sm text-slate-400">
                          {apt.services?.name || 'Үйлчилгээ сонгоогүй'}
                          {apt.staff?.name && ` • ${apt.staff.name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-medium">
                          {date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-sm text-slate-400">
                          {date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-white mb-4">Сүүлийн үйл ажиллагаа</h2>
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📭</span>
              </div>
              <p className="text-slate-400">Одоогоор үйл ажиллагаа алга байна</p>
              <p className="text-slate-500 text-sm mt-1">Бүтээгдэхүүн нэмж эхлээрэй</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
