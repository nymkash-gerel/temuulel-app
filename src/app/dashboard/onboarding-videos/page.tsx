'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Video {
  id: string
  title: string
  duration: string
  description: string
  loomId?: string // Loom video ID (empty = placeholder)
  category: 'getting-started' | 'ai' | 'orders' | 'integrations' | 'billing'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

const VIDEOS: Video[] = [
  {
    id: 'welcome',
    title: 'Temuulel-д тавтай морил',
    duration: '2:30',
    description: 'Танилцуулга — юу хийх боломжтой вэ?',
    category: 'getting-started',
    difficulty: 'beginner',
  },
  {
    id: 'first-store',
    title: 'Эхний дэлгүүрээ үүсгэх',
    duration: '4:15',
    description: 'Бизнес төрөл сонгох, мэдээлэл оруулах, AI тохируулах',
    category: 'getting-started',
    difficulty: 'beginner',
  },
  {
    id: 'facebook-setup',
    title: 'Facebook Page холбох',
    duration: '5:40',
    description: 'Page Access Token авах, webhook тохируулах',
    category: 'integrations',
    difficulty: 'intermediate',
  },
  {
    id: 'ai-training',
    title: 'AI чатботоо сургах',
    duration: '7:20',
    description: 'Бүтээгдэхүүн, FAQ, мэдлэгийн сан оруулах',
    category: 'ai',
    difficulty: 'intermediate',
  },
  {
    id: 'order-flow',
    title: 'Захиалга авах flow',
    duration: '6:00',
    description: 'AI яаж захиалга бүрдүүлдэг — бүтээгдэхүүн, нэр, утас, хаяг',
    category: 'orders',
    difficulty: 'beginner',
  },
  {
    id: 'qpay-setup',
    title: 'QPay төлбөр холбох',
    duration: '4:50',
    description: 'QPay credentials оруулах, тестлэх',
    category: 'integrations',
    difficulty: 'intermediate',
  },
  {
    id: 'escalation',
    title: 'Хүнд шилжүүлэх (escalation)',
    duration: '3:30',
    description: 'AI-ээс амьд ажилтанд яаж шилжүүлдэг',
    category: 'ai',
    difficulty: 'intermediate',
  },
  {
    id: 'analytics',
    title: 'Analytics унших',
    duration: '5:10',
    description: 'Ямар хэрэглэгч хаанаас ирдэг, ямар бүтээгдэхүүн эрэлттэй',
    category: 'getting-started',
    difficulty: 'beginner',
  },
  {
    id: 'broadcasts',
    title: 'Broadcast кампанит ажил',
    duration: '4:30',
    description: 'Хэрэглэгчиддээ нэг дор олон мессеж илгээх',
    category: 'ai',
    difficulty: 'intermediate',
  },
  {
    id: 'billing',
    title: 'Төлбөр ба төлөвлөгөө',
    duration: '3:00',
    description: 'Free, Starter, Pro — ямар ялгаатай',
    category: 'billing',
    difficulty: 'beginner',
  },
  {
    id: 'advanced-ai',
    title: 'AI-гийн нарийн тохиргоо',
    duration: '9:00',
    description: 'System prompt, tone, business-type-specific хариулт',
    category: 'ai',
    difficulty: 'advanced',
  },
  {
    id: 'white-label',
    title: 'White-label брэнд',
    duration: '5:30',
    description: 'Өөрийн лого, өнгө, domain тохируулах (Pro)',
    category: 'integrations',
    difficulty: 'advanced',
  },
]

const CATEGORIES = [
  { id: 'all', label: 'Бүгд', icon: '🎬' },
  { id: 'getting-started', label: 'Эхлэх', icon: '🚀' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'orders', label: 'Захиалга', icon: '📦' },
  { id: 'integrations', label: 'Холболт', icon: '🔌' },
  { id: 'billing', label: 'Төлбөр', icon: '💳' },
]

export default function OnboardingVideosPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null)
  const [search, setSearch] = useState('')

  const filtered = VIDEOS.filter(v => {
    if (selectedCategory !== 'all' && v.category !== selectedCategory) return false
    if (search && !v.title.toLowerCase().includes(search.toLowerCase()) && !v.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">←</Link>
          <h1 className="text-2xl font-bold text-white">🎥 Заавар видеонууд</h1>
        </div>
        <p className="text-slate-400">Temuulel-ыг бүрэн эзэмшихэд туслах 12 видео сургалт</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Видео хайх..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Videos grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(video => (
          <button
            key={video.id}
            onClick={() => setPlayingVideo(video)}
            className="text-left bg-slate-800/50 border border-slate-700 hover:border-blue-500 rounded-2xl overflow-hidden transition-all group"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <div className="w-14 h-14 bg-blue-500/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded">
                {video.duration}
              </span>
              <span className={`absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full ${
                video.difficulty === 'beginner' ? 'bg-emerald-500/20 text-emerald-400' :
                video.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {video.difficulty === 'beginner' ? 'Анхлан суралцагч' : video.difficulty === 'intermediate' ? 'Дунд' : 'Нарийн'}
              </span>
            </div>
            <div className="p-4">
              <h3 className="text-white font-semibold mb-1 line-clamp-1">{video.title}</h3>
              <p className="text-sm text-slate-400 line-clamp-2">{video.description}</p>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Таны хайлтад тохирох видео олдсонгүй
        </div>
      )}

      {/* Video player modal */}
      {playingVideo && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">{playingVideo.title}</h3>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Loom embed or placeholder */}
            <div className="aspect-video bg-slate-800 relative">
              {playingVideo.loomId ? (
                <iframe
                  src={`https://www.loom.com/embed/${playingVideo.loomId}`}
                  allowFullScreen
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="text-6xl mb-4">🎬</div>
                  <h4 className="text-white text-lg font-semibold mb-2">Удахгүй гарна</h4>
                  <p className="text-slate-400 max-w-md">
                    Энэ видео удахгүй орчуулагдан бэлэн болно. Одоогоор <Link href="/help" className="text-blue-400 underline">Help Center</Link>-ээс текст заавар уншина уу.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4">
              <p className="text-slate-400 text-sm">{playingVideo.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                <span>⏱ {playingVideo.duration}</span>
                <span>•</span>
                <span className="capitalize">{playingVideo.category.replace('-', ' ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
