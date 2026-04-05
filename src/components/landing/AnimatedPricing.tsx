'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const PLANS = [
  {
    name: 'Free',
    price: '0',
    desc: 'Туршиж эхлэх',
    popular: false,
    features: [
      { text: '500 AI мессеж/сар', included: true },
      { text: '20 бүтээгдэхүүн', included: true },
      { text: '1 хэрэглэгч', included: true },
      { text: '1 суваг (Messenger)', included: true },
      { text: 'Тайлан', included: false },
      { text: 'Жолоочийн апп', included: false },
    ],
  },
  {
    name: 'Basic',
    price: '99,000',
    desc: 'Жижиг бизнест',
    popular: false,
    features: [
      { text: '15,000 AI мессеж/сар', included: true },
      { text: '300 бүтээгдэхүүн', included: true },
      { text: '3 хэрэглэгч', included: true },
      { text: '2 суваг', included: true },
      { text: 'Үндсэн тайлан', included: true },
      { text: 'Жолоочийн апп', included: false },
    ],
  },
  {
    name: 'Pro',
    price: '199,000',
    desc: 'Өсөж буй бизнест',
    popular: true,
    features: [
      { text: '50,000 AI мессеж', included: true },
      { text: 'Unlimited бүтээгдэхүүн', included: true },
      { text: '10 хэрэглэгч', included: true },
      { text: 'Бүх суваг', included: true },
      { text: 'Бүрэн тайлан & аналитик', included: true },
      { text: 'Жолоочийн апп + GPS', included: true },
    ],
  },
  {
    name: 'Enterprise',
    price: '399,000',
    desc: 'Том бизнест',
    popular: false,
    features: [
      { text: '200,000 AI мессеж', included: true },
      { text: 'Unlimited бүтээгдэхүүн', included: true },
      { text: 'Unlimited хэрэглэгч', included: true },
      { text: 'Бүх суваг + API', included: true },
      { text: 'Бүрэн тайлан & аналитик', included: true },
      { text: 'Жолоочийн апп + GPS + автомат хуваарилалт', included: true },
    ],
  },
]

export default function AnimatedPricing() {
  return (
    <div className="relative py-24 sm:py-32">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-[12px] font-medium text-amber-400 uppercase tracking-widest mb-3">Үнэ</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em]">Энгийн, ил тод үнэ</h2>
          <p className="mt-3 text-[15px] text-zinc-500 max-w-md mx-auto">
            Бизнесийнхээ хэмжээнд тохирсон багц сонго
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-800"
        >
          {PLANS.map((plan, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
              }}
              className={`relative bg-black p-8 hover:bg-zinc-950 transition-colors group ${
                plan.popular ? 'ring-1 ring-blue-500/30 bg-blue-500/[0.02]' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute top-4 right-4 px-2.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-medium rounded-full border border-blue-500/20">
                  Түгээмэл
                </div>
              )}
              <h3 className="text-[15px] font-semibold text-white mb-1">{plan.name}</h3>
              <p className="text-[12px] text-zinc-600 mb-5">{plan.desc}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-white tracking-tight">{plan.price}</span>
                <span className="text-zinc-600 text-[13px] ml-1">₮/сар</span>
              </div>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className={`flex items-center gap-2.5 text-[13px] ${f.included ? 'text-zinc-400' : 'text-zinc-700'}`}>
                    {f.included ? (
                      <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-zinc-700 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                      </svg>
                    )}
                    {f.text}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`block w-full h-9 text-[13px] font-medium rounded-lg transition-all flex items-center justify-center ${
                  plan.popular
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white'
                }`}
              >
                {plan.price === '0' ? 'Үнэгүй эхлэх' : 'Эхлэх'}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
    </div>
  )
}
