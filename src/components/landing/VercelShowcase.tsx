'use client'

import { motion } from 'framer-motion'

const chatMessages = [
  { from: 'user', text: 'хар даашинз байна уу' },
  { from: 'ai', text: 'Тийм! Хар өнгийн даашинз 3 төрөл байна. S-XXL размер. Үнэ: 39,000-59,000₮' },
  { from: 'user', text: 'M размер авъя' },
  { from: 'ai', text: 'Захиалга #2847 бүртгэгдлээ! Нэр, утас, хаягаа бичнэ үү.' },
]

const orderSteps = [
  { step: '01', title: 'Мессеж ирнэ', status: 'done' },
  { step: '02', title: 'AI хариулна', status: 'done' },
  { step: '03', title: 'Захиалга үүснэ', status: 'done' },
  { step: '04', title: 'Төлбөр баталгаажна', status: 'active' },
  { step: '05', title: 'Хүргэлтэнд гарна', status: 'pending' },
]

export default function VercelShowcase() {
  return (
    <section id="showcase" className="relative py-24 sm:py-32">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-[12px] font-medium text-emerald-400 uppercase tracking-widest mb-3">Платформ</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em]">Хэрхэн ажилладаг</h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Chat preview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="ml-2 text-[11px] text-zinc-500">Messenger — Sunny Store</span>
            </div>
            <div className="p-5 space-y-3">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                  className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2 rounded-xl text-[13px] leading-relaxed ${
                      msg.from === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              <div className="flex justify-start">
                <div className="flex items-center gap-1 px-3 py-1.5">
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Order flow */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="ml-2 text-[11px] text-zinc-500">Захиалгын урсгал</span>
            </div>
            <div className="p-5">
              <div className="space-y-0">
                {orderSteps.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-4 py-3"
                  >
                    <div className="relative">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold ${
                          s.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : s.status === 'active'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                        }`}
                      >
                        {s.status === 'done' ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          s.step
                        )}
                      </div>
                      {i < orderSteps.length - 1 && (
                        <div className={`absolute left-1/2 top-8 w-px h-3 -translate-x-1/2 ${
                          s.status === 'done' ? 'bg-emerald-500/30' : 'bg-zinc-800'
                        }`} />
                      )}
                    </div>
                    <span className={`text-[13px] ${
                      s.status === 'pending' ? 'text-zinc-600' : 'text-zinc-300'
                    }`}>
                      {s.title}
                    </span>
                    {s.status === 'active' && (
                      <span className="ml-auto text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        Идэвхтэй
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Mini dashboard */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: 'Өнөөдөр', value: '₮2.4M', change: '+18%' },
                  { label: '7 хоног', value: '₮14.2M', change: '+12%' },
                  { label: 'Энэ сар', value: '₮48.7M', change: '+24%' },
                ].map((d, i) => (
                  <div key={i} className="rounded-lg bg-zinc-900/50 border border-zinc-800/50 p-3">
                    <p className="text-[10px] text-zinc-600">{d.label}</p>
                    <p className="text-[14px] font-semibold text-white mt-0.5">{d.value}</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">{d.change}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
    </section>
  )
}
