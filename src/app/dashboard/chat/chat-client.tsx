'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  id: string
  status: string
  channel: string
  updated_at: string
  unread_count: number
  escalation_score: number
  escalation_level: string
  escalated_at: string | null
  assigned_to: string | null
  customers: {
    name: string | null
    messenger_id: string | null
    instagram_id: string | null
  } | null
  messages: {
    content: string
    is_from_customer: boolean
    is_ai_response: boolean
    created_at: string
    metadata: Record<string, unknown> | null
  }[]
}

type FilterType = 'all' | 'unanswered' | 'ai' | 'escalated' | 'positive' | 'negative'

const LEVEL_BADGE: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  critical: { dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400', label: 'Маш яаралтай' },
  high:     { dot: 'bg-orange-400', bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Яаралтай' },
  medium:   { dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Дунд' },
}

const CHANNEL_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  messenger:  { label: 'Messenger',  dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400' },
  instagram:  { label: 'Instagram',  dot: 'bg-pink-400',   bg: 'bg-pink-500/10',   text: 'text-pink-400' },
  web:        { label: 'Вэб',        dot: 'bg-slate-400',  bg: 'bg-slate-500/10',  text: 'text-slate-400' },
}

const FILTER_CONFIG: Record<FilterType, { label: string; dot: string }> = {
  all:        { label: 'Бүгд',        dot: 'bg-slate-400' },
  unanswered: { label: 'Хариулаагүй', dot: 'bg-red-400' },
  ai:         { label: 'AI',          dot: 'bg-amber-400' },
  escalated:  { label: 'Шилжсэн',     dot: 'bg-orange-400' },
  positive:   { label: 'Эерэг',       dot: 'bg-emerald-400' },
  negative:   { label: 'Сөрөг',       dot: 'bg-red-400' },
}

export default function ChatClient({ storeId }: { storeId: string }) {
  const supabase = useMemo(() => createClient(), [])

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
const [hasMessenger, setHasMessenger] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  useEffect(() => {
    async function load() {
      if (!storeId) return

      const { data: storeRow } = await supabase
        .from('stores')
        .select('facebook_page_id')
        .eq('id', storeId)
        .single()
      setHasMessenger(!!storeRow?.facebook_page_id)

      const { data: convs } = await supabase
        .from('conversations')
        .select(`
          *,
          customers(name, messenger_id, instagram_id),
          messages(content, is_from_customer, is_ai_response, created_at, metadata)
        `)
        .eq('store_id', storeId)
        .order('updated_at', { ascending: false })
        .limit(50)

      setConversations((convs || []) as Conversation[])

      setLoading(false)
    }

    load()
  }, [supabase, storeId])

  const loadConversations = useCallback(async () => {
    if (!storeId) return

    const { data: convs } = await supabase
      .from('conversations')
      .select(`
        *,
        customers(name, messenger_id, instagram_id),
        messages(content, is_from_customer, is_ai_response, created_at, metadata)
      `)
      .eq('store_id', storeId)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (convs) setConversations(convs as Conversation[])
  }, [supabase, storeId])

  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `store_id=eq.${storeId}`,
        },
        () => { loadConversations() }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => { loadConversations() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId, supabase, loadConversations])

  const filterCounts = useMemo(() => {
    const unanswered = conversations.filter((c) => {
      const msgs = c.messages || []
      return msgs.length > 0 && msgs[msgs.length - 1].is_from_customer
    }).length
    const ai = conversations.filter((c) => (c.messages || []).some((m) => m.is_ai_response)).length
    const escalated = conversations.filter((c) => c.escalation_level === 'high' || c.escalation_level === 'critical').length
    const negative = conversations.filter((c) => {
      const msgs = c.messages || []
      const last = [...msgs].reverse().find(m => m.is_from_customer)
      return last?.metadata?.sentiment === 'negative'
    }).length
    const positive = conversations.filter((c) => {
      const msgs = c.messages || []
      const last = [...msgs].reverse().find(m => m.is_from_customer)
      return last?.metadata?.sentiment === 'positive'
    }).length
    return { all: conversations.length, unanswered, ai, escalated, negative, positive }
  }, [conversations])

  const filteredConversations = useMemo(() => {
    let result = conversations

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((conv) => {
        const name = conv.customers?.name?.toLowerCase() || ''
        const lastMsg = conv.messages?.[conv.messages.length - 1]?.content?.toLowerCase() || ''
        return name.includes(q) || lastMsg.includes(q)
      })
    }

    if (filter === 'unanswered') {
      result = result.filter((conv) => {
        const msgs = conv.messages || []
        if (msgs.length === 0) return false
        return msgs[msgs.length - 1].is_from_customer
      })
    } else if (filter === 'ai') {
      result = result.filter((conv) => (conv.messages || []).some((m) => m.is_ai_response))
    } else if (filter === 'escalated') {
      result = result.filter((conv) => conv.escalation_level === 'high' || conv.escalation_level === 'critical')
    } else if (filter === 'positive' || filter === 'negative') {
      result = result.filter((conv) => {
        const msgs = conv.messages || []
        const lastCustomer = [...msgs].reverse().find(m => m.is_from_customer)
        return lastCustomer?.metadata?.sentiment === filter
      })
    }

    result.sort((a, b) => {
      const levelOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      const aOrder = levelOrder[a.escalation_level] ?? 3
      const bOrder = levelOrder[b.escalation_level] ?? 3
      if (aOrder !== bOrder) return aOrder - bOrder
      return 0
    })

    return result
  }, [conversations, searchQuery, filter])

  function getLastMessage(conv: Conversation) {
    const msgs = conv.messages || []
    return msgs[msgs.length - 1] || null
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Дөнгөж сая'
    if (diffMins < 60) return `${diffMins} мин`
    if (diffHours < 24) return `${diffHours} цаг`
    if (diffDays < 7) return `${diffDays} өдөр`
    return date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })
  }

  function getChannelConfig(customer: Conversation['customers']) {
    if (!customer) return CHANNEL_CONFIG.web
    if (customer.messenger_id) return CHANNEL_CONFIG.messenger
    if (customer.instagram_id) return CHANNEL_CONFIG.instagram
    return CHANNEL_CONFIG.web
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Чат ачааллаж байна...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex relative rounded-2xl overflow-hidden border border-white/[0.06]">
      {/* Mobile toggle */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="lg:hidden absolute top-3 left-3 z-10 p-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-slate-300 transition-all backdrop-blur-sm"
      >
        {showSidebar ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
        )}
      </button>

      {/* Sidebar */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 absolute lg:relative inset-0 lg:inset-auto z-[5] bg-[#0c0f1a]/95 lg:bg-white/[0.02] backdrop-blur-xl border-r border-white/[0.06] flex-col`}>
        {/* Search */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Харилцагч хайх..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {(Object.keys(FILTER_CONFIG) as FilterType[]).map((key) => {
            const fc = FILTER_CONFIG[key]
            const count = filterCounts[key]
            if (key === 'positive' && count === 0) return null
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filter === key
                    ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${fc.dot} ${filter === key ? 'opacity-100' : 'opacity-50'}`} />
                {fc.label}
                {count > 0 && (
                  <span className={`text-[10px] ${filter === key ? 'text-slate-300' : 'text-slate-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const lastMessage = getLastMessage(conv)
              const channel = getChannelConfig(conv.customers)
              const hasUnread = conv.unread_count > 0
              const levelBadge = LEVEL_BADGE[conv.escalation_level]

              return (
                <Link
                  key={conv.id}
                  href={`/dashboard/chat/${conv.id}`}
                  onClick={() => setShowSidebar(false)}
                  className="flex items-start gap-3 p-4 hover:bg-white/[0.04] border-b border-white/[0.04] transition-all group relative"
                >
                  {/* Unread indicator line */}
                  {hasUnread && (
                    <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-blue-500 rounded-r" />
                  )}

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/80 to-cyan-500/80 rounded-xl flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {conv.customers?.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-500 rounded-full border-2 border-[#0c0f1a] flex items-center justify-center">
                        <span className="text-[10px] text-white font-bold leading-none">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      </span>
                    )}
                    {/* Channel dot */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0c0f1a] ${channel.dot}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-slate-300 font-medium'}`}>
                        {conv.customers?.name || 'Нэргүй'}
                      </p>
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {formatTime(conv.updated_at)}
                      </span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${hasUnread ? 'text-slate-300' : 'text-slate-500'}`}>
                      {lastMessage?.is_ai_response && (
                        <span className="inline-flex items-center gap-0.5 mr-1">
                          <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
                        </span>
                      )}
                      {!lastMessage?.is_from_customer && !lastMessage?.is_ai_response && (
                        <span className="text-slate-600">Та: </span>
                      )}
                      {lastMessage?.content || 'Мессеж байхгүй'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${channel.bg} ${channel.text}`}>
                        <span className={`w-1 h-1 rounded-full ${channel.dot}`} />
                        {channel.label}
                      </span>
                      {lastMessage?.is_ai_response && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400">
                          <span className="w-1 h-1 rounded-full bg-amber-400" />
                          AI
                        </span>
                      )}
                      {levelBadge && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${levelBadge.bg} ${levelBadge.text}`}>
                          <span className={`w-1 h-1 rounded-full ${levelBadge.dot}`} />
                          {levelBadge.label}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          ) : (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
              </div>
              {searchQuery || filter !== 'all' ? (
                <>
                  <p className="text-slate-400 text-sm">Хайлтын үр дүн олдсонгүй</p>
                  <button
                    onClick={() => { setSearchQuery(''); setFilter('all') }}
                    className="mt-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all"
                  >
                    Шүүлтүүр цэвэрлэх
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm">Чат байхгүй байна</p>
                  <p className="text-slate-600 text-xs mt-1">Messenger холбосны дараа энд харагдана</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
          <span className="text-slate-600 text-xs">{filteredConversations.length} / {conversations.length} чат</span>
        </div>
      </div>

      {/* Chat Area - Empty State */}
      <div className={`flex-1 ${showSidebar ? 'hidden lg:flex' : 'flex'} flex-col items-center justify-center bg-white/[0.01]`}>
        <div className="text-center max-w-lg px-6">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl blur-xl" />
            <div className="relative w-20 h-20 bg-white/[0.04] border border-white/[0.06] rounded-2xl flex items-center justify-center">
              <svg className="w-9 h-9 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Чат сонгоно уу</h3>
          <p className="text-slate-500 text-sm">
            Зүүн талаас харилцагч сонгож чатыг харна уу
          </p>

          {/* Stats */}
          {conversations.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
              {[
                { label: 'Нийт чат', value: conversations.length, gradient: 'from-slate-500/20 to-slate-600/5' },
                { label: 'Хариулаагүй', value: filterCounts.unanswered, gradient: 'from-red-500/20 to-red-600/5' },
                { label: 'AI хариулсан', value: filterCounts.ai, gradient: 'from-amber-500/20 to-amber-600/5' },
                { label: 'Шилжсэн', value: filterCounts.escalated, gradient: 'from-orange-500/20 to-orange-600/5' },
              ].map((stat) => (
                <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1 relative">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {!hasMessenger && (
            <Link
              href="/dashboard/settings/integrations"
              className="inline-flex items-center gap-2 px-6 py-3 mt-8 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-3.061a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" /></svg>
              Messenger холбох
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
