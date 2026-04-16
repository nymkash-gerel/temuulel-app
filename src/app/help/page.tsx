'use client'

import { useState } from 'react'
import Link from 'next/link'

const FAQ = [
  { q: 'Facebook Messenger-ыг яаж холбох вэ?', a: 'Dashboard → Тохиргоо → Холбоо. Facebook Page ID болон Page Access Token оруулна. Meta for Developers app-аас авна.' },
  { q: 'Instagram яаж холбох вэ?', a: 'Instagram Business Account ID хэрэгтэй. Facebook Business Manager дотор Instagram-ыг холбосны дараа ID-г авч болно.' },
  { q: 'Зураг илгээхэд AI таних уу?', a: 'Тийм. GPT-4o Vision ашиглан бүтээгдэхүүний зургийг Монголоор таньж, каталогаас ижил төрлийн бараа хайдаг.' },
  { q: 'Voice message хариулах уу?', a: 'Тийм. OpenAI Whisper-р Монгол voice-ыг транскрипт хийж, AI хариулдаг.' },
  { q: 'Captcha, хэт их мессежнээс хамгаалах уу?', a: 'Тийм. Rate limiting (Upstash), message limit per store, Facebook signature validation зэрэг хамгаалалттай.' },
  { q: 'AI буруу хариулвал яах вэ?', a: 'Dashboard → AI Суралцах хуудсаас "Хариулаагүй асуулт" жагсаалтыг харна. Зөв хариултыг Knowledge Base-д нэмэхэд AI мэддэг болно.' },
  { q: 'Мессежийн лимит хэтэрвэл?', a: 'Dashboard → Мессежийн хэрэглээ хуудаснаас нэмэлт pack (500-5000) худалдаж авна. Эсвэл дээд plan руу шилжинэ.' },
  { q: 'Өрсөлдөгч дэлгүүрийн зураг илгээвэл яах вэ?', a: 'AI тухайн бүтээгдэхүүнийг танихдаа манай каталогт ижил төрлийн бараа байгаа эсэхийг шалгана. Хэрэв категори таарсан бараа байхгүй бол "байхгүй" гэж шударгаар хэлнэ.' },
  { q: 'Хэрэглэгчтэй хүн нь ярилцах уу?', a: 'Тийм. Чат хуудсан дээр AI toggle дарвал "Оператор горим" идэвхжиж, 30 минутын турш хүн гараар хариулна. Дараа нь AI автомат буцна.' },
  { q: 'Нэмэлт feature-үүдийг яаж ашиглах вэ?', a: 'A/B Тест, Churn анализ, Broadcast кампани, Referral зэрэг бүгд sidebar дээр бий.' },
]

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? FAQ.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
    : FAQ

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">❓ Тусламж төв</h1>
          <p className="text-slate-400">Түгээмэл асуултууд ба гарын авлага</p>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Хайх..."
          className="w-full mb-8 px-5 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500"
        />

        <div className="space-y-3">
          {filtered.map((f, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-slate-800/50 transition-all"
              >
                <span className="font-medium">{f.q}</span>
                <span className="text-slate-500">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-slate-300 text-sm leading-relaxed">{f.a}</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-center">
          <h3 className="text-xl font-semibold mb-2">Хариулт олдсонгүй юу?</h3>
          <p className="text-slate-400 mb-4">support@temuulel.mn рүү email илгээнэ үү</p>
          <Link href="/dashboard" className="inline-block px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium">Dashboard-руу буцах</Link>
        </div>
      </div>
    </div>
  )
}
