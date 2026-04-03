'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

function AnimatedNumber({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    const duration = 2000
    const startTime = Date.now()
    const step = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target])

  return (
    <span ref={ref}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  )
}

const stats = [
  { value: 500, suffix: '+', label: 'Бизнес итгэл хүлээсэн', icon: '🏢' },
  { value: 1200000, suffix: '+', label: 'Мессеж боловсруулсан', icon: '💬' },
  { value: 50000, suffix: '+', label: 'Захиалга амжилттай', icon: '📦' },
  { value: 1, suffix: ' сек', label: 'Дундаж хариулах хугацаа', icon: '⚡' },
]

export default function AnimatedStats() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 text-center overflow-hidden hover:border-blue-500/30 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <span className="text-2xl mb-3 block">{stat.icon}</span>
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1">
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs sm:text-sm text-slate-500">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
