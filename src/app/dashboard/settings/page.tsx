import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', user?.id ?? '')
    .single()

  // Get subscription
  const { data: subscription } = await supabase
    .from('store_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('store_id', store?.id ?? '')
    .single()

  const settingsGroups = [
    {
      title: 'Дэлгүүр',
      items: [
        {
          href: '/dashboard/settings/store',
          icon: '🏪',
          title: 'Дэлгүүрийн мэдээлэл',
          description: 'Нэр, лого, холбоо барих мэдээлэл',
        },
        {
          href: '/dashboard/settings/chatbot',
          icon: '🤖',
          title: 'Chatbot тохиргоо',
          description: 'AI хариултууд, welcome message',
        },
        {
          href: '/dashboard/settings/flows',
          icon: '🔀',
          title: 'Чат урсгал',
          description: 'Автомат яриа удирдах (Flow builder)',
          badge: 'Шинэ',
          badgeColor: 'blue',
        },
        {
          href: '/dashboard/settings/products',
          icon: '📦',
          title: 'Бүтээгдэхүүний тохиргоо',
          description: 'Ангилал, хэмжээ, өнгө',
        },
      ],
    },
    {
      title: 'Холболт',
      items: [
        {
          href: '/dashboard/settings/integrations',
          icon: '💬',
          title: 'Messenger & Instagram',
          description: 'Facebook Page холбох',
          badge: 'Тохируулаагүй',
          badgeColor: 'yellow',
        },
        {
          href: '/dashboard/settings/comment-auto-reply',
          icon: '🔄',
          title: 'Comment Auto-Reply',
          description: 'Сэтгэгдэлд автомат хариулах',
          badge: 'Шинэ',
          badgeColor: 'blue',
        },
        {
          href: '/dashboard/settings/webhook',
          icon: '🔗',
          title: 'Webhook & API',
          description: 'n8n, external API холболт',
        },
      ],
    },
    {
      title: 'Төлбөр & Захиалга',
      items: [
        {
          href: '/dashboard/settings/billing',
          icon: '💳',
          title: 'Төлбөрийн план',
          description: `Одоогийн план: ${subscription?.subscription_plans?.name || 'Free'}`,
          badge: subscription?.subscription_plans?.name || 'Free',
          badgeColor: 'blue',
        },
        {
          href: '/dashboard/settings/payments',
          icon: '💰',
          title: 'Төлбөр хүлээн авах',
          description: 'QPay, Social Pay, банкны данс',
        },
        {
          href: '/dashboard/settings/shipping',
          icon: '🚚',
          title: 'Хүргэлт',
          description: 'Хүргэлтийн бүс, үнэ',
        },
        {
          href: '/dashboard/settings/delivery',
          icon: '🤖',
          title: 'Хүргэлтийн тохиргоо',
          description: 'AI жолооч оноох, дүрэм тохируулах',
          badge: 'Шинэ',
          badgeColor: 'blue',
        },
      ],
    },
    {
      title: 'Аккаунт',
      items: [
        {
          href: '/dashboard/settings/profile',
          icon: '👤',
          title: 'Профайл',
          description: user?.email || '',
        },
        {
          href: '/dashboard/settings/team',
          icon: '👥',
          title: 'Баг',
          description: 'Хамтран ажиллах хүмүүс нэмэх',
        },
        {
          href: '/dashboard/settings/notifications',
          icon: '🔔',
          title: 'Мэдэгдэл',
          description: 'Имэйл, push мэдэгдэл',
        },
      ],
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Тохиргоо</h1>
        <p className="text-slate-400 mt-1">
          Дэлгүүр болон аккаунтын тохиргоо
        </p>
      </div>

      {/* Settings Groups */}
      <div className="space-y-8">
        {settingsGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
              {group.title}
            </h2>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl divide-y divide-slate-700">
              {group.items.map((item, itemIndex) => (
                <Link
                  key={itemIndex}
                  href={item.href}
                  className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-all first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center">
                      <span className="text-xl">{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{item.title}</p>
                      <p className="text-slate-400 text-sm">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.badge && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.badgeColor === 'yellow'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : item.badgeColor === 'blue'
                          ? 'bg-blue-500/20 text-blue-400'
                          : item.badgeColor === 'green'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    <span className="text-slate-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="mt-12">
        <h2 className="text-sm font-medium text-red-400 uppercase tracking-wide mb-4">
          Аюултай бүс
        </h2>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Дэлгүүр устгах</p>
              <p className="text-slate-400 text-sm">
                Бүх өгөгдөл бүрмөсөн устах бөгөөд сэргээх боломжгүй
              </p>
            </div>
            <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl transition-all">
              Устгах
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
