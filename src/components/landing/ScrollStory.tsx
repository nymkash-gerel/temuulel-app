'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

const steps = [
  {
    icon: '💬',
    title: 'Хэрэглэгч бичнэ',
    desc: 'Messenger, Instagram, Telegram-аар мессеж ирнэ',
    detail: '"Нэг ширхэг Nike Air Max захиалмаар байна"',
    color: 'cyan',
  },
  {
    icon: '🤖',
    title: 'AI хариулна',
    desc: '1 секундэд бүтээгдэхүүн олж, үнэ мэдэгдэнэ',
    detail: '"Nike Air Max — ₮189,000. Размер сонгоно уу!"',
    color: 'blue',
  },
  {
    icon: '🛒',
    title: 'Захиалга үүснэ',
    desc: 'Төлбөр автомат баталгаажиж, dashboard-д бүртгэгдэнэ',
    detail: 'Захиалга #4821 — Төлбөр ✓ — QPay',
    color: 'violet',
  },
  {
    icon: '🚚',
    title: 'Хүргэлт эхэлнэ',
    desc: 'Хамгийн ойрын жолоочид автомат хуваарилна',
    detail: 'Жолооч #3 → GPS трекинг → 25 минут',
    color: 'green',
  },
  {
    icon: '📊',
    title: 'Тайлан шинэчлэгдэнэ',
    desc: 'Борлуулалт, хэрэглэгч, бараа — бүгд бодит цагт',
    detail: 'Өнөөдрийн борлуулалт: ₮2.4M (+18%)',
    color: 'amber',
  },
]

const colorClasses: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  violet: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', glow: 'shadow-violet-500/20' },
  green: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', glow: 'shadow-green-500/20' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
}

function StepCard({ step, index }: { step: typeof steps[number]; index: number }) {
  const c = colorClasses[step.color]
  return (
    <motion.div
      initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-2xl ${c.bg} border ${c.border} p-6 sm:p-8 backdrop-blur-sm shadow-lg ${c.glow} max-w-lg ${index % 2 === 0 ? 'mr-auto' : 'ml-auto'}`}
    >
      <div className="flex items-start gap-4">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', delay: 0.2 }}
          className={`flex-shrink-0 w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center text-2xl`}
        >
          {step.icon}
        </motion.div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${c.text}`}>0{index + 1}</span>
            <h3 className="text-lg font-bold text-white">{step.title}</h3>
          </div>
          <p className="text-sm text-slate-400 mb-3">{step.desc}</p>
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <p className="text-xs text-slate-300 font-mono">{step.detail}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function ScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })
  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section ref={containerRef} className="py-24 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Хэрхэн ажилладаг</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Мессежнээс <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">хүргэлт</span> хүртэл
          </h2>
          <p className="text-slate-400 text-lg">Бүх процесс автомат — та зөвхөн бизнесээ хөгжүүлнэ</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Animated line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/[0.06]">
            <motion.div
              style={{ height: lineHeight }}
              className="w-full bg-gradient-to-b from-cyan-500/80 via-blue-500/80 to-amber-500/80"
            />
          </div>

          {/* Steps */}
          <div className="space-y-12 sm:space-y-16 relative">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                {/* Center dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className={`absolute left-1/2 -translate-x-1/2 top-8 w-4 h-4 rounded-full ${colorClasses[step.color].bg} border-2 ${colorClasses[step.color].border} z-10 hidden sm:block`}
                />
                <StepCard step={step} index={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
