'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function VercelCTA() {
  return (
    <section className="relative py-32 sm:py-40">
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-500/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-[1200px] mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl sm:text-5xl font-bold tracking-[-0.04em]"
        >
          Бизнесээ{' '}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            өнөөдөр
          </span>{' '}
          эхлүүл
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-4 text-[15px] text-zinc-500 max-w-md mx-auto"
        >
          Картын мэдээлэл шаардахгүй. Үнэгүй туршилт.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <Link
            href="/signup"
            className="h-11 px-6 text-[14px] font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors inline-flex items-center gap-2"
          >
            Үнэгүй бүртгүүлэх
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
    </section>
  )
}
