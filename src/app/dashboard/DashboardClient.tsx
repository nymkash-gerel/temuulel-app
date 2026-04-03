'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

/* ── Animated number counter ── */
function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      setDisplay(Math.round(ease * value))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, duration])

  return <span ref={ref}>{display.toLocaleString()}</span>
}

/* ── Stagger ── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } } as const
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
} as const

/* ── Gradient maps ── */
const gradientMap: Record<string, string> = {
  blue: 'from-blue-500/20 to-blue-600/5',
  green: 'from-emerald-500/20 to-emerald-600/5',
  purple: 'from-purple-500/20 to-purple-600/5',
  cyan: 'from-cyan-500/20 to-cyan-600/5',
  pink: 'from-pink-500/20 to-pink-600/5',
  rose: 'from-rose-500/20 to-rose-600/5',
}

const iconColorMap: Record<string, string> = {
  blue: 'text-blue-400', green: 'text-emerald-400', purple: 'text-purple-400',
  cyan: 'text-cyan-400', pink: 'text-pink-400', rose: 'text-rose-400',
}

const iconBgMap: Record<string, string> = {
  blue: 'bg-blue-500/10', green: 'bg-emerald-500/10', purple: 'bg-purple-500/10',
  cyan: 'bg-cyan-500/10', pink: 'bg-pink-500/10', rose: 'bg-rose-500/10',
}

