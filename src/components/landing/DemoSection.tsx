'use client'

import { useState } from 'react'
import { DEMO_SECTORS } from '@/lib/demo-data'
import DemoChatWidget from '@/components/ui/DemoChatWidget'

export default function DemoSection() {
  const [activeSector, setActiveSector] = useState(DEMO_SECTORS[0])

  return (
    <section id="demo" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Туршиж үзэх
          </h2>
          <p className="text-slate-400 text-lg">
            Салбараа сонгоод AI чатботыг туршаарай
          </p>
        </div>

        {/* Sector tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {DEMO_SECTORS.map((sector) => (
            <button
              key={sector.id}
              onClick={() => setActiveSector(sector)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeSector.id === sector.id
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {sector.icon} {sector.name}
            </button>
          ))}
        </div>

        {/* Widget preview */}
        <div className="max-w-md mx-auto">
          <DemoChatWidget key={activeSector.id} sector={activeSector} />
        </div>

        {/* CTA under demo */}
        <div className="text-center mt-10">
          <p className="text-slate-400 text-sm mb-4">
            Таны бизнест тохирсон AI чатбот бэлэн
          </p>
          <a
            href="/signup"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            Үнэгүй эхлэх
          </a>
        </div>
      </div>
    </section>
  )
}
