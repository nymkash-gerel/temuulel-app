'use client'

import { motion } from 'framer-motion'

const STEPS = [
  { step: '01', title: 'Бүртгүүлэх', desc: 'Имэйл эсвэл Google-ээр бүртгүүлээд дэлгүүрийнхээ мэдээллийг оруулна' },
  { step: '02', title: 'Бараагаа нэмэх', desc: 'Excel, зураг, эсвэл гараар бүтээгдэхүүнээ оруулна. AI автомат ангилна' },
  { step: '03', title: 'Messenger холбох', desc: 'Facebook Page-ээ холбоод AI чатбот шууд ажиллаж эхэлнэ' },
]

export default function AnimatedSteps() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
      className="grid grid-cols-1 md:grid-cols-3 gap-8"
    >
      {STEPS.map((item, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 25 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
          }}
          className="relative text-center"
        >
          <div className="text-5xl font-black text-white/5 mb-4">{item.step}</div>
          <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}
