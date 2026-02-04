'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Student {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  guardian_name: string | null
  guardian_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const PAGE_SIZE = 20

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function StudentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [loading, setLoading] = useState<boolean>(true)
  const [students, setStudents] = useState<Student[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(0)
  const [search, setSearch] = useState<string>('')
  const [storeId, setStoreId] = useState<string>('')

  const loadStudents = useCallback(async (sid: string, pageNum: number, query: string): Promise<void> => {
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let dbQuery = supabase
      .from('students')
      .select('*', { count: 'exact' })
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (query.trim()) {
      dbQuery = dbQuery.or(
        `first_name.ilike.%${query.trim()}%,last_name.ilike.%${query.trim()}%`
      )
    }

    const { data, count } = await dbQuery

    if (data) {
      setStudents(data as Student[])
    }
    if (typeof count === 'number') {
      setTotalCount(count)
    }
  }, [supabase])

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
        await loadStudents(store.id, 0, '')
      }
      setLoading(false)
    }
    init()
  }, [supabase, loadStudents])

  useEffect(() => {
    if (!storeId || loading) return
    setPage(0)
    const reload = async () => { await loadStudents(storeId, 0, search) }
    reload()
  }, [search, storeId, loading, loadStudents])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadStudents(storeId, page, search) }
    reload()
  }, [page, storeId, loading, search, loadStudents])

  const totalPages: number = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  /* ------------------------------------------------------------------ */
  /* Loading skeleton                                                    */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-slate-700/50 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-slate-700/30 rounded mt-2 animate-pulse" />
        </div>

        {/* Search skeleton */}
        <div className="mb-6">
          <div className="h-12 w-full max-w-sm bg-slate-700/50 rounded-xl animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          {/* Header row */}
          <div className="border-b border-slate-700 px-6 py-4 flex gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 flex-1 bg-slate-700/40 rounded animate-pulse" />
            ))}
          </div>
          {/* Body rows */}
          {Array.from({ length: 8 }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="border-b border-slate-700/50 px-6 py-4 flex gap-6"
            >
              {Array.from({ length: 6 }).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className="h-4 flex-1 bg-slate-700/30 rounded animate-pulse"
                  style={{ animationDelay: `${(rowIdx * 6 + colIdx) * 40}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* Main render                                                         */
  /* ------------------------------------------------------------------ */
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Суралцагчид
          </h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} суралцагч
          </p>
        </div>
        <Link
          href="/dashboard/students/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Суралцагч нэмэх
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Нэрээр хайх..."
            className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Хайлт цэвэрлэх"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Table or empty state */}
      {students.length > 0 ? (
        <>
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    Нэр
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    И-мэйл
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    Утас
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    Төрсөн огноо
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    Асран хамгаалагч
                  </th>
                  <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">
                    Бүртгэсэн
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/dashboard/students/${s.id}`)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer"
                  >
                    {/* Нэр */}
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-medium">
                            {s.first_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-white font-medium">
                          {s.last_name} {s.first_name}
                        </span>
                      </div>
                    </td>

                    {/* И-мэйл */}
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {s.email || '-'}
                      </span>
                    </td>

                    {/* Утас */}
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {s.phone || '-'}
                      </span>
                    </td>

                    {/* Төрсөн огноо */}
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {s.date_of_birth ? formatDate(s.date_of_birth) : '-'}
                      </span>
                    </td>

                    {/* Асран хамгаалагч */}
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {s.guardian_name ? (
                        <div>
                          <p className="text-slate-300 text-sm">{s.guardian_name}</p>
                          {s.guardian_phone && (
                            <p className="text-slate-500 text-xs mt-0.5">{s.guardian_phone}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>

                    {/* Бүртгэсэн */}
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {formatDate(s.created_at)}
                      </span>
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
                {page * PAGE_SIZE + 1}
                &ndash;
                {Math.min((page + 1) * PAGE_SIZE, totalCount)}
                {' / '}
                {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Өмнөх
                </button>
                <span className="text-sm text-slate-400">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Дараах
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 14l9-5-9-5-9 5 9 5zm0 7l9-5-9-5-9 5 9 5zm0-7l9-5-9-5-9 5 9 5z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Суралцагч бүртгэгдээгүй байна
          </h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {search
              ? 'Хайлтын үр дүн олдсонгүй. Хайлтын утгыг өөрчилж үзнэ үү.'
              : 'Суралцагчид энд жагсаагдах болно. Эхлээд шинэ суралцагч бүртгэнэ үү.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Хайлт цэвэрлэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
