'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface TableInfo {
  table_id: string
  table_name: string
  capacity: number
  section: string | null
  store_id: string
  store_name: string | null
  store_logo: string | null
}

export default function TableOrderPage() {
  const params = useParams()
  const token = params.token as string

  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTableInfo() {
      try {
        const res = await fetch(`/api/tables/${token}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Ширээ олдсонгүй')
          return
        }
        const data = await res.json()
        setTableInfo(data)
      } catch {
        setError('Сервертэй холбогдох боломжгүй')
      } finally {
        setLoading(false)
      }
    }
    fetchTableInfo()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-white mb-2">Алдаа гарлаа</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link
            href="/"
            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Нүүр хуудас руу буцах
          </Link>
        </div>
      </div>
    )
  }

  if (!tableInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          {tableInfo.store_logo ? (
            <img
              src={tableInfo.store_logo}
              alt={tableInfo.store_name || 'Store'}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {tableInfo.store_name?.charAt(0) || 'R'}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-white">{tableInfo.store_name || 'Ресторан'}</h1>
            <p className="text-sm text-slate-400">
              {tableInfo.table_name}
              {tableInfo.section && ` - ${tableInfo.section}`}
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4">
        {/* Table info card */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm">Таны ширээ</p>
              <p className="text-2xl font-bold text-white">{tableInfo.table_name}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm">Суудлын тоо</p>
              <p className="text-2xl font-bold text-amber-400">{tableInfo.capacity}</p>
            </div>
          </div>
          {tableInfo.section && (
            <div className="flex items-center gap-2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{tableInfo.section}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Link
            href={`/embed/${tableInfo.store_id}?table_id=${tableInfo.table_id}&order_type=dine_in`}
            className="block w-full py-4 bg-amber-600 text-white text-center rounded-xl font-semibold hover:bg-amber-700 transition-colors"
          >
            Цэс үзэх & Захиалах
          </Link>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${tableInfo.store_name} - ${tableInfo.table_name}`,
                  url: window.location.href,
                })
              }
            }}
            className="block w-full py-4 bg-slate-700 text-white text-center rounded-xl font-semibold hover:bg-slate-600 transition-colors"
          >
            Хуваалцах
          </button>
        </div>

        {/* Help text */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Цэс үзэх товчийг дарж захиалгаа өгнө үү. Бид таны захиалгыг хүлээн авч, бэлтгэнэ.
        </p>
      </main>
    </div>
  )
}
