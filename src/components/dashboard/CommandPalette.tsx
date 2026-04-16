'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Item { label: string; href: string; icon: string; category: string }

const ITEMS: Item[] = [
  { label: 'Хянах самбар', href: '/dashboard', icon: '📊', category: 'Nav' },
  { label: 'Бүтээгдэхүүн', href: '/dashboard/products', icon: '📦', category: 'Nav' },
  { label: 'Захиалга', href: '/dashboard/orders', icon: '🛒', category: 'Nav' },
  { label: 'Хүргэлт', href: '/dashboard/deliveries', icon: '🚚', category: 'Nav' },
  { label: 'Харилцагч', href: '/dashboard/customers', icon: '👥', category: 'Nav' },
  { label: 'Чат', href: '/dashboard/chat', icon: '💬', category: 'Nav' },
  { label: 'AI Суралцах', href: '/dashboard/ai-learning', icon: '🧠', category: 'AI' },
  { label: 'Broadcast кампани', href: '/dashboard/broadcast', icon: '📢', category: 'Marketing' },
  { label: 'A/B Тест', href: '/dashboard/ab-tests', icon: '🧪', category: 'Growth' },
  { label: 'Churn анализ', href: '/dashboard/churn', icon: '📉', category: 'Growth' },
  { label: 'Мессежийн хэрэглээ', href: '/dashboard/message-usage', icon: '💬', category: 'Billing' },
  { label: 'Захиалга & Төлбөр', href: '/dashboard/subscription', icon: '💳', category: 'Billing' },
  { label: 'Тайлан', href: '/dashboard/analytics', icon: '📈', category: 'Nav' },
  { label: 'Тохиргоо', href: '/dashboard/settings', icon: '⚙️', category: 'Settings' },
  { label: 'Аюулгүй байдал (2FA)', href: '/dashboard/settings/security', icon: '🔒', category: 'Settings' },
  { label: 'Брэнд тохиргоо', href: '/dashboard/settings/branding', icon: '🎨', category: 'Settings' },
  { label: 'Comment Auto-Reply', href: '/dashboard/settings/comment-auto-reply', icon: '💬', category: 'Settings' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Cmd+K / Ctrl+K toggle
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = query.trim()
    ? ITEMS.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.category.toLowerCase().includes(query.toLowerCase()))
    : ITEMS.slice(0, 8)

  function select(i: number) {
    const item = filtered[i]
    if (!item) return
    router.push(item.href)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); select(selected) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh] p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <span className="text-slate-500">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKey}
            placeholder="Хайх... (захиалга, харилцагч, тохиргоо)"
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
          />
          <kbd className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Үр дүн олдсонгүй</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.href}
                onClick={() => select(i)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
              >
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.category}</p>
                </div>
                {i === selected && <kbd className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">↵</kbd>}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>Нэвтэрч орох: ↑↓ ↵</span>
          <span>⌘K эсвэл Ctrl+K</span>
        </div>
      </div>
    </div>
  )
}
