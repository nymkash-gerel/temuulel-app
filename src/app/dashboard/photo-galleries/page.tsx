'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface GallerySession {
  id: string
  session_type: 'portrait' | 'wedding' | 'event' | 'product' | 'family' | 'maternity' | 'newborn' | 'corporate' | 'other'
  scheduled_at: string
}

interface PhotoGallery {
  id: string
  session_id: string
  name: string
  description: string | null
  gallery_url: string | null
  download_url: string | null
  photo_count: number
  status: 'processing' | 'ready' | 'delivered' | 'archived'
  created_at: string
  updated_at: string
  photo_sessions: GallerySession | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  processing: { label: 'Боловсруулж буй', color: 'bg-purple-500/20 text-purple-400', icon: '⏳' },
  ready: { label: 'Бэлэн', color: 'bg-blue-500/20 text-blue-400', icon: '📸' },
  delivered: { label: 'Хүргэгдсэн', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  archived: { label: 'Архивласан', color: 'bg-slate-500/20 text-slate-400', icon: '📦' },
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  portrait: 'Хөрөг зураг',
  wedding: 'Хуримын зураг',
  event: 'Арга хэмжээ',
  product: 'Бүтээгдэхүүний зураг',
  family: 'Гэр бүлийн зураг',
  maternity: 'Жирэмсний зураг',
  newborn: 'Нярайн зураг',
  corporate: 'Корпоратив зураг',
  other: 'Бусад',
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('mn-MN') + ' ' + d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('mn-MN')
}

export default function PhotoGalleriesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [galleries, setGalleries] = useState<PhotoGallery[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/photo-galleries').then(r => r.json())
      if (res.data) setGalleries(res.data as PhotoGallery[])

      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = galleries

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(g => (
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        (g.photo_sessions ? SESSION_TYPE_LABELS[g.photo_sessions.session_type]?.toLowerCase().includes(q) : false)
      ))
    }

    if (statusFilter) {
      result = result.filter(g => g.status === statusFilter)
    }

    return result
  }, [galleries, search, statusFilter])

  const stats = useMemo(() => ({
    processing: galleries.filter(g => g.status === 'processing').length,
    ready: galleries.filter(g => g.status === 'ready').length,
    delivered: galleries.filter(g => g.status === 'delivered').length,
    archived: galleries.filter(g => g.status === 'archived').length,
    totalPhotos: galleries.reduce((sum, g) => sum + (g.photo_count || 0), 0),
  }), [galleries])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Зургийн галерей</h1>
          <p className="text-slate-400 mt-1">
            Нийт {galleries.length} галерей
            {filtered.length !== galleries.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Боловсруулж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.processing}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Бэлэн</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.ready}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Хүргэгдсэн</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.delivered}</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Архивласан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.archived}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-400 text-sm">Нийт зураг</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalPhotos}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Галерейн нэр, тайлбар, зураг авалтын төрөл хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="processing">Боловсруулж буй</option>
              <option value="ready">Бэлэн</option>
              <option value="delivered">Хүргэгдсэн</option>
              <option value="archived">Архивласан</option>
            </select>
          </div>
        </div>
      </div>

      {/* Galleries Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зураг авалт</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зургийн тоо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Холбоос</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үүсгэсэн</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((gallery) => {
                const sc = STATUS_CONFIG[gallery.status] || STATUS_CONFIG.processing
                return (
                  <tr key={gallery.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white text-sm font-medium">{gallery.name}</span>
                      {gallery.description && (
                        <p className="text-slate-400 text-xs mt-0.5 max-w-xs truncate">{gallery.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {gallery.photo_sessions ? (
                        <div>
                          <span className="text-slate-300 text-sm">
                            {SESSION_TYPE_LABELS[gallery.photo_sessions.session_type] || gallery.photo_sessions.session_type}
                          </span>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {formatDateTime(gallery.photo_sessions.scheduled_at)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white text-sm">{gallery.photo_count}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex flex-col gap-1">
                        {gallery.gallery_url ? (
                          <a
                            href={gallery.gallery_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs underline"
                          >
                            Галерей нээх
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                        {gallery.download_url && (
                          <a
                            href={gallery.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 text-xs underline"
                          >
                            Татах
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDate(gallery.created_at)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : galleries.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох галерей олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🖼️</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Галерей байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Зураг авалт дуусахад галерей энд харагдана
          </p>
        </div>
      )}
    </div>
  )
}
