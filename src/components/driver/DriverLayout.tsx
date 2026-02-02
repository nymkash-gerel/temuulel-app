'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface DriverLayoutProps {
  driver: {
    id: string
    name: string
    status: string
    vehicle_type: string | null
  }
  children: React.ReactNode
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Чөлөөтэй', color: 'bg-green-500/20 text-green-400' },
  on_delivery: { label: 'Хүргэлт дээр', color: 'bg-blue-500/20 text-blue-400' },
  inactive: { label: 'Идэвхгүй', color: 'bg-slate-500/20 text-slate-400' },
}

const navItems = [
  { href: '/driver', icon: '🚚', label: 'Хүргэлт' },
  { href: '/driver/chat', icon: '💬', label: 'Чат' },
  { href: '/driver/history', icon: '📋', label: 'Түүх' },
  { href: '/driver/earnings', icon: '💰', label: 'Орлого' },
  { href: '/driver/profile', icon: '👤', label: 'Профайл' },
]

export default function DriverLayout({ driver, children }: DriverLayoutProps) {
  const pathname = usePathname()

  const statusInfo = STATUS_LABELS[driver.status] || STATUS_LABELS.active

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-800/95 backdrop-blur border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-lg">
              🚚
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm leading-tight">{driver.name}</h1>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
          <form action="/api/driver/auth/signout" method="POST">
            <button
              type="submit"
              className="text-slate-400 hover:text-white text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-700"
            >
              Гарах
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <div className="max-w-lg mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-800/95 backdrop-blur border-t border-slate-700">
        <div className="max-w-lg mx-auto flex">
          {navItems.map((item) => {
            const isActive = item.href === '/driver'
              ? pathname === '/driver'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                  isActive
                    ? 'text-blue-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
