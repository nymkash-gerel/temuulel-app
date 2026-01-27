'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/ui/NotificationBell'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: {
    email: string
  }
  store?: {
    name: string
  } | null
  subscription?: {
    messages_used: number
    subscription_plans: {
      name: string
      limits: unknown
    } | null
  } | null
}

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'Тойм' },
  { href: '/dashboard/products', icon: '📦', label: 'Бүтээгдэхүүн' },
  { href: '/dashboard/orders', icon: '🛒', label: 'Захиалга' },
  { href: '/dashboard/customers', icon: '👥', label: 'Харилцагч' },
  { href: '/dashboard/chat', icon: '💬', label: 'Чат' },
  { href: '/dashboard/analytics', icon: '📈', label: 'Тайлан' },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Тохиргоо' },
]

export default function DashboardLayout({
  children,
  user,
  store,
  subscription
}: DashboardLayoutProps) {
  const pathname = usePathname()

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
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-800/30 border-r border-slate-700 p-4 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => (
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
                <span>{item.label}</span>
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
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
