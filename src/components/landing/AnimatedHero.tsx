'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function AnimatedHero() {
  return (
    <section className="pb-24 px-4 relative">
      <div className="max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-8 tracking-wide uppercase"
        >
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          AI-аар тоноглогдсон платформ
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight"
        >
          Бизнесийн{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400">
            ухаалаг туслах
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Messenger, Instagram дээрх захиалга, асуулт, гомдлыг AI автоматаар шийдэнэ.
          24/7 ажиллана. Монгол хэлээр.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link
            href="/signup"
            className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-2xl transition-all text-lg shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            Үнэгүй эхлэх
            <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="#demo"
            className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl transition-all text-lg backdrop-blur-sm"
          >
            Туршиж үзэх
          </Link>
        </motion.div>

        {/* Social proof stats — staggered */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.6 } } }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-16"
        >
          {[
            { value: '50+', label: 'Бизнес' },
            { value: '100K+', label: 'AI мессеж/сар' },
            { value: '24/7', label: 'Ажиллана' },
            { value: '95%', label: 'Зөв хариулт' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
              className="text-center"
            >
              <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
