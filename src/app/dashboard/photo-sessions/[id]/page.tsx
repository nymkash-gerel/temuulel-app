'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { photoSessionTransitions } from '@/lib/status-machine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhotoSession {
  id: string
  customer_id: string | null
  photographer_id: string | null
  session_type: string
  location: string | null
  scheduled_at: string
  duration_minutes: number
  total_amount: number
  deposit_amount: number | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string | null } | null
}

interface PhotoGallery {
  id: string
  session_id: string
  name: string | null
  description: string | null
  gallery_url: string | null
  download_url: string | null
  password: string | null
  photo_count: number
  status: string
  delivered_at: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:    { label: 'Товлосон',       color: 'bg-blue-500/20 text-blue-400' },
  confirmed:    { label: 'Баталгаажсан',   color: 'bg-cyan-500/20 text-cyan-400' },
  in_progress:  { label: 'Явагдаж буй',   color: 'bg-yellow-500/20 text-yellow-400' },
  editing:      { label: 'Засварлаж буй',  color: 'bg-purple-500/20 text-purple-400' },
  delivered:    { label: 'Хүргэсэн',       color: 'bg-green-500/20 text-green-400' },
  cancelled:    { label: 'Цуцлагдсан',     color: 'bg-red-500/20 text-red-400' },
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Товлогдсон',
  in_progress: 'Явагдаж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
  no_show: 'Ирээгүй',
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  portrait:  'Хөрөг',
  wedding:   'Хурим',
  event:     'Арга хэмжээ',
  product:   'Бүтээгдэхүүн',
  family:    'Гэр бүл',
  maternity: 'Жирэмсний',
  newborn:   'Нярайн',
  corporate: 'Корпорат',
  other:     'Бусад',
}

