'use client'

import { motion } from 'framer-motion'
import { VanillaTiltCard } from './VanillaTiltCard'

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Chatbot',
    desc: 'Монгол хэл дээр бүтээгдэхүүн хайх, захиалга авах, асуултанд хариулах',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: '📦',
    title: 'Бараа менежмент',
    desc: 'Бараагаа нэмэх, ангилах, үнэ тохируулах — бүгд нэг дороос',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: '💬',
    title: 'Олон суваг',
    desc: 'Facebook Messenger, Instagram DM, Telegram нэг дашбоардаас',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    icon: '📊',
    title: 'Шууд тайлан',
    desc: 'Борлуулалт, хэрэглэгч, чатботын тайланг бодит цагаар хянах',
    gradient: 'from-orange-500/20 to-yellow-500/20',
  },
  {
    icon: '🚚',
    title: 'Хүргэлтийн систем',
    desc: 'Жолоочийн апп, GPS трекинг, автомат хуваарилалт',
    gradient: 'from-red-500/20 to-orange-500/20',
  },
  {
    icon: '🌐',
    title: '100% Монгол',
    desc: 'Кирилл, Латин, хэлц үг, товчлол бүгдийг ойлгоно',
    gradient: 'from-teal-500/20 to-cyan-500/20',
  },
]

const cardClass = 'group relative bg-white/[0.04] rounded-2xl p-6 hover:bg-white/[0.07] transition-all duration-300'

export default function FeatureCards() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {FEATURES.map((feature, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
          }}
        >
          <VanillaTiltCard className={cardClass}>
            <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
              <span className="text-2xl">{feature.icon}</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
          </VanillaTiltCard>
        </motion.div>
      ))}
    </motion.div>
  )
}
