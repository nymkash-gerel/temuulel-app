'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import DeleteProductButton from '@/components/DeleteProductButton'

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  active:   { label: 'Идэвхтэй', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-l-emerald-500' },
  draft:    { label: 'Ноорог',   dot: 'bg-amber-400',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-l-amber-500' },
  archived: { label: 'Архив',    dot: 'bg-slate-400',   bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-l-slate-500' },
}

const CATEGORY_LABELS: Record<string, string> = {
  clothing: 'Хувцас',
  shoes: 'Гутал',
  bags: 'Цүнх',
  accessories: 'Гоёл чимэглэл',
}

interface Props {
  products: Array<Record<string, unknown>>
  productLimit: number
}

export default function ProductsClient({ products, productLimit }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return products.filter(p => {
      const name = (p.name as string || '').toLowerCase()
      const sku = (p.sku as string || '').toLowerCase()
      if (search && !name.includes(search.toLowerCase()) && !sku.includes(search.toLowerCase())) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (categoryFilter && p.category !== categoryFilter) return false
      return true
    })
  }, [products, search, statusFilter, categoryFilter])

  const productCount = products.length
  const usagePercent = productLimit === -1 ? 0 : Math.round((productCount / productLimit) * 100)
  const activeCount = products.filter(p => p.status === 'active').length
  const draftCount = products.filter(p => p.status === 'draft').length
  const totalStock = products.reduce((sum, p) => {
    const variants = (p.product_variants as Array<{ stock_quantity: number }>) || []
    return sum + variants.reduce((s, v) => s + (v.stock_quantity || 0), 0)
  }, 0)
  const lowStockCount = products.filter(p => {
    const variants = (p.product_variants as Array<{ stock_quantity: number }>) || []
    const stock = variants.reduce((s, v) => s + (v.stock_quantity || 0), 0)
    return stock > 0 && stock <= 5
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Бүтээгдэхүүн</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-slate-500">
              {productCount}/{productLimit === -1 ? '∞' : productLimit} бүтээгдэхүүн
            </span>
            {productLimit !== -1 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent > 80
                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                    }`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-600">{usagePercent}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/products/import"
            className="group px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] text-slate-300 hover:text-white rounded-xl transition-all flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Олноор оруулах</span>
            <span className="sm:hidden">Оруулах</span>
          </Link>
          <Link
            href="/dashboard/products/new"
            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Нэмэх
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Нийт', value: productCount, gradient: 'from-slate-500/20 to-slate-600/5' },
          { label: 'Идэвхтэй', value: activeCount, gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Ноорог', value: draftCount, gradient: 'from-amber-500/20 to-amber-600/5' },
          { label: 'Нийт нөөц', value: totalStock, suffix: ' ш', gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Бага нөөцтэй', value: lowStockCount, gradient: 'from-red-500/20 to-red-600/5' },
        ].map((stat) => (
          <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1.5 relative">
              {stat.value.toLocaleString()}{stat.suffix || ''}
            </p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Бүтээгдэхүүн хайх..."
            className="w-full pl-11 pr-10 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          >
            <option value="">Бүх ангилал</option>
            <option value="clothing">Хувцас</option>
            <option value="shoes">Гутал</option>
            <option value="bags">Цүнх</option>
            <option value="accessories">Гоёл чимэглэл</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          >
            <option value="">Бүх төлөв</option>
            <option value="active">Идэвхтэй</option>
            <option value="draft">Ноорог</option>
            <option value="archived">Архив</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      {filtered.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-[minmax(200px,2fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(60px,0.5fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Бүтээгдэхүүн</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Ангилал</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Үнэ</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Нөөц</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төлөв</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Үйлдэл</p>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filtered.map((product) => {
              const variants = (product.product_variants as Array<{ stock_quantity: number; price: number }>) || []
              const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
              const minPrice = variants.length > 0
                ? Math.min(...variants.map(v => v.price))
                : (product.base_price as number) || 0

              const sc = STATUS_CONFIG[(product.status as string)] || STATUS_CONFIG.draft
              const stockColor = totalStock > 10 ? 'text-emerald-400' : totalStock > 0 ? 'text-amber-400' : 'text-red-400'
              const stockDot = totalStock > 10 ? 'bg-emerald-400' : totalStock > 0 ? 'bg-amber-400' : 'bg-red-400'
              const stockBg = totalStock > 10 ? 'bg-emerald-500/10' : totalStock > 0 ? 'bg-amber-500/10' : 'bg-red-500/10'
              const isExpanded = expandedId === (product.id as string)

              return (
                <div key={product.id as string}>
                  {/* Desktop Row */}
                  <div className={`hidden md:grid grid-cols-[minmax(200px,2fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(60px,0.5fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors border-l-2 ${sc.border} group`}>
                    <Link href={`/dashboard/products/${product.id}`} className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.06] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:border-white/[0.12] transition-colors">
                        {(product.images as string[])?.[0] ? (
                          <Image src={(product.images as string[])[0]} alt={product.name as string} width={40} height={40} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-blue-400 transition-colors">{product.name as string}</p>
                        <p className="text-slate-600 text-xs truncate">SKU: {(product.sku as string) || 'N/A'}</p>
                      </div>
                    </Link>
                    <div>
                      <span className="inline-flex items-center px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-slate-400">
                        {CATEGORY_LABELS[(product.category as string)] || (product.category as string) || 'Ангилалгүй'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white text-sm font-medium">{Number(minPrice).toLocaleString()}₮</span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 ${stockBg} rounded-lg text-xs font-medium ${stockColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stockDot}`} />
                        {totalStock} ш
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/dashboard/products/${product.id}`}
                        className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                        title="Засах"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                        </svg>
                      </Link>
                      <DeleteProductButton productId={product.id as string} productName={product.name as string} />
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className={`md:hidden border-l-2 ${sc.border}`}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : product.id as string)}
                      className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/[0.04] text-left"
                    >
                      <div className="w-11 h-11 bg-white/[0.04] border border-white/[0.06] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                        {(product.images as string[])?.[0] ? (
                          <Image src={(product.images as string[])[0]} alt={product.name as string} width={44} height={44} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{product.name as string}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-slate-500 text-xs">{CATEGORY_LABELS[(product.category as string)] || 'Ангилалгүй'}</span>
                          <span className="text-slate-700">·</span>
                          <span className={`text-xs ${stockColor}`}>{totalStock} ш</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-white text-sm font-medium">{Number(minPrice).toLocaleString()}₮</p>
                      </div>
                      <svg className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-white/[0.02]">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-white/[0.03] rounded-lg p-2.5">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider">SKU</p>
                            <p className="text-white text-sm mt-0.5">{(product.sku as string) || 'N/A'}</p>
                          </div>
                          <div className="bg-white/[0.03] rounded-lg p-2.5">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Хувилбар</p>
                            <p className="text-white text-sm mt-0.5">{variants.length} ш</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/products/${product.id}`}
                            className="flex-1 py-2 text-center text-sm font-medium bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                          >
                            Засах
                          </Link>
                          <DeleteProductButton productId={product.id as string} productName={product.name as string} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <span className="text-slate-600 text-xs">{filtered.length} бүтээгдэхүүн</span>
            {search || statusFilter || categoryFilter ? (
              <button onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter('') }} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Шүүлтүүр цэвэрлэх
              </button>
            ) : null}
          </div>
        </div>
      ) : products.length > 0 ? (
        /* No results from filter */
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-1">Илэрц олдсонгүй</h3>
          <p className="text-slate-500 text-sm mb-4">Хайлтын утга эсвэл шүүлтүүрээ өөрчилнө үү</p>
          <button onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter('') }} className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all">
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Бүтээгдэхүүн байхгүй байна</h3>
          <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm">
            Эхний бүтээгдэхүүнээ нэмж, AI chatbot-оор борлуулалтаа эхлүүлээрэй
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard/products/import"
              className="px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 hover:text-white rounded-xl transition-all flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Excel-ээс оруулах
            </Link>
            <Link
              href="/dashboard/products/new"
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-blue-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Шинээр нэмэх
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
