'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

export default function BeforeAfterSlider() {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setPosition((x / rect.width) * 100)
  }

  const handleMouseDown = () => { isDragging.current = true }
  const handleMouseUp = () => { isDragging.current = false }
  const handleMouseMove = (e: React.MouseEvent) => { if (isDragging.current) handleMove(e.clientX) }
  const handleTouchMove = (e: React.TouchEvent) => { handleMove(e.touches[0].clientX) }

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
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Хуучин vs Шинэ</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Temuulel-ийн <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">ялгаа</span>
          </h2>
          <p className="text-slate-400 text-lg">Slider-ийг чирж харьцуулаарай</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          ref={containerRef}
          className="relative w-full rounded-2xl overflow-hidden cursor-col-resize select-none border border-white/10"
          style={{ minHeight: '700px' }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          {/* BEFORE - Left side (Old way) */}
          <div className="absolute inset-0 bg-[#e4e6eb]">
            <div className="absolute inset-0 flex flex-col p-4 sm:p-8">
              <div className="w-full max-w-lg mx-auto space-y-4">

                {/* Facebook Messenger UI */}
                <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                  {/* Messenger header */}
                  <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="ml-2 text-xs text-gray-500 font-medium">Messenger</span>
                  </div>
                  {/* Messenger sidebar + chat */}
                  <div className="flex">
                    {/* Mini sidebar */}
                    <div className="w-[140px] border-r border-gray-100 p-2 space-y-1.5 hidden sm:block">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">Б</div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-gray-800 truncate">Батаа</p>
                          <p className="text-[9px] text-red-500 font-medium">une hed ve??</p>
                        </div>
                      </div>
                      {[
                        { name: 'Сараа', msg: 'baraa irsen u?', color: 'from-pink-400 to-rose-500' },
                        { name: 'Дулмаа', msg: 'hariulahgui bn u', color: 'from-purple-400 to-violet-500' },
                        { name: 'Төгөө', msg: 'zahialga hedii', color: 'from-orange-400 to-red-500' },
                        { name: 'Мөнхөө', msg: 'butsaalt hiine', color: 'from-green-400 to-emerald-500' },
                      ].map((c, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-white text-[10px] font-bold`}>{c.name[0]}</div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium text-gray-700 truncate">{c.name}</p>
                            <p className="text-[9px] text-gray-400 truncate">{c.msg}</p>
                          </div>
                          <div className="ml-auto w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                    {/* Chat area */}
                    <div className="flex-1 p-3 space-y-2 min-h-[200px]">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">Б</div>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-800">Батаа</p>
                          <p className="text-[9px] text-green-500">Идэвхтэй</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">📞</div>
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">📹</div>
                        </div>
                      </div>
                      {/* Messages */}
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5 items-end">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0" />
                          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-1.5 max-w-[75%]">
                            <p className="text-[11px] text-gray-800">une hediive??</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 items-end">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0" />
                          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-1.5 max-w-[75%]">
                            <p className="text-[11px] text-gray-800">baraa baigaa yu??</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 items-end">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0" />
                          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-1.5 max-w-[75%]">
                            <p className="text-[11px] text-red-500">hariulahgui bna uu?? 😡</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-center text-gray-400 py-1">2 цагийн өмнө</p>
                        <div className="flex gap-1.5 items-end">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0" />
                          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-1.5 max-w-[75%]">
                            <p className="text-[11px] text-gray-800">za hariu ogs?</p>
                          </div>
                        </div>
                      </div>
                      {/* Unread badge */}
                      <div className="flex items-center justify-center">
                        <span className="px-3 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold">47 хариулаагүй мессеж</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real Excel UI */}
                <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                  {/* Excel header bar */}
                  <div className="bg-[#217346] px-3 py-1.5 flex items-center gap-2">
                    <span className="text-white text-[10px] font-medium">📊 Excel</span>
                    <span className="text-white/60 text-[10px]">— Захиалга_2024.xlsx</span>
                  </div>
                  {/* Formula bar */}
                  <div className="bg-gray-50 px-2 py-1 flex items-center gap-2 border-b border-gray-200">
                    <span className="text-[9px] text-gray-500 bg-white px-2 py-0.5 border border-gray-200">D7</span>
                    <span className="text-[9px] text-gray-600 italic">fx</span>
                    <span className="text-[9px] text-red-500">=#REF!</span>
                  </div>
                  {/* Spreadsheet grid */}
                  <div className="overflow-hidden">
                    <table className="w-full text-[9px]">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-200 px-2 py-1 text-gray-400 font-normal w-6"></th>
                          <th className="border border-gray-200 px-2 py-1 text-gray-500 font-medium">A</th>
                          <th className="border border-gray-200 px-2 py-1 text-gray-500 font-medium">B</th>
                          <th className="border border-gray-200 px-2 py-1 text-gray-500 font-medium">C</th>
                          <th className="border border-gray-200 px-2 py-1 text-gray-500 font-medium">D</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-[#217346]/10">
                          <td className="border border-gray-200 px-2 py-1 text-gray-400 text-center">1</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-700 font-medium">Нэр</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-700 font-medium">Утас</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-700 font-medium">Бараа</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-700 font-medium">Төлөв</td>
                        </tr>
                        {[
                          ['2', 'Батаа', '9911****', 'Nike Air Max', '?'],
                          ['3', 'Сараа', '8801****', 'Цамц XL', 'Хүлээгд...'],
                          ['4', '???', '', 'Цүнх', '#REF!'],
                          ['5', 'Дулмаа', '9505****', '', 'Алдаа'],
                          ['6', '', '8800????', 'Гутал?', ''],
                        ].map((row, i) => (
                          <tr key={i} className={i === 2 || i === 4 ? 'bg-red-50' : ''}>
                            <td className="border border-gray-200 px-2 py-1 text-gray-400 text-center">{row[0]}</td>
                            <td className="border border-gray-200 px-2 py-1 text-gray-600">{row[1]}</td>
                            <td className="border border-gray-200 px-2 py-1 text-gray-600">{row[2]}</td>
                            <td className="border border-gray-200 px-2 py-1 text-gray-600">{row[3]}</td>
                            <td className={`border border-gray-200 px-2 py-1 ${row[4] === '#REF!' || row[4] === 'Алдаа' ? 'text-red-500 font-medium' : 'text-gray-500'}`}>{row[4]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Driver SMS message */}
                <div className="rounded-xl bg-white shadow-sm p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">🚗</div>
                    <div>
                      <p className="text-[11px] text-gray-700 font-medium">Жолооч Ганаа</p>
                      <p className="text-[9px] text-gray-400">Мессеж • Одоо</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-100 px-3 py-2">
                    <p className="text-[11px] text-gray-700">Ене дугаар утсаа авахгүй байна, chat бичээд өгөөч 🙏</p>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-100 text-[9px] text-red-600">📵 3 удаа залгасан</span>
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-[9px] text-orange-600">⏳ 20 мин хүлээсэн</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BEFORE label */}
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-red-500/90 text-xs font-semibold text-white shadow-lg">
              ❌ Өмнө нь
            </div>
          </div>

          {/* AFTER - Right side (Temuulel) */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-950 to-blue-950/80"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            <div className="absolute inset-0 flex flex-col p-4 sm:p-8">
              <div className="w-full max-w-lg mx-auto space-y-4">
                {/* AI Chat — Temuulel style */}
                <div className="rounded-xl bg-white/[0.06] border border-blue-500/20 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm">🤖</div>
                    <div>
                      <p className="text-xs text-blue-400 font-semibold">Temuulel AI</p>
                      <p className="text-[10px] text-blue-400/50">Бүх мессеж автомат хариулсан</p>
                    </div>
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-green-500/20 text-[10px] text-green-400 font-medium">✓ 0 хүлээгдэж буй</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="bg-blue-500/10 rounded-2xl rounded-br-md px-3 py-1.5 text-[11px] text-blue-200 ml-auto max-w-[70%]">une hediive</div>
                    <div className="bg-white/[0.06] rounded-2xl rounded-bl-md px-3 py-1.5 text-[11px] text-cyan-300 max-w-[80%]">Nike Air Max — ₮189,000. Захиалах уу? 👟</div>
                    <div className="bg-blue-500/10 rounded-2xl rounded-br-md px-3 py-1.5 text-[11px] text-blue-200 ml-auto max-w-[70%]">tiim zahialya</div>
                    <div className="bg-white/[0.06] rounded-2xl rounded-bl-md px-3 py-1.5 text-[11px] text-green-300 max-w-[80%]">✅ Захиалга #4821 баталлаа! QPay линк илгээлээ</div>
                  </div>
                  <p className="text-[9px] text-blue-400/40 text-right mt-2">Хариулсан хугацаа: 0.8 сек</p>
                </div>

                {/* Dashboard */}
                <div className="rounded-xl bg-white/[0.06] border border-blue-500/20 p-4 backdrop-blur-sm">
                  <p className="text-xs text-blue-400 font-semibold mb-3">📊 Бодит цагийн Dashboard</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Өнөөдөр', value: '₮2.4M', change: '+18%' },
                      { label: '7 хоног', value: '₮14.2M', change: '+12%' },
                      { label: 'Сар', value: '₮48.7M', change: '+24%' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg bg-white/[0.04] p-2 text-center">
                        <p className="text-[9px] text-slate-500">{s.label}</p>
                        <p className="text-sm font-bold text-white">{s.value}</p>
                        <p className="text-[9px] text-green-400">{s.change}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-[2px] h-14">
                    {[30, 45, 35, 60, 50, 75, 65, 85, 70, 95, 80, 100].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-blue-500/60 to-cyan-400/40" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>

                {/* GPS delivery tracking */}
                <div className="rounded-xl bg-white/[0.06] border border-blue-500/20 p-4 backdrop-blur-sm">
                  <p className="text-xs text-blue-400 font-semibold mb-2">🚚 Хүргэлтийн трекинг</p>
                  <div className="space-y-2">
                    {[
                      { name: 'Жолооч #1', status: 'Хүргэж байна', time: '8 мин', active: true },
                      { name: 'Жолооч #3', status: 'Авч байна', time: '3 мин', active: true },
                      { name: 'Жолооч #5', status: 'Хүргэсэн ✓', time: 'Дууссан', active: false },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${d.active ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                          <span className="text-[11px] text-slate-300">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{d.status}</span>
                        <span className={`text-[10px] font-medium ${d.active ? 'text-green-400' : 'text-slate-500'}`}>{d.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AFTER label */}
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-blue-500/90 text-xs font-semibold text-white shadow-lg">
              ✨ Temuulel-тэй
            </div>
          </div>

          {/* Slider handle */}
          <div
            className="absolute top-0 bottom-0 z-20 flex items-center"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-[2px] h-full bg-white/60 shadow-lg shadow-white/20" />
            <div className="absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-xl shadow-white/30 flex items-center justify-center cursor-col-resize">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M5 3L2 8L5 13" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 3L14 8L11 13" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