/* ── SVG Icon components ── */
function IconBox({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
}
function IconCart({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
}
function IconUsers({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-purple-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
}
function IconSparkles({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-cyan-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
}
function IconCalendar({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-pink-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
}
function IconStaff({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-purple-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
}
function IconCheck({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
}
function IconService({ color }: { color: string }) {
  return <svg className={`w-5 h-5 ${iconColorMap[color] || 'text-rose-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>
}

const STAT_ICONS: Record<string, React.FC<{ color: string }>> = {
  box: IconBox, cart: IconCart, users: IconUsers, sparkles: IconSparkles,
  calendar: IconCalendar, staff: IconStaff, check: IconCheck, service: IconService,
}

/* ── Types ── */
interface StatCard {
  label: string
  value: number
  icon: string
  color: string
  trend: number | null
  suffix?: string
}

interface QuickAction {
  href: string
  icon: string
  label: string
  desc: string
  color: string
}

interface DashboardClientProps {
  storeName: string
  greeting: string
  isServiceBased: boolean
  stats: { primary: StatCard; secondary: StatCard; tertiary: StatCard; quaternary: StatCard }
  aiUsage: { used: number; limit: number; percent: number; plan: string }
  quickActions: QuickAction[]
  recentOrders: Array<{ id: string; order_number: string | null; total_amount: number; status: string; created_at: string; customers: { name: string } | null }>
  upcomingAppointments: Array<{ id: string; scheduled_at: string; customer_name: string | null; duration_minutes: number; services: { name: string } | null; staff: { name: string } | null; status: string }>
}

// Map old emoji icons to SVG keys
const ICON_MAP: Record<string, string> = {
  '📦': 'box', '🛒': 'cart', '👥': 'users', '🤖': 'sparkles',
  '📅': 'calendar', '💅': 'service', '👩‍💼': 'staff', '✅': 'check',
  '💬': 'cart', '📭': 'box',
}

const QUICK_ICON_MAP: Record<string, React.ReactNode> = {
  '📦': <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>,
  '💬': <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>,
  '🤖': <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
  '💅': <svg className="w-5 h-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>,
  '👩‍💼': <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
  '📅': <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>,
}

const orderStatusMap: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:    { label: 'Хүлээгдэж буй', dot: 'bg-amber-400',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-l-amber-500' },
  confirmed:  { label: 'Баталгаажсан',  dot: 'bg-blue-400',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-l-blue-500' },
  processing: { label: 'Бэлтгэж буй',  dot: 'bg-indigo-400',  bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'border-l-indigo-500' },
  shipped:    { label: 'Хүргэлтэнд',   dot: 'bg-cyan-400',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-l-cyan-500' },
  delivered:  { label: 'Хүргэгдсэн',   dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-l-emerald-500' },
  cancelled:  { label: 'Цуцлагдсан',   dot: 'bg-red-400',     bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-l-red-500' },
}

const aptStatusMap: Record<string, { label: string; dot: string }> = {
  pending:     { label: 'Хүлээгдэж буй', dot: 'bg-amber-400' },
  confirmed:   { label: 'Баталгаажсан',  dot: 'bg-emerald-400' },
  in_progress: { label: 'Явагдаж буй',  dot: 'bg-blue-400' },
  completed:   { label: 'Дууссан',       dot: 'bg-slate-400' },
  cancelled:   { label: 'Цуцлагдсан',   dot: 'bg-red-400' },
}

export default function DashboardClient({
  storeName, greeting, isServiceBased, stats, aiUsage, quickActions, recentOrders, upcomingAppointments,
}: DashboardClientProps) {
  const statCards = [stats.primary, stats.secondary, stats.tertiary, stats.quaternary]

  return (
    <div className="space-y-6">
      {/* ── Welcome header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 font-medium">{greeting}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">{storeName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400">AI идэвхтэй</span>
          </div>
          <div className="text-xs text-slate-500">
            {new Date().toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </motion.div>

      {/* ── Stat cards ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card, i) => {
          const gradient = gradientMap[card.color] || gradientMap.blue
          const iconKey = ICON_MAP[card.icon] || 'box'
          const IconComp = STAT_ICONS[iconKey] || IconBox
          return (
            <motion.div key={i} variants={fadeUp}
              className="group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 hover:bg-white/[0.05] transition-all duration-300">
              <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${iconBgMap[card.color] || 'bg-blue-500/10'} flex items-center justify-center`}>
                    <IconComp color={card.color} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{card.label}</p>
                <p className="text-3xl font-bold text-white mt-1">
                  <AnimatedNumber value={card.value} />
                  {card.suffix && <span className="text-sm text-slate-500 font-normal ml-1">{card.suffix}</span>}
                </p>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* ── AI Usage + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Usage */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.45 }}
          className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/15 to-cyan-500/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">AI хэрэглээ</p>
                <p className="text-xs text-slate-500">{aiUsage.plan} план</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-white"><AnimatedNumber value={aiUsage.used} /></p>
                <p className="text-sm text-slate-500">/ {aiUsage.limit.toLocaleString()}</p>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${aiUsage.percent}%` }}
                  transition={{ delay: 0.6, duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${aiUsage.percent > 80 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{aiUsage.percent}% ашигласан</p>
                {aiUsage.percent > 80 && (
                  <Link href="/dashboard/billing" className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1">
                    Шинэчлэх
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.45 }}
          className="lg:col-span-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Хурдан үйлдэл</h2>
            <span className="text-[10px] text-slate-600 uppercase tracking-wider">Дараагийн алхам</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((action, i) => {
              const gradient = gradientMap[action.color] || gradientMap.blue
              return (
                <Link key={i} href={action.href}
                  className="group relative overflow-hidden rounded-xl p-4 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300">
                  <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-xl ${iconBgMap[action.color] || 'bg-blue-500/10'} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      {QUICK_ICON_MAP[action.icon] || <IconBox color={action.color} />}
                    </div>
                    <p className="text-white font-medium text-sm">{action.label}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{action.desc}</p>
                  </div>
                  <div className={`absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity ${iconColorMap[action.color] || 'text-blue-400'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  </div>
                </Link>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Activity section ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.45 }}
        className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        {isServiceBased ? (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                </div>
                <h2 className="text-white font-semibold text-sm">Удахгүй болох захиалгууд</h2>
              </div>
              <Link href="/dashboard/calendar" className="text-xs text-pink-400 hover:text-pink-300 font-medium flex items-center gap-1">
                Бүгдийг харах <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                </div>
                <p className="text-slate-400 font-medium">Одоогоор захиалга байхгүй</p>
                <p className="text-slate-600 text-sm mt-1">Календарт шинэ захиалга нэмээрэй</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {upcomingAppointments.map((apt) => {
                  const date = new Date(apt.scheduled_at)
                  const s = aptStatusMap[apt.status] || aptStatusMap.pending
                  return (
                    <div key={apt.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                      <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex flex-col items-center justify-center shrink-0">
                        <p className="text-white font-bold text-sm leading-none">{date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">{date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <div className={`w-1 h-10 ${s.dot} rounded-full`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{apt.customer_name || 'Нэр тодорхойгүй'}</p>
                        <p className="text-slate-500 text-xs truncate">
                          {apt.services?.name || 'Үйлчилгээ'}
                          {apt.staff?.name && <span className="text-slate-600"> &middot; {apt.staff.name}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-400">{apt.duration_minutes} мин</p>
                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          <span className="text-[10px] text-slate-500">{s.label}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                </div>
                <h2 className="text-white font-semibold text-sm">Сүүлийн захиалгууд</h2>
              </div>
              <Link href="/dashboard/orders" className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                Бүгдийг харах <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
                </div>
                <p className="text-slate-400 font-medium">Одоогоор захиалга алга байна</p>
                <p className="text-slate-600 text-sm mt-1">Бүтээгдэхүүн нэмж, Messenger холбоорой</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold border-b border-white/[0.04]">
                  <span>Захиалга</span>
                  <span className="w-24 text-right">Дүн</span>
                  <span className="w-28 text-center">Төлөв</span>
                  <span className="w-20 text-right">Огноо</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {recentOrders.map((order) => {
                    const s = orderStatusMap[order.status] || orderStatusMap.pending
                    const date = new Date(order.created_at)
                    return (
                      <Link key={order.id} href={`/dashboard/orders/${order.id}`}
                        className={`hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-white/[0.03] transition-colors group border-l-2 ${s.border}`}>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                            {order.customers?.name || `#${order.order_number || order.id.slice(0, 8)}`}
                          </p>
                          {order.customers?.name && <p className="text-slate-600 text-[10px]">#{order.order_number || order.id.slice(0, 8)}</p>}
                        </div>
                        <p className="text-white text-sm font-medium w-24 text-right">{order.total_amount?.toLocaleString()}₮</p>
                        <div className="w-28 flex justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${s.bg} ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs w-20 text-right">{date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}</p>
                      </Link>
                    )
                  })}
                  {/* Mobile orders */}
                  {recentOrders.map((order) => {
                    const s = orderStatusMap[order.status] || orderStatusMap.pending
                    return (
                      <Link key={`m-${order.id}`} href={`/dashboard/orders/${order.id}`}
                        className={`md:hidden flex items-center gap-3 px-4 py-3 border-l-2 ${s.border}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium truncate">{order.customers?.name || `#${order.order_number || order.id.slice(0, 8)}`}</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${s.bg} ${s.text}`}>
                              <span className={`w-1 h-1 rounded-full ${s.dot}`} />{s.label}
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs mt-0.5">{new Date(order.created_at).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <span className="text-white text-sm font-medium shrink-0">{order.total_amount?.toLocaleString()}₮</span>
                        <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
