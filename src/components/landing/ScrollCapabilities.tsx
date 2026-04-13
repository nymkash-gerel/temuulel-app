'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

/* ------------------------------------------------------------------ */
/*  Products                                                           */
/* ------------------------------------------------------------------ */

const products = [
  {
    badge: 'Бараа менежмент',
    title: 'Бүтээгдэхүүнээ ухаалгаар удирд',
    description:
      'Excel, зураг, эсвэл гараар бүтээгдэхүүнээ оруулна. AI автомат ангилж, хэрэглэгчид зөв бүтээгдэхүүн санал болгоно.',
    features: ['Зургаар бүтээгдэхүүн таних', 'AI автомат ангилал', 'Үнэ, зураг хялбар оруулах'],
    visual: 'product' as const,
    color: 'blue',
  },
  {
    badge: 'Захиалга & Хүргэлт',
    title: 'Захиалгаас хүргэлт хүртэл автомат',
    description:
      'Захиалга авах, төлбөр баталгаажуулах, хүргэлтэд шилжүүлэх — бүгд нэг системээс. Жолоочийн апп, GPS трекинг, автомат хуваарилалт.',
    features: ['Захиалга → Төлбөр → Хүргэлт', 'GPS трекинг', 'Автомат хуваарилалт'],
    visual: 'automation' as const,
    color: 'violet',
  },
  {
    badge: 'Тайлан & Аналитик',
    title: 'Бизнесийн бүх тоог бодит цагт',
    description:
      'Борлуулалт, хэрэглэгчийн удирдлага, чатботын гүйцэтгэл, борлуулалттай бүтээгдэхүүн — бүгдийг нэг дашбоардаас хянана.',
    features: ['Борлуулалтын тайлан', 'Хэрэглэгчийн удирдлага', 'AI гүйцэтгэлийн тайлан'],
    visual: 'analytics' as const,
    color: 'amber',
  },
]

/* ------------------------------------------------------------------ */
/*  Illustrations                                                      */
/* ------------------------------------------------------------------ */

function ProductIllustration() {
  const items = [
    { name: 'Nike Air Max', category: 'Гутал', confidence: '98%' },
    { name: 'Samsung Galaxy', category: 'Утас', confidence: '95%' },
    { name: 'MacBook Pro', category: 'Ноутбүүк', confidence: '92%' },
  ]

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.12 }}
          className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center text-lg">
              {i === 0 ? '👟' : i === 1 ? '📱' : '💻'}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{item.name}</p>
              <p className="text-xs text-slate-500">AI ангилал: {item.category}</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            {item.confidence}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

function AutomationIllustration() {
  const steps = [
    { icon: '🛒', label: 'Захиалга ирлээ', status: 'done' },
    { icon: '💳', label: 'Төлбөр баталгаажсан', status: 'done' },
    { icon: '📦', label: 'Бэлтгэгдэж байна', status: 'active' },
    { icon: '🚚', label: 'Хүргэлтэд гарлаа', status: 'pending' },
  ]

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.15 }}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                step.status === 'done'
                  ? 'bg-violet-500/20'
                  : step.status === 'active'
                  ? 'bg-violet-500/30 ring-2 ring-violet-400/50'
                  : 'bg-white/[0.04]'
              }`}
            >
              {step.icon}
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.15 + 0.1 }}
                className="h-6 w-px origin-top bg-gradient-to-b from-violet-400/50 to-transparent"
              />
            )}
          </div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.15 }}
            className="pt-2"
          >
            <p className={`text-sm ${step.status === 'pending' ? 'text-slate-500' : 'text-slate-200'}`}>
              {step.label}
            </p>
          </motion.div>
        </div>
      ))}
    </div>
  )
}

function AnalyticsIllustration() {
  const stats = [
    { label: 'Өнөөдөр', value: '₮2.4M', change: '+18%' },
    { label: 'Энэ 7 хоног', value: '₮14.2M', change: '+12%' },
    { label: 'Энэ сар', value: '₮48.7M', change: '+24%' },
  ]

  return (
    <div className="space-y-3">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.12 }}
          className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3"
        >
          <div>
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="text-lg font-bold text-white">{stat.value}</p>
          </div>
          <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400">
            {stat.change}
          </span>
        </motion.div>
      ))}
      {/* Mini chart bars */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className="flex items-end justify-between gap-1 pt-2 px-2"
      >
        {[40, 65, 45, 80, 60, 90, 70, 95, 85, 100, 75, 88].map((h, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.03 }}
            className="w-full origin-bottom rounded-sm bg-gradient-to-t from-amber-500/40 to-amber-400/20"
            style={{ height: `${h * 0.5}px` }}
          />
        ))}
      </motion.div>
    </div>
  )
}

const illustrations = {
  product: ProductIllustration,
  automation: AutomationIllustration,
  analytics: AnalyticsIllustration,
}

const colorMap = {
  blue: { badge: 'bg-blue-500/15 text-blue-400', dot: 'bg-blue-400' },
  violet: { badge: 'bg-violet-500/15 text-violet-400', dot: 'bg-violet-400' },
  amber: { badge: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400' },
}

/* ------------------------------------------------------------------ */
/*  Product Section                                                    */
/* ------------------------------------------------------------------ */

function ProductSection({ index }: { index: number }) {
  const product = products[index]
  const Illustration = illustrations[product.visual]
  const colors = colorMap[product.color as keyof typeof colorMap]
  const isEven = index % 2 === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${isEven ? '' : 'lg:direction-rtl'}`}
    >
      {/* Text side */}
      <div className={`space-y-5 ${isEven ? '' : 'lg:order-2'}`}>
        <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${colors.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
          {product.badge}
        </span>

        <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {product.title}
        </h3>

        <p className="text-base leading-relaxed text-slate-400">
          {product.description}
        </p>

        <ul className="space-y-2 pt-2">
          {product.features.map((f, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-2.5 text-sm text-slate-300"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs">✓</span>
              {f}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Visual side */}
      <div className={`rounded-2xl bg-white/[0.03] p-6 sm:p-8 ${isEven ? '' : 'lg:order-1'}`}>
        <Illustration />
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ScrollCapabilities() {
  const containerRef = useRef<HTMLDivElement>(null)

  useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  return (
    <section
      ref={containerRef}
      className="relative bg-slate-950 px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-24 text-center"
        >
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Бүтээгдэхүүн</p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Таны бизнест хэрэгтэй бүх зүйл
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Чатбот, бараа менежмент, захиалга, хүргэлт, тайлан — бүгдийг нэг платформоос
          </p>
        </motion.div>

        {/* Products */}
        <div className="space-y-24 lg:space-y-32">
          {products.map((_, i) => (
            <ProductSection key={i} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
