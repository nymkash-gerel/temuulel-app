'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { DEMO_SECTORS } from '@/lib/demo-data'
import DemoChatWidget from '@/components/ui/DemoChatWidget'

export default function DemoSection() {
  const [activeSector, setActiveSector] = useState(DEMO_SECTORS[0])

  return (
    <section id="demo" className="relative py-24 sm:py-32">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-[12px] font-medium text-purple-400 uppercase tracking-widest mb-3">Туршилт</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em]">Туршиж үзэх</h2>
          <p className="mt-3 text-[15px] text-zinc-500 max-w-md mx-auto">
            Салбараа сонгоод AI чатботыг туршаарай
          </p>
        </motion.div>

        {/* Sector tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {DEMO_SECTORS.map((sector) => (
            <button
              key={sector.id}
              onClick={() => setActiveSector(sector)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                activeSector.id === sector.id
                  ? 'bg-white text-black'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
              }`}
            >
              {sector.icon} {sector.name}
            </button>
          ))}
        </div>

        {/* Widget preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto"
        >
          <DemoChatWidget key={activeSector.id} sector={activeSector} />
        </motion.div>

        {/* CTA under demo */}
        <div className="text-center mt-12">
          <p className="text-zinc-500 text-[13px] mb-5">
            Таны бизнест тохирсон AI чатбот бэлэн
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/signup"
              className="h-10 px-5 text-[14px] font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors inline-flex items-center"
            >
              Үнэгүй эхлэх
            </a>
            <a
              href="/demo"
              className="h-10 px-5 text-[14px] font-medium border border-zinc-800 text-zinc-300 rounded-lg hover:border-zinc-600 hover:text-white transition-all inline-flex items-center"
            >
              Бүх flow туршиж үзэх
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
    </section>
  )
}
