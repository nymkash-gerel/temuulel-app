'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function VercelHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
        {/* Radial fade */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,black_70%)]" />
      </div>

      {/* Top glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-500/[0.08] to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-[1200px] mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 mb-8"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[12px] text-zinc-400 tracking-wide uppercase">AI-аар тоноглогдсон</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.04em] max-w-3xl mx-auto"
        >
          Бизнесээ{' '}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            AI
          </span>
          -гаар
          <br />
          автоматжуул
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 text-[17px] leading-relaxed text-zinc-400 max-w-lg mx-auto"
        >
          Messenger, Instagram захиалга, хүргэлт, тайланг
          нэг дашбоардаас удирд. 24/7 AI чатбот.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-3"
        >
          <Link
            href="/signup"
            className="h-10 px-5 text-[14px] font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors inline-flex items-center gap-2"
          >
            Үнэгүй эхлэх
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="#demo"
            className="h-10 px-5 text-[14px] font-medium border border-zinc-800 text-zinc-300 rounded-lg hover:border-zinc-600 hover:text-white transition-all inline-flex items-center"
          >
            Туршиж үзэх
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex items-center justify-center gap-8 sm:gap-12"
        >
          {[
            { value: '500+', label: 'Бизнес' },
            { value: '1.2M+', label: 'AI мессеж' },
            { value: '24/7', label: 'Ажиллана' },
            { value: '95%', label: 'Зөв хариулт' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-lg sm:text-xl font-semibold text-white tracking-tight">{stat.value}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
    </section>
  )
}
