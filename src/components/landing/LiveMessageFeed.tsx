'use client'

import { useEffect, useRef, useState } from 'react'

const CHAT_MESSAGES = [
  { q: 'hurgelт hedii irehve?', a: 'Таны захиалга #4821 40 минутад ирнэ 🚚' },
  { q: 'ene baraa bii yu?', a: '3 төрөл нөөцөд байна. Үзэх үү?' },
  { q: 'une hediive', a: 'Ноолууран цамц 189,000₮ — S, M, L хэмжээтэй ✨' },
  { q: 'Цаг захиалмаар байна', a: 'Маргааш 14:00 чөлөөтэй. Захиалах уу? 📅' },
  { q: 'Өнөөдрийн цэс юу байна?', a: 'Бууз ланч 15,000₮, Хуушуур сет 12,000₮ 🍜' },
  { q: 'Буцаалт хийж болох уу?', a: '14 хоногийн дотор буцаалт хүлээн авна ✅' },
  { q: 'latte 2sh avya', a: 'Латте x2 сагсанд нэмлээ. Нийт: 12,000₮ ☕' },
  { q: 'Төлбөр яаж хийх вэ?', a: 'QPay QR код илгээлээ. Банкны апп-р скан хийнэ үү 📱' },
  { q: 'Вегетариан цэс бий юу?', a: 'Тофу хуурга 10,000₮, Ногоон салат 8,000₮ 🥗' },
  { q: 'Хүргэлт үнэгүй юу?', a: '100,000₮-с дээш захиалгад ҮНЭГҮЙ 🎉' },
  { q: '2 өрөө орон сууц хайж байна', a: 'Баянгол 85 сая₮, Сүхбаатар 120 сая₮ — 3 сонголт 🏠' },
  { q: 'Шүдний эмчид үзүүлмээр байна', a: 'Маргааш 10:00, 14:00, 16:00 чөлөөтэй 🦷' },
]

function FlowingChat() {
  const doubled = [...CHAT_MESSAGES, ...CHAT_MESSAGES]
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Inject keyframes into document
    const id = 'temuulel-chat-scroll'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = '@keyframes chatScrollUp{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}'
      document.head.appendChild(s)
    }
    // Apply animation via ref to guarantee it works
    if (scrollRef.current) {
      scrollRef.current.style.animation = 'chatScrollUp 25s linear infinite'
    }
  }, [])

  return (
    <div className="relative h-[420px] overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-700/50">
      {/* Gradient masks */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900 to-transparent z-10 pointer-events-none" />

      <div ref={scrollRef} className="px-4 py-3">
        {doubled.map((msg, i) => (
          <div key={i} className="mb-3">
            {/* User bubble */}
            <div className="flex justify-end mb-1.5">
              <div className="bg-blue-600/90 text-white text-sm px-3 py-2 rounded-2xl rounded-br-sm max-w-[75%]">
                {msg.q}
              </div>
            </div>
            {/* AI bubble */}
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700/50 text-slate-200 text-sm px-3 py-2 rounded-2xl rounded-bl-sm max-w-[75%]">
                {msg.a}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LiveMessageFeed() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto h-[500px]" />
      </section>
    )
  }

  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Таны бизнест хэрэгтэй бүх зүйл
          </h2>
          <p className="text-slate-400 text-lg">
            Чатбот, бараа менежмент, захиалга, хүргэлт, тайлан — бүгдийг нэг платформоос
          </p>
        </div>

        {/* AI Chatbot feature — left text, right flowing chat */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Left: description */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-5">
              <span className="text-blue-400 text-xs font-semibold tracking-wide uppercase">AI Chatbot</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Хэрэглэгчтэй 24/7 ярилцана
            </h3>
            <p className="text-slate-400 text-base leading-relaxed mb-6">
              Messenger, Instagram, Telegram дээр ирсэн бүх мессежийг AI автоматаар хариулна.
              Бүтээгдэхүүний мэдээлэл, үнэ, захиалгын төлөв — бүгдийг монгол хэлээр.
            </p>

            <div className="space-y-3">
              {[
                'Монгол хэл 100% ойлгоно',
                'Кирилл + Латин хоёуланг',
                '1 секундэд хариулна',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <span className="text-slate-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: flowing chat */}
          <FlowingChat />
        </div>
      </div>
    </section>
  )
}
