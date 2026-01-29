'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/ui/NotificationBell'
import ChatWidget from '@/components/ui/ChatWidget'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: {
    email: string
  }
  store?: {
    id: string
    name: string
    business_type?: string | null
    chatbot_settings?: unknown
  } | null
  subscription?: {
    messages_used: number
    subscription_plans: {
      name: string
      limits: unknown
    } | null
  } | null
}

// E-commerce nav items (for: ecommerce, restaurant)
const ecommerceNavItems = [
  { href: '/dashboard', icon: '📊', label: 'Тойм' },
  { href: '/dashboard/products', icon: '📦', label: 'Бүтээгдэхүүн' },
  { href: '/dashboard/orders', icon: '🛒', label: 'Захиалга' },
  { href: '/dashboard/customers', icon: '👥', label: 'Харилцагч' },
  { href: '/dashboard/chat', icon: '💬', label: 'Чат' },
  { href: '/dashboard/analytics', icon: '📈', label: 'Тайлан' },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Тохиргоо' },
]

// Service-based nav items (for: beauty_salon, fitness, education, services)
const serviceNavItems = [
  { href: '/dashboard', icon: '📊', label: 'Тойм' },
  { href: '/dashboard/calendar', icon: '📅', label: 'Хуанли' },
  { href: '/dashboard/services', icon: '💅', label: 'Үйлчилгээ' },
  { href: '/dashboard/staff', icon: '👩‍💼', label: 'Ажилтнууд' },
  { href: '/dashboard/customers', icon: '👥', label: 'Харилцагч' },
  { href: '/dashboard/chat', icon: '💬', label: 'Чат' },
  { href: '/dashboard/analytics', icon: '📈', label: 'Тайлан' },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Тохиргоо' },
]

// Business types that use service-based dashboard
const serviceBasedTypes = ['beauty_salon', 'fitness', 'education', 'services']

export default function DashboardLayout({
  children,
  user,
  store,
  subscription
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Subscribe to unread count changes
  useEffect(() => {
    if (!store?.id) return

    const supabase = createClient()

    async function fetchUnread() {
      const { data } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('store_id', store!.id)
        .gt('unread_count', 0)

      if (data) {
        setTotalUnread(data.reduce((sum, c) => sum + (c.unread_count || 0), 0))
      }
    }

    fetchUnread()

    const channel = supabase
      .channel('sidebar-unread')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `store_id=eq.${store.id}`,
        },
        () => { fetchUnread() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [store?.id])

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-800/80 backdrop-blur-xl border-b border-slate-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg"
                aria-label="Цэс нээх"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <span className="text-white font-bold text-lg">TEMUULEL</span>
                {store && (
                  <p className="text-xs text-slate-400">{store.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {subscription && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
                  <span className="text-xs text-slate-400">AI:</span>
                  <span className="text-sm text-white font-medium">
                    {subscription.messages_used}/{((subscription.subscription_plans?.limits as Record<string, number> | undefined)?.messages) || 500}
                  </span>
                </div>
              )}
              <NotificationBell />
              <span className="text-slate-400 text-sm hidden sm:block">{user.email}</span>
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                >
                  Гарах
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-0 lg:top-16 bottom-0 left-0 z-40 w-64 bg-slate-800 lg:bg-slate-800/30 border-r border-slate-700 p-4 overflow-y-auto transform transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Mobile close button */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <span className="text-white font-bold">TEMUULEL</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-lg"
              aria-label="Цэс хаах"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav className="space-y-1">
            {(serviceBasedTypes.includes(store?.business_type || '') ? serviceNavItems : ecommerceNavItems).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive(item.href)
                    ? 'text-white bg-slate-700/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                }`}
              >
                <span>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.href === '/dashboard/chat' && totalUnread > 0 && (
                  <span className="min-w-5 h-5 px-1.5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Plan Info */}
          {subscription && (
            <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Таны план</span>
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                  {subscription.subscription_plans?.name || 'Free'}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (subscription.messages_used / (((subscription.subscription_plans?.limits as Record<string, number> | undefined)?.messages) || 500)) * 100)}%`
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {subscription.messages_used}/{((subscription.subscription_plans?.limits as Record<string, number> | undefined)?.messages) || 500} мессеж
              </p>
              <Link
                href="/dashboard/settings/billing"
                className="block w-full mt-3 py-2 text-center text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all"
              >
                Шинэчлэх
              </Link>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Chat Preview Widget */}
      {store && (
        <ChatWidget
          storeId={store.id}
          storeName={store.name}
          accentColor={((store.chatbot_settings as Record<string, unknown> | null)?.accent_color as string) || '#3b82f6'}
          welcomeMessage="Чатботоо туршиж үзээрэй. Бүтээгдэхүүнийхээ талаар асуулт асууна уу."
          compact
        />
      )}
    </div>
  )
}
