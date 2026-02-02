'use client'

import { useState } from 'react'
import Link from 'next/link'
import FlowDemoChat from '@/components/demo/FlowDemoChat'

interface BusinessCard {
  type: string
  name: string
  icon: string
  description: string
  accentColor: string
  storeName: string
}

const BUSINESS_TYPES: BusinessCard[] = [
  { type: 'restaurant', name: 'Ресторан', icon: '🍜', description: 'Хоол захиалга', accentColor: '#ef4444', storeName: 'Номин Ресторан' },
  { type: 'hospital', name: 'Эмнэлэг', icon: '🏥', description: 'Цаг захиалга', accentColor: '#06b6d4', storeName: 'Эрүүл Амьдрал Эмнэлэг' },
  { type: 'beauty_salon', name: 'Гоо сайхан', icon: '💇', description: 'Үйлчилгээ захиалга', accentColor: '#ec4899', storeName: 'Bella Beauty Salon' },
  { type: 'coffee_shop', name: 'Кофе шоп', icon: '☕', description: 'Кофе захиалга', accentColor: '#f59e0b', storeName: 'Urban Coffee' },
  { type: 'fitness', name: 'Фитнесс', icon: '💪', description: 'Гишүүнчлэл лавлагаа', accentColor: '#10b981', storeName: 'Power Gym' },
  { type: 'education', name: 'Боловсрол', icon: '📚', description: 'Курс бүртгэл', accentColor: '#8b5cf6', storeName: 'Smart Academy' },
  { type: 'dental_clinic', name: 'Шүдний эмнэлэг', icon: '🦷', description: 'Цаг / яаралтай', accentColor: '#0ea5e9', storeName: 'Bright Dental' },
  { type: 'real_estate', name: 'Үл хөдлөх', icon: '🏠', description: 'Зар хайлт', accentColor: '#22c55e', storeName: 'Green Home Realty' },
  { type: 'camping_guesthouse', name: 'Кемпинг', icon: '⛺', description: 'Байр захиалга', accentColor: '#84cc16', storeName: 'Хустай Кемпинг' },
]

export default function DemoPage() {
  const [selected, setSelected] = useState<BusinessCard>(BUSINESS_TYPES[0])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Temuulel
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:block">Flow Demo</span>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Бүртгүүлэх
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Автомат чат flow туршиж үзэх
          </h1>
          <p className="text-slate-400">
            Салбараа сонгоод бизнесийн flow хэрхэн ажилладагийг туршаарай
          </p>
        </div>

        {/* Business type selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-2xl mx-auto">
          {BUSINESS_TYPES.map((biz) => (
            <button
              key={biz.type}
              onClick={() => setSelected(biz)}
              className={`p-3 rounded-xl border text-left transition-all ${
                selected.type === biz.type
                  ? 'border-blue-500 bg-slate-800 shadow-lg shadow-blue-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <span className="text-2xl">{biz.icon}</span>
              <p className="text-sm font-medium text-slate-200 mt-1">{biz.name}</p>
              <p className="text-xs text-slate-500">{biz.description}</p>
            </button>
          ))}
        </div>

        {/* Chat widget */}
        <div className="max-w-md mx-auto">
          <FlowDemoChat
            key={selected.type}
            businessType={selected.type}
            accentColor={selected.accentColor}
            storeName={selected.storeName}
          />
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <p className="text-slate-400 text-sm mb-4">
            Өөрийн бизнест тохирсон flow үүсгэхэд бэлэн үү?
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            Үнэгүй эхлэх
          </Link>
        </div>
      </main>
    </div>
  )
}
