'use client'

import { motion } from 'framer-motion'

function ChatCell() {
  const msgs = [
    { text: 'hooliig zahialya', from: 'user' },
    { text: '✅ Захиалга #2847 баталлаа!', from: 'ai' },
    { text: 'hedii irehve?', from: 'user' },
    { text: '25 минутад ирнэ 🚚', from: 'ai' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group relative col-span-2 row-span-2 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-white/[0.06] p-6 overflow-hidden hover:border-cyan-500/30 transition-all duration-500"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-[80px] group-hover:bg-cyan-500/20 transition-all duration-700" />
      <p className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1">AI Chatbot</p>
      <h3 className="text-lg font-bold text-white mb-4">24/7 автомат хариулт</h3>
      <div className="space-y-2">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: m.from === 'user' ? 20 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
              m.from === 'user'
                ? 'ml-auto bg-cyan-500/20 text-cyan-200'
                : 'mr-auto bg-white/[0.06] text-slate-200'
            }`}
          >
            {m.text}
          </motion.div>
        ))}
      </div>
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] text-green-400">1 сек хариулт</span>
      </div>
    </motion.div>
  )
}

function AnalyticsCell() {
  const bars = [30, 45, 35, 60, 50, 75, 65, 85, 70, 95, 80, 100]
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="group relative col-span-2 rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-white/[0.06] p-6 overflow-hidden hover:border-amber-500/30 transition-all duration-500"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[60px] group-hover:bg-amber-500/20 transition-all duration-700" />
      <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-1">Аналитик</p>
      <h3 className="text-lg font-bold text-white mb-1">Бодит цагийн тайлан</h3>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-white">₮48.7M</span>
        <span className="text-xs text-green-400 font-medium">+24%</span>
      </div>
      <div className="flex items-end gap-[3px] h-16">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.04 }}
            className="flex-1 origin-bottom rounded-sm bg-gradient-to-t from-amber-500/60 to-amber-400/30"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </motion.div>
  )
}

function DeliveryCell() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="group relative col-span-2 rounded-3xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-white/[0.06] p-6 overflow-hidden hover:border-violet-500/30 transition-all duration-500"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-[60px] group-hover:bg-violet-500/20 transition-all duration-700" />
      <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider mb-1">Хүргэлт</p>
      <h3 className="text-lg font-bold text-white mb-3">GPS трекинг</h3>
      <div className="space-y-2">
        {[
          { driver: 'Жолооч #1', status: 'Хүргэж байна', time: '8 мин', color: 'green' },
          { driver: 'Жолооч #3', status: 'Авч байна', time: '3 мин', color: 'blue' },
          { driver: 'Жолооч #5', status: 'Хүргэсэн', time: '✓', color: 'slate' },
        ].map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -15 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 + i * 0.12 }}
            className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${d.color === 'green' ? 'bg-green-400 animate-pulse' : d.color === 'blue' ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs text-slate-300">{d.driver}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">{d.status}</span>
              <span className={`text-xs font-medium ${d.color === 'green' ? 'text-green-400' : d.color === 'blue' ? 'text-blue-400' : 'text-slate-500'}`}>{d.time}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function ProductCell() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="group relative col-span-2 row-span-2 rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-white/[0.06] p-6 overflow-hidden hover:border-blue-500/30 transition-all duration-500"
    >
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/20 transition-all duration-700" />
      <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Бараа менежмент</p>
      <h3 className="text-lg font-bold text-white mb-4">AI автомат ангилал</h3>
      <div className="space-y-2.5">
        {[
          { emoji: '👟', name: 'Nike Air Max', cat: 'Гутал', conf: 98 },
          { emoji: '📱', name: 'Samsung Galaxy', cat: 'Утас', conf: 95 },
          { emoji: '💻', name: 'MacBook Pro', cat: 'Ноутбүүк', conf: 92 },
          { emoji: '👕', name: 'Uniqlo Цамц', cat: 'Хувцас', conf: 97 },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 group-hover:bg-white/[0.06] transition-colors"
          >
            <span className="text-lg">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
              <p className="text-[10px] text-slate-500">{item.cat}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${item.conf}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                />
              </div>
              <span className="text-[10px] text-blue-400 font-medium w-7">{item.conf}%</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

export default function BentoGrid() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Нэг платформ</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Бүгдийг нэг дороос
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Chatbot, бараа, захиалга, хүргэлт, аналитик — бүх зүйл нэг систем дотор
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto">
          <ChatCell />
          <ProductCell />
          <AnalyticsCell />
          <DeliveryCell />
        </div>
      </div>
    </section>
  )
}
