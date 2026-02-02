'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface GuestRow {
  id: string
  first_name: string
  last_name: string
  document_type: string | null
  document_number: string | null
  nationality: string | null
  phone: string | null
  email: string | null
  vip_level: string
  notes: string | null
  customer_id: string | null
  created_at: string
  updated_at: string | null
}

type VipLevel = 'regular' | 'silver' | 'gold' | 'platinum'

const VIP_CONFIG: Record<VipLevel, { label: string; color: string }> = {
  regular: { label: '\u042d\u043d\u0433\u0438\u0439\u043d', color: 'bg-slate-500/20 text-slate-400' },
  silver: { label: '\u041c\u04e9\u043d\u0433\u04e9', color: 'bg-gray-400/20 text-gray-300' },
  gold: { label: '\u0410\u043b\u0442', color: 'bg-yellow-500/20 text-yellow-400' },
  platinum: { label: '\u041f\u043b\u0430\u0442\u0438\u043d\u0443\u043c', color: 'bg-purple-500/20 text-purple-400' },
}

const PAGE_SIZE = 20

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function renderVipBadge(level: string): React.ReactNode {
  const config = VIP_CONFIG[level as VipLevel] || VIP_CONFIG.regular
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

function renderSkeletonRows(): React.ReactNode {
  return Array.from({ length: 8 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-700/50">
      <td className="py-4 px-3 md:px-6">
        <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
      </td>
      <td className="py-4 px-3 md:px-6">
        <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
      </td>
      <td className="py-4 px-3 md:px-6">
        <div className="h-4 w-36 bg-slate-700 rounded animate-pulse" />
      </td>
      <td className="py-4 px-3 md:px-6">
        <div className="h-4 w-20 bg-slate-700 rounded animate-pulse" />
      </td>
      <td className="py-4 px-3 md:px-6 text-center">
        <div className="h-5 w-16 bg-slate-700 rounded-full animate-pulse mx-auto" />
      </td>
      <td className="py-4 px-3 md:px-6">
        <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
      </td>
    </tr>
  ))
}

export default function GuestsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState<boolean>(true)
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(0)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [error, setError] = useState<string>('')

  async function loadGuests(sid: string, searchTerm: string, pageNum: number): Promise<void> {
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('guests')
      .select(
        'id, first_name, last_name, document_type, document_number, nationality, phone, email, vip_level, notes, customer_id, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (searchTerm.trim()) {
      query = query.or(
        `first_name.ilike.%${searchTerm.trim()}%,last_name.ilike.%${searchTerm.trim()}%`
      )
    }

    const { data, count, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    if (data) {
      setGuests(data as GuestRow[])
    }
    if (count !== null && count !== undefined) {
      setTotalCount(count)
    }
  }

  useEffect(() => {
    async function init(): Promise<void> {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        await loadGuests(store.id, '', 0)
      }
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storeId || loading) return
    const timeout = setTimeout(() => {
      setPage(0)
      loadGuests(storeId, search, 0)
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    if (!storeId || loading) return
    loadGuests(storeId, search, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const totalPages: number = Math.ceil(totalCount / PAGE_SIZE)

  if (loading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="h-7 w-48 bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-32 bg-slate-700 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
          <div className="h-12 w-full bg-slate-700 rounded-xl animate-pulse" />
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-4 px-3 md:px-6 text-sm font-medium text-slate-400">{'\u041d\u044d\u0440'}</th>
                <th className="text-left py-4 px-3 md:px-6 text-sm font-medium text-slate-400">{'\u0423\u0442\u0430\u0441'}</th>
                <th className="text-left py-4 px-3 md:px-6 text-sm font-medium text-slate-400">{'\u0418-\u043c\u044d\u0439\u043b'}</th>
                <th className="text-left py-4 px-3 md:px-6 text-sm font-medium text-slate-400">{'\u0418\u0440\u0433\u044d\u043d\u0448\u0438\u043b'}</th>
                <th className="text-center py-4 px-3 md:px-6 text-sm font-medium text-slate-400">VIP</th>
                <th className="text-left py-4 px-3 md:px-6 text-sm font-medium text-slate-400">{'\u0411\u04af\u0440\u0442\u0433\u044d\u0441\u044d\u043d'}</th>
              </tr>
            </thead>
            <tbody>
              {renderSkeletonRows()}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{'\u0417\u043e\u0447\u0434\u044b\u043d \u0436\u0430\u0433\u0441\u0430\u0430\u043b\u0442'}</h1>
          <p className="text-slate-400 mt-1">
            {totalCount > 0
              ? `${totalCount} \u0437\u043e\u0447\u043d\u044b \u0431\u04af\u0440\u0442\u0433\u044d\u043b`
              : '\u0417\u043e\u0447\u043d\u044b \u0431\u04af\u0440\u0442\u0433\u044d\u043b \u043e\u043b\u0434\u0441\u043e\u043d\u0433\u04af\u0439'}
          </p>
        </div>
        <Link
          href="/dashboard/guests/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Зочин нэмэх
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">{'\u041d\u044d\u0440\u044d\u044d\u0440 \u0445\u0430\u0439\u0445'}</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={'\u041e\u0432\u043e\u0433 \u0431\u043e\u043b\u043e\u043d \u043d\u044d\u0440\u044d\u044d\u0440 \u0445\u0430\u0439\u0445...'}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-all"
          />
        </div>
        {search && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setSearch('')}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              {'\u0425\u0430\u0439\u043b\u0442\u044b\u0433 \u0430\u0440\u0438\u043b\u0433\u0430\u0445'}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {guests.length > 0 ? (
        <>
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    {'\u041d\u044d\u0440'}
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    {'\u0423\u0442\u0430\u0441'}
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    {'\u0418-\u043c\u044d\u0439\u043b'}
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    {'\u0418\u0440\u0433\u044d\u043d\u0448\u0438\u043b'}
                  </th>
                  <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    VIP
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    {'\u0411\u04af\u0440\u0442\u0433\u044d\u0441\u044d\u043d'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest: GuestRow) => (
                  <tr
                    key={guest.id}
                    onClick={() => router.push(`/dashboard/guests/${guest.id}`)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer"
                  >
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">
                        {guest.last_name} {guest.first_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{guest.phone || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{guest.email || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{guest.nationality || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      {renderVipBadge(guest.vip_level)}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">{formatDate(guest.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-slate-400">
                {'\u0425\u0443\u0443\u0434\u0430\u0441'} {page * PAGE_SIZE + 1}
                {' - '}
                {Math.min((page + 1) * PAGE_SIZE, totalCount)}
                {' / '}
                {totalCount}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((prev: number) => Math.max(0, prev - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-all"
                >
                  {'\u04e8\u043c\u043d\u04e9\u0445'}
                </button>
                <button
                  onClick={() => setPage((prev: number) => Math.min(totalPages - 1, prev + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-all"
                >
                  {'\u0414\u0430\u0440\u0430\u0430\u0445'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128100;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {'\u0417\u043e\u0447\u0438\u043d \u0431\u04af\u0440\u0442\u0433\u044d\u043b \u043e\u043b\u0434\u0441\u043e\u043d\u0433\u04af\u0439'}
          </h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {search
              ? '\u0425\u0430\u0439\u043b\u0442\u0430\u0434 \u0442\u043e\u0445\u0438\u0440\u043e\u0445 \u0437\u043e\u0447\u0438\u043d \u043e\u043b\u0434\u0441\u043e\u043d\u0433\u04af\u0439. \u0425\u0430\u0439\u043b\u0442\u044b\u043d \u043d\u04e9\u0445\u0446\u04e9\u043b\u0438\u0439\u0433 \u04e9\u04e9\u0440\u0447\u0438\u043b\u043d\u04e9 \u04af\u04af.'
              : '\u0417\u043e\u0447\u0438\u0434 \u0431\u04af\u0440\u0442\u0433\u04af\u04af\u043b\u044d\u0445 \u04af\u0435\u0434 \u044d\u043d\u0434 \u0445\u0430\u0440\u0430\u0433\u0434\u0430\u043d\u0430.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              {'\u0425\u0430\u0439\u043b\u0442\u044b\u0433 \u0430\u0440\u0438\u043b\u0433\u0430\u0445'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
