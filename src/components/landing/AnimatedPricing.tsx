'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const PLANS = [
  {
    name: 'Free',
    price: '0',
    desc: 'Туршиж үзэх',
    popular: false,
    features: [
      { text: '1 холбогдсон хуудас', included: true },
      { text: '100 AI мессеж/сар', included: true },
      { text: 'AI автомат хариулт', included: true },
      { text: 'Тайлан', included: false },
      { text: 'Comment auto reply', included: false },
      { text: 'Хүргэлтийн систем', included: false },
    ],
  },
  {
    name: 'Basic',
    price: '89,900',
    desc: 'Жижиг бизнест',
    popular: false,
    features: [
      { text: '1 холбогдсон хуудас', included: true },
      { text: '10,000 мессеж/сар', included: true },
      { text: 'AI автомат хариулт', included: true },
      { text: 'Бүтээгдэхүүн каталоги', included: true },
      { text: 'Захиалгын систем', included: true },
      { text: 'Дансаа холбож орлого хүлээн авах', included: true },
    ],
  },
  {
    name: 'Starter',
    price: '149,900',
    desc: 'Өсөж буй бизнест',
    popular: false,
    features: [
      { text: '1 холбогдсон хуудас', included: true },
      { text: '15,000 мессеж/сар', included: true },
      { text: 'AI автомат хариулт', included: true },
      { text: 'Бүтээгдэхүүн каталоги', included: true },
      { text: 'Захиалгын систем', included: true },
      { text: 'Comment auto reply + DM', included: true },
    ],
  },
  {
    name: 'Pro',
    price: '249,900',
    desc: 'Олон хуудас, бүрэн боломж',
    popular: true,
    features: [
      { text: '3 холбогдсон хуудас', included: true },
      { text: '30,000 мессеж/сар (нийт)', included: true },
      { text: 'AI автомат хариулт', included: true },
      { text: 'Comment auto reply + DM', included: true },
      { text: 'Хүргэлтийн систем интеграц', included: true },
      { text: 'Тэргүүлэх дэмжлэг', included: true },
    ],
  },
]

export default function AnimatedPricing() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
    >
      {PLANS.map((plan, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
          }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          className={`relative rounded-2xl p-6 transition-all duration-300 ${
            plan.popular
              ? 'bg-gradient-to-b from-blue-500/10 to-cyan-500/5 border-2 border-blue-500/50 shadow-xl shadow-blue-500/10 scale-[1.02]'
              : 'bg-white/[0.04] hover:bg-white/[0.07]'
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold rounded-full shadow-lg">
              Түгээмэл
            </div>
          )}
          <h3 className="text-lg font-semibold text-white mb-0.5">{plan.name}</h3>
          <p className="text-xs text-slate-500 mb-4">{plan.desc}</p>
          <div className="mb-6">
            <span className="text-4xl font-bold text-white">{plan.price}</span>
            <span className="text-slate-500 ml-1">₮/сар</span>
          </div>
          <ul className="space-y-2.5 mb-8">
            {plan.features.map((f, j) => (
              <li key={j} className={`flex items-center gap-2.5 text-sm ${f.included ? 'text-slate-300' : 'text-slate-600'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  f.included
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/[0.04] text-slate-600'
                }`}>
                  {f.included ? '✓' : '—'}
                </span>
                {f.text}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className={`block w-full py-3 text-center rounded-xl font-semibold transition-all text-sm ${
              plan.popular
                ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg'
                : 'bg-white/[0.06] hover:bg-white/[0.1] text-white'
            }`}
          >
            {plan.price === '0' ? 'Үнэгүй эхлэх' : 'Эхлэх'}
          </Link>
        </motion.div>
      ))}
    </motion.div>
  )
}