const GALLERY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  processing: { label: 'Боловсруулж буй', color: 'bg-purple-500/20 text-purple-400' },
  ready:      { label: 'Бэлэн',          color: 'bg-blue-500/20 text-blue-400' },
  delivered:  { label: 'Хүргэсэн',       color: 'bg-green-500/20 text-green-400' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Status transition map -- determines which buttons to show
// ---------------------------------------------------------------------------

function getStatusActions(current: string): { status: string; label: string; color: string }[] {
  switch (current) {
    case 'scheduled':
      return [
        { status: 'confirmed',   label: 'Баталгаажуулах', color: 'bg-cyan-600 hover:bg-cyan-500' },
        { status: 'cancelled',   label: 'Цуцлах',         color: 'bg-red-600 hover:bg-red-500' },
      ]
    case 'confirmed':
      return [
        { status: 'in_progress', label: 'Эхлүүлэх',       color: 'bg-yellow-600 hover:bg-yellow-500' },
        { status: 'cancelled',   label: 'Цуцлах',         color: 'bg-red-600 hover:bg-red-500' },
      ]
    case 'in_progress':
      return [
        { status: 'editing',     label: 'Засварлах шатанд', color: 'bg-purple-600 hover:bg-purple-500' },
      ]
    case 'editing':
      return [
        { status: 'delivered',   label: 'Хүргэсэн',       color: 'bg-green-600 hover:bg-green-500' },
      ]
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PhotoSessionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<PhotoSession | null>(null)
  const [galleries, setGalleries] = useState<PhotoGallery[]>([])
  const [updating, setUpdating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { setLoading(false); return }

    const { data } = await supabase
      .from('photo_sessions')
      .select(`
        id, customer_id, photographer_id, session_type, location,
        scheduled_at, duration_minutes, total_amount, deposit_amount,
        notes, status, created_at, updated_at,
        customers(id, name),
        staff(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    const photoSession = data as unknown as PhotoSession

    if (photoSession) {
      setSession(photoSession)
      await loadGalleries(photoSession.id)
    }

    setLoading(false)
  }

  async function loadGalleries(sessionId: string) {
    const { data } = await supabase
      .from('photo_galleries')
      .select('id, session_id, name, description, gallery_url, download_url, password, photo_count, status, delivered_at, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (data) {
      setGalleries(data as unknown as PhotoGallery[])
    }
  }

  // -----------------------------------------------------------------------
  // Status update
  // -----------------------------------------------------------------------

  async function handleStatusChange(newStatus: string) {
    if (!session) return

    const confirmMessages: Record<string, string> = {
      confirmed:   'Зураг авалтыг баталгаажуулах уу?',
      in_progress: 'Зураг авалтыг эхлүүлэх үү?',
      editing:     'Засварлах шатанд шилжүүлэх үү?',
      delivered:   'Хүргэсэн гэж тэмдэглэх үү?',
      cancelled:   'Зураг авалтыг цуцлах уу?',
    }

    if (!confirm(confirmMessages[newStatus] || 'Төлөв өөрчлөх үү?')) return

    setUpdating(true)

    try {
      const res = await fetch(`/api/photo-sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const updated = await res.json() as PhotoSession
        setSession(updated)
      }
    } catch {
      // keep state unchanged
    }

    setUpdating(false)
  }

  // -----------------------------------------------------------------------
  // Inline edit
  // -----------------------------------------------------------------------

  function startEdit() {
    if (!session) return
    setEditData({
      session_type: session.session_type,
      location: session.location ?? '',
      scheduled_at: session.scheduled_at.slice(0, 16),
      duration_minutes: session.duration_minutes,
      total_amount: session.total_amount,
      deposit_amount: session.deposit_amount ?? 0,
      notes: session.notes ?? '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!session) return

    const changed: Record<string, unknown> = {}

    if (editData.session_type !== session.session_type) changed.session_type = editData.session_type
    if (editData.location !== (session.location ?? '')) changed.location = editData.location
    if (editData.scheduled_at !== session.scheduled_at.slice(0, 16)) {
      changed.scheduled_at = new Date(editData.scheduled_at as string).toISOString()
    }
    if (Number(editData.duration_minutes) !== session.duration_minutes) changed.duration_minutes = Number(editData.duration_minutes)
    if (Number(editData.total_amount) !== session.total_amount) changed.total_amount = Number(editData.total_amount)
    if (Number(editData.deposit_amount) !== (session.deposit_amount ?? 0)) changed.deposit_amount = Number(editData.deposit_amount)
    if (editData.notes !== (session.notes ?? '')) changed.notes = editData.notes

    if (Object.keys(changed).length === 0) {
      setIsEditing(false)
      return
    }

    setSaving(true)

    try {
      const res = await fetch(`/api/photo-sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error || 'Хадгалах үед алдаа гарлаа')
        setSaving(false)
        return
      }

      setIsEditing(false)
      await load()
    } catch {
      alert('Хадгалах үед алдаа гарлаа')
    }

    setSaving(false)
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-400 mb-4">Зураг авалт олдсонгүй.</p>
        <button
          onClick={() => router.push('/dashboard/photo-sessions')}
          className="text-blue-400 hover:text-blue-300 transition-all"
        >
          Буцах
        </button>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------

  const statusCfg = STATUS_CONFIG[session.status] ?? { label: session.status, color: 'bg-slate-500/20 text-slate-400' }
  const balance = session.total_amount - (session.deposit_amount ?? 0)
  const statusActions = getStatusActions(session.status)

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div>
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/photo-sessions')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Зураг авалтын дэлгэрэнгүй</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1 text-sm">
              {formatDateTime(session.created_at)} -д үүсгэсэн
            </p>
          </div>
        </div>

        {/* Status action buttons + Edit controls */}
        <div className="flex items-center gap-2">
          <StatusActions
            currentStatus={session.status}
            transitions={photoSessionTransitions}
            statusLabels={STATUS_LABELS}
            apiPath={`/api/photo-sessions/${id}`}
            onSuccess={load}
          />
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all disabled:opacity-50"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all disabled:opacity-50"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-all"
            >
              Засах
            </button>
          )}
        </div>
      </div>

      {/* ---- Info Grid ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Session info card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Зураг авалтын мэдээлэл</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Төрөл</span>
              {isEditing ? (
                <select
                  value={editData.session_type as string}
                  onChange={(e) => setEditData({ ...editData, session_type: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="portrait">Хөрөг</option>
                  <option value="wedding">Хурим</option>
                  <option value="event">Арга хэмжээ</option>
                  <option value="product">Бүтээгдэхүүн</option>
                  <option value="family">Гэр бүл</option>
                  <option value="maternity">Жирэмсний</option>
                  <option value="newborn">Нярайн</option>
                  <option value="corporate">Корпорат</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <span className="text-white">{SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Байршил</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.location as string}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-white">{session.location || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Товлосон огноо</span>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editData.scheduled_at as string}
                  onChange={(e) => setEditData({ ...editData, scheduled_at: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-white">{formatDateTime(session.scheduled_at)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Үргэлжлэх хугацаа</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.duration_minutes as number}
                  onChange={(e) => setEditData({ ...editData, duration_minutes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-white">{session.duration_minutes} мин</span>
              )}
            </div>
          </div>
        </div>

        {/* Client card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Үйлчлүүлэгч</h2>
          {session.customers ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">
                  {session.customers.name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{session.customers.name || 'Нэргүй'}</p>
                <p className="text-slate-400 text-sm">ID: {session.customers.id.slice(0, 8)}...</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Үйлчлүүлэгч тодорхойгүй</p>
          )}
        </div>

        {/* Photographer card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Гэрэл зурагчин</h2>
          {session.staff ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">
                  {session.staff.name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{session.staff.name || 'Нэргүй'}</p>
                <p className="text-slate-400 text-sm">ID: {session.staff.id.slice(0, 8)}...</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Гэрэл зурагчин тодорхойгүй</p>
          )}
        </div>

        {/* Financial card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Төлбөрийн мэдээлэл</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Нийт дүн</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.total_amount as number}
                  onChange={(e) => setEditData({ ...editData, total_amount: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-white font-medium text-lg">{formatPrice(session.total_amount)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Урьдчилгаа</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.deposit_amount as number}
                  onChange={(e) => setEditData({ ...editData, deposit_amount: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-white">
                  {session.deposit_amount != null ? formatPrice(session.deposit_amount) : '-'}
                </span>
              )}
            </div>
            <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
              <span className="text-slate-400">Үлдэгдэл</span>
              <span className={`font-medium ${balance > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {formatPrice(balance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Notes ---- */}
      {(session.notes || isEditing) && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Тэмдэглэл</h2>
          {isEditing ? (
            <textarea
              value={editData.notes as string}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{session.notes}</p>
          )}
        </div>
      )}

      {/* ---- Galleries ---- */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Галерей ({galleries.length})</h2>

        {galleries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleries.map((gallery) => {
              const galStatusCfg = GALLERY_STATUS_LABELS[gallery.status] ?? {
                label: gallery.status,
                color: 'bg-slate-500/20 text-slate-400',
              }

              return (
                <div
                  key={gallery.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-white font-medium truncate pr-2">
                      {gallery.name || 'Нэргүй галерей'}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${galStatusCfg.color}`}>
                      {galStatusCfg.label}
                    </span>
                  </div>

                  {gallery.description && (
                    <p className="text-slate-400 text-sm mb-3 line-clamp-2">{gallery.description}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Зургийн тоо</span>
                      <span className="text-white">{gallery.photo_count}</span>
                    </div>

                    {gallery.gallery_url && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Галерей линк</span>
                        <a
                          href={gallery.gallery_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-all truncate ml-2 max-w-[160px]"
                        >
                          Нээх
                        </a>
                      </div>
                    )}

                    {gallery.download_url && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Татах линк</span>
                        <a
                          href={gallery.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-all truncate ml-2 max-w-[160px]"
                        >
                          Татах
                        </a>
                      </div>
                    )}

                    {gallery.password && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Нууц үг</span>
                        <span className="text-slate-300 font-mono text-xs">{gallery.password}</span>
                      </div>
                    )}

                    {gallery.delivered_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Хүргэсэн</span>
                        <span className="text-slate-300">{formatDate(gallery.delivered_at)}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-500 text-xs mt-3">
                    Үүсгэсэн: {formatDate(gallery.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Галерей байхгүй байна</p>
          </div>
        )}
      </div>

      {/* ---- Meta ---- */}
      <div className="text-sm text-slate-500 flex flex-wrap gap-6 mb-4">
        <span>Үүсгэсэн: {formatDateTime(session.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(session.updated_at)}</span>
      </div>
    </div>
  )
}
