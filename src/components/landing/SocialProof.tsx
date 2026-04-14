'use client'

import { useEffect, useRef } from 'react'

const CLIENTS = [
  { name: 'Номин Ресторан', type: 'Ресторан' },
  { name: 'Bella Beauty Salon', type: 'Гоо сайхан' },
  { name: 'FitZone Gym', type: 'Фитнесс' },
  { name: 'Кофе Хаус', type: 'Кофе шоп' },
  { name: 'Монгол Маркет', type: 'Онлайн дэлгүүр' },
  { name: 'Green Home Realty', type: 'Үл хөдлөх' },
  { name: 'Хустай Кемпинг', type: 'Кемпинг' },
  { name: 'Эрүүл Амьдрал', type: 'Эмнэлэг' },
]

const STATS = [
  { value: '50+', label: 'Бизнес ашиглаж байна' },
  { value: '1.2M+', label: 'Мессеж боловсруулсан' },
  { value: '50,000+', label: 'Захиалга амжилттай' },
]

export default function SocialProof() {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = 'temuulel-logo-scroll'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = '@keyframes logoScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}'
      document.head.appendChild(s)
    }
    if (scrollRef.current) {
      scrollRef.current.style.animation = 'logoScroll 25s linear infinite'
    }
  }, [])

  const doubled = [...CLIENTS, ...CLIENTS]

  return (
    <section className="py-16 px-4 border-t border-b border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-10 mb-12">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Label */}
        <p className="text-center text-xs text-slate-500 uppercase tracking-widest mb-6">
          Тэдний борлуулалт аль хэдийн автоматжсан
        </p>

        {/* Scrolling client logos */}
        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

          <div ref={scrollRef} className="flex gap-8 whitespace-nowrap">
            {doubled.map((client, i) => (
              <div
                key={i}
                className="flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-lg font-bold text-blue-400">
                  {client.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{client.name}</p>
                  <p className="text-xs text-slate-500">{client.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
