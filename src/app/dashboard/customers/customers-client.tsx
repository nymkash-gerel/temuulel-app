'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { exportToFile } from '@/lib/export-utils'

interface Customer {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  messenger_id: string | null
  instagram_id: string | null
  whatsapp_id: string | null
  channel: string
  created_at: string
  orders: { id: string; total_amount: number; status: string }[] | null
  return_requests: { id: string }[] | null
  customer_interactions: { id: string; interaction_type: string }[] | null
}

type TagKey = 'new' | 'repeat' | 'vip' | 'inquiry' | 'complaint' | 'returned' | 'positive'

const TAG_CONFIG: Record<TagKey, { label: string; dot: string; bg: string; text: string }> = {
  new:       { label: 'Шинэ',          dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  repeat:    { label: 'Давтан',        dot: 'bg-blue-400',    bg: 'bg-blue-500/10',    text: 'text-blue-400' },
  vip:       { label: 'VIP',           dot: 'bg-amber-400',   bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  inquiry:   { label: 'Лавлагаа',      dot: 'bg-cyan-400',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400' },
  complaint: { label: 'Гомдол',        dot: 'bg-red-400',     bg: 'bg-red-500/10',     text: 'text-red-400' },
  returned:  { label: 'Буцаасан',      dot: 'bg-orange-400',  bg: 'bg-orange-500/10',  text: 'text-orange-400' },
  positive:  { label: 'Сэтгэл хангтай', dot: 'bg-violet-400', bg: 'bg-violet-500/10', text: 'text-violet-400' },
}

export default function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers] = useState<Customer[]>(initialCustomers)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [tagFilter, setTagFilter] = useState<TagKey | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function getCustomerTags(c: Customer): TagKey[] {
    const tags: TagKey[] = []
    const orders = (c.orders || []).filter(o => o.status !== 'cancelled')
    const interactions = c.customer_interactions || []
    const returns = c.return_requests || []

    // Шинэ: created within last 30 days
    const daysSinceCreated = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreated <= 30) tags.push('new')

    // Давтан: 2+ orders
    if (orders.length >= 2) tags.push('repeat')

    // VIP: 5+ orders or spent 500k+
    const totalSpent = orders.reduce((s, o) => s + Number(o.total_amount), 0)
    if (orders.length >= 5 || totalSpent >= 500000) tags.push('vip')

    // Лавлагаа: has inquiry interactions
    if (interactions.some(i => i.interaction_type === 'inquiry')) tags.push('inquiry')

    // Гомдол: has complaint interactions
    if (interactions.some(i => i.interaction_type === 'complaint')) tags.push('complaint')

    // Буцаасан: has return requests
    if (returns.length > 0) tags.push('returned')

    // Сэтгэл хангтай: has positive_feedback interactions
    if (interactions.some(i => i.interaction_type === 'positive_feedback')) tags.push('positive')

    return tags
  }

  const tagCounts = useMemo(() => {
    const counts: Record<TagKey, number> = { new: 0, repeat: 0, vip: 0, inquiry: 0, complaint: 0, returned: 0, positive: 0 }
    customers.forEach(c => {
      getCustomerTags(c).forEach(t => counts[t]++)
    })
    return counts
  }, [customers])

  const filteredCustomers = useMemo(() => {
    let result = customers
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    }
    if (channelFilter) {
      result = result.filter(c => {
        if (channelFilter === 'messenger') return !!c.messenger_id
        if (channelFilter === 'instagram') return !!c.instagram_id
        if (channelFilter === 'whatsapp') return !!c.whatsapp_id
        if (channelFilter === 'web') return !c.messenger_id && !c.instagram_id && !c.whatsapp_id
        return true
      })
    }
    if (tagFilter) {
      result = result.filter(c => getCustomerTags(c).includes(tagFilter))
    }
    return result
  }, [customers, search, channelFilter, tagFilter])

  function getChannel(c: Customer): string {
    if (c.messenger_id) return 'Messenger'
    if (c.instagram_id) return 'Instagram'
    if (c.whatsapp_id) return 'WhatsApp'
    return 'Вэб'
  }

  function getChannelConfig(c: Customer): { label: string; dot: string; bg: string; text: string } {
    if (c.messenger_id) return { label: 'Messenger', dot: 'bg-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-400' }
    if (c.instagram_id) return { label: 'Instagram', dot: 'bg-pink-400', bg: 'bg-pink-500/10', text: 'text-pink-400' }
    if (c.whatsapp_id) return { label: 'WhatsApp', dot: 'bg-green-400', bg: 'bg-green-500/10', text: 'text-green-400' }
    return { label: 'Вэб', dot: 'bg-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-400' }
  }

  function getCustomerStats(c: Customer) {
    const orders = c.orders || []
    const activeOrders = orders.filter(o => o.status !== 'cancelled')
    return {
      orderCount: activeOrders.length,
      totalSpent: activeOrders.reduce((s, o) => s + Number(o.total_amount), 0),
    }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filteredCustomers.map(c => {
      const stats = getCustomerStats(c)
      return {
        'Нэр': c.name || '',
        'Утас': c.phone || '',
        'Имэйл': c.email || '',
        'Суваг': getChannel(c),
        'Захиалга тоо': stats.orderCount,
        'Нийт зарцуулсан': stats.totalSpent,
        'Бүртгүүлсэн': new Date(c.created_at).toLocaleDateString('mn-MN'),
      }
    })
    exportToFile(data, `харилцагч_${new Date().toISOString().slice(0, 10)}`, format, 'Харилцагч')
  }

  const totalRevenue = customers.reduce((s, c) => {
    const stats = getCustomerStats(c)
    return s + stats.totalSpent
  }, 0)

  const thisMonthNew = customers.filter(c => {
    const d = new Date(c.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Харилцагч</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Нийт {customers.length} харилцагч
            {filteredCustomers.length !== customers.length && ` · ${filteredCustomers.length} илэрц`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customers.length > 0 && (
            <div className="relative group">
              <button className="px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-400 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-[#141520] border border-white/[0.1] rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px] shadow-xl">
                <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">Excel</button>
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">CSV</button>
              </div>
            </div>
          )}
          <Link href="/dashboard/customers/new" className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
              Нэмэх
            </span>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Нийт харилцагч', value: customers.length, gradient: 'from-slate-500/20 to-slate-600/5' },
          { label: 'Энэ сар шинэ', value: thisMonthNew, gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Захиалгатай', value: customers.filter(c => c.orders && c.orders.length > 0).length, gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Нийт орлого', value: null, display: `${totalRevenue.toLocaleString()}₮`, gradient: 'from-purple-500/20 to-purple-600/5' },
        ].map((stat) => (
          <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1.5 relative">
              {stat.value !== null ? stat.value : stat.display}
            </p>
          </div>
        ))}
      </div>

      {/* Tag filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setTagFilter('')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            !tagFilter
              ? 'bg-white/[0.08] text-white border border-white/[0.1]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          Бүгд
          <span className={`text-[10px] ${!tagFilter ? 'text-slate-300' : 'text-slate-600'}`}>{customers.length}</span>
        </button>
        {(Object.keys(TAG_CONFIG) as TagKey[]).map((key) => {
          const tc = TAG_CONFIG[key]
          const count = tagCounts[key]
          if (count === 0) return null
          return (
            <button
              key={key}
              onClick={() => setTagFilter(tagFilter === key ? '' : key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tagFilter === key
                  ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tc.dot} ${tagFilter === key ? 'opacity-100' : 'opacity-50'}`} />
              {tc.label}
              <span className={`text-[10px] ${tagFilter === key ? 'text-slate-300' : 'text-slate-600'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search & channel filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Нэр, утас, имэйл хайх..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10 transition-all" />
        </div>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-300 text-sm focus:outline-none focus:border-white/[0.15]">
          <option value="">Бүх суваг</option>
          <option value="messenger">Messenger</option>
          <option value="instagram">Instagram</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="web">Вэб</option>
        </select>
        {(search || channelFilter || tagFilter) && (
          <button onClick={() => { setSearch(''); setChannelFilter(''); setTagFilter('') }}
            className="px-3 py-2.5 text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Customers Table */}
      {filteredCustomers.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(130px,1.3fr)_minmax(90px,0.9fr)_minmax(70px,0.6fr)_minmax(130px,1.4fr)_minmax(50px,0.4fr)_minmax(70px,0.6fr)_minmax(65px,0.5fr)_minmax(50px,0.4fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Харилцагч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Холбоо барих</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Суваг</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Шошго</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-center">Захиалга</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Зарцуулсан</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Огноо</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Үйлдэл</p>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/[0.04]">
            {filteredCustomers.map((customer) => {
              const stats = getCustomerStats(customer)
              const ch = getChannelConfig(customer)
              const tags = getCustomerTags(customer)
              const isExpanded = expandedId === customer.id

              return (
                <div key={customer.id}>
                  {/* Desktop Row */}
                  <div className="hidden md:grid grid-cols-[minmax(130px,1.3fr)_minmax(90px,0.9fr)_minmax(70px,0.6fr)_minmax(130px,1.4fr)_minmax(50px,0.4fr)_minmax(70px,0.6fr)_minmax(65px,0.5fr)_minmax(50px,0.4fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full flex items-center justify-center shrink-0 border border-white/[0.08]">
                        <span className="text-white text-xs font-semibold">{customer.name?.charAt(0)?.toUpperCase() || '?'}</span>
                      </div>
                      <Link href={`/dashboard/customers/${customer.id}`} className="text-white text-sm font-medium hover:text-blue-400 transition-colors truncate">
                        {customer.name || 'Нэргүй'}
                      </Link>
                    </div>
                    <div className="min-w-0">
                      {customer.phone && <p className="text-slate-300 text-sm truncate">{customer.phone}</p>}
                      {customer.email && <p className="text-slate-600 text-[11px] truncate">{customer.email}</p>}
                      {!customer.phone && !customer.email && <span className="text-slate-600 text-sm">—</span>}
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${ch.bg} ${ch.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ch.dot}`} />
                        {ch.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => {
                        const tc = TAG_CONFIG[tag]
                        return (
                          <span key={tag} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${tc.bg} ${tc.text}`}>
                            <span className={`w-1 h-1 rounded-full ${tc.dot}`} />
                            {tc.label}
                          </span>
                        )
                      })}
                      {tags.length === 0 && <span className="text-slate-600 text-xs">—</span>}
                    </div>
                    <div className="text-center">
                      <span className="text-white text-sm">{stats.orderCount}</span>
                    </div>
                    <div>
                      <span className="text-white text-sm font-medium">{stats.totalSpent.toLocaleString()}₮</span>
                    </div>
                    <div>
                      <span className="text-slate-600 text-xs">{new Date(customer.created_at).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/dashboard/customers/${customer.id}`} className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </Link>
                      <Link href={`/dashboard/chat?customer=${customer.id}`} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-white/[0.06] rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                      </Link>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full flex items-center justify-center shrink-0 border border-white/[0.08]">
                        <span className="text-white text-xs font-semibold">{customer.name?.charAt(0)?.toUpperCase() || '?'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{customer.name || 'Нэргүй'}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${ch.bg} ${ch.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ch.dot}`} />
                            {ch.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map((tag) => {
                            const tc = TAG_CONFIG[tag]
                            return (
                              <span key={tag} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${tc.bg} ${tc.text}`}>
                                <span className={`w-1 h-1 rounded-full ${tc.dot}`} />
                                {tc.label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                      <span className="text-white text-sm font-medium shrink-0">{stats.totalSpent.toLocaleString()}₮</span>
                      <svg className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2 bg-white/[0.02]">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Захиалга</p>
                            <p className="text-white">{stats.orderCount}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Бүртгүүлсэн</p>
                            <p className="text-slate-400">{new Date(customer.created_at).toLocaleDateString('mn-MN')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Link href={`/dashboard/customers/${customer.id}`} className="flex-1 py-2 text-center text-xs text-slate-400 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg transition-all font-medium">Дэлгэрэнгүй</Link>
                          <Link href={`/dashboard/chat?customer=${customer.id}`} className="flex-1 py-2 text-center text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-all font-medium">Чат</Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
            <span className="text-slate-600 text-xs">{filteredCustomers.length} харилцагч</span>
          </div>
        </div>
      ) : customers.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <p className="text-slate-500">Хайлтад тохирох харилцагч олдсонгүй</p>
          <button onClick={() => { setSearch(''); setChannelFilter(''); setTagFilter('') }} className="mt-4 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all">Шүүлтүүр цэвэрлэх</button>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Харилцагч байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">Messenger холбосны дараа chatbot-той ярьсан хэрэглэгчид энд харагдана</p>
          <Link href="/dashboard/settings/integrations" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 inline-block">
            Messenger холбох
          </Link>
        </div>
      )}
    </div>
  )
}
