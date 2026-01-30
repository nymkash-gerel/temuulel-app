'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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

const LEVEL_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Маш яаралтай' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Яаралтай' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Дунд' },
}

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [hasMessenger, setHasMessenger] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  // Load store and conversations
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: store } = await supabase
        .from('stores')
        .select('id, facebook_page_id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        setHasMessenger(!!store.facebook_page_id)

        const { data: convs } = await supabase
          .from('conversations')
          .select(`
            *,
            customers(name, messenger_id, instagram_id),
            messages(content, is_from_customer, is_ai_response, created_at, metadata)
          `)
          .eq('store_id', store.id)
          .order('updated_at', { ascending: false })
          .limit(50)

        setConversations((convs || []) as Conversation[])
      }

      setLoading(false)
    }

    load()
  }, [supabase, router])

  // Real-time subscription for conversation updates
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
        () => {
          // Reload conversations on any change
          loadConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  async function loadConversations() {
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
  }

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    let result = conversations

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((conv) => {
        const name = conv.customers?.name?.toLowerCase() || ''
        const lastMsg = conv.messages?.[conv.messages.length - 1]?.content?.toLowerCase() || ''
        return name.includes(q) || lastMsg.includes(q)
      })
    }

    // Apply type filter
    if (filter === 'unanswered') {
      result = result.filter((conv) => {
        const msgs = conv.messages || []
        if (msgs.length === 0) return false
        const lastMsg = msgs[msgs.length - 1]
        return lastMsg.is_from_customer
      })
    } else if (filter === 'ai') {
      result = result.filter((conv) => {
        const msgs = conv.messages || []
        return msgs.some((m) => m.is_ai_response)
      })
    } else if (filter === 'escalated') {
      result = result.filter((conv) =>
        conv.escalation_level === 'high' || conv.escalation_level === 'critical'
      )
    } else if (filter === 'positive' || filter === 'negative') {
      result = result.filter((conv) => {
        const msgs = conv.messages || []
        const lastCustomer = [...msgs].reverse().find(m => m.is_from_customer)
        return lastCustomer?.metadata?.sentiment === filter
      })
    }

    // Sort escalated conversations to top
    result.sort((a, b) => {
      const levelOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      const aOrder = levelOrder[a.escalation_level] ?? 3
      const bOrder = levelOrder[b.escalation_level] ?? 3
      if (aOrder !== bOrder) return aOrder - bOrder
      return 0 // Keep existing time-based order for same level
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

  function getChannelIndicator(customer: Conversation['customers']) {
    if (!customer) return { color: 'bg-slate-400', label: 'Вэб' }
    if (customer.messenger_id) return { color: 'bg-blue-400', label: 'Messenger' }
    if (customer.instagram_id) return { color: 'bg-pink-400', label: 'Instagram' }
    return { color: 'bg-slate-400', label: 'Вэб' }
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Чат ачааллаж байна...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex relative">
      {/* Mobile toggle button */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="lg:hidden absolute top-2 left-2 z-10 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all"
      >
        {showSidebar ? '✕' : '☰'}
      </button>

      {/* Conversations List */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 absolute lg:relative inset-0 lg:inset-auto z-[5] bg-slate-800/30 lg:bg-slate-800/30 border-r border-slate-700 flex-col`}>
        {/* Search */}
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Харилцагч хайх..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-slate-700 flex items-center gap-2 overflow-x-auto">
          {([
            { key: 'all' as FilterType, label: 'Бүгд', count: conversations.length },
            {
              key: 'unanswered' as FilterType,
              label: 'Хариулаагүй',
              count: conversations.filter((c) => {
                const msgs = c.messages || []
                return msgs.length > 0 && msgs[msgs.length - 1].is_from_customer
              }).length,
            },
            {
              key: 'ai' as FilterType,
              label: 'AI',
              count: conversations.filter((c) =>
                (c.messages || []).some((m) => m.is_ai_response)
              ).length,
            },
            {
              key: 'escalated' as FilterType,
              label: 'Шилжсэн',
              count: conversations.filter((c) =>
                c.escalation_level === 'high' || c.escalation_level === 'critical'
              ).length,
            },
            {
              key: 'negative' as FilterType,
              label: 'Сөрөг',
              count: conversations.filter((c) => {
                const msgs = c.messages || []
                const last = [...msgs].reverse().find(m => m.is_from_customer)
                return last?.metadata?.sentiment === 'negative'
              }).length,
            },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-700/50'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 text-xs ${
                  filter === f.key ? 'text-blue-400' : 'text-slate-500'
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const lastMessage = getLastMessage(conv)
              const channel = getChannelIndicator(conv.customers)
              const hasUnread = conv.unread_count > 0

              return (
                <Link
                  key={conv.id}
                  href={`/dashboard/chat/${conv.id}`}
                  className="flex items-start gap-3 p-4 hover:bg-slate-700/30 border-b border-slate-700/50 transition-all group"
                >
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium">
                        {conv.customers?.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-slate-800 flex items-center justify-center">
                        <span className="text-[10px] text-white font-bold leading-none">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`font-medium truncate ${hasUnread ? 'text-white' : 'text-slate-300'}`}>
                        {conv.customers?.name || 'Нэргүй'}
                      </p>
                      <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                        {formatTime(conv.updated_at)}
                      </span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${hasUnread ? 'text-slate-300 font-medium' : 'text-slate-400'}`}>
                      {lastMessage?.is_ai_response && '🤖 '}
                      {!lastMessage?.is_from_customer && !lastMessage?.is_ai_response && 'Та: '}
                      {lastMessage?.content || 'Мессеж байхгүй'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${channel.color}`} />
                      <span className="text-xs text-slate-500">{channel.label}</span>
                      {lastMessage?.is_ai_response && (
                        <span className="text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          AI
                        </span>
                      )}
                      {LEVEL_BADGE[conv.escalation_level] && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${LEVEL_BADGE[conv.escalation_level].bg} ${LEVEL_BADGE[conv.escalation_level].text}`}>
                          {LEVEL_BADGE[conv.escalation_level].label}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💬</span>
              </div>
              {searchQuery || filter !== 'all' ? (
                <>
                  <p className="text-slate-400 text-sm">Хайлтын үр дүн олдсонгүй</p>
                  <button
                    onClick={() => { setSearchQuery(''); setFilter('all') }}
                    className="text-blue-400 text-sm mt-2 hover:text-blue-300"
                  >
                    Шүүлтүүр цэвэрлэх
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm">Чат байхгүй байна</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Messenger холбосны дараа энд харагдана
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area - Empty State */}
      <div className={`flex-1 ${showSidebar ? 'hidden lg:flex' : 'flex'} flex-col items-center justify-center bg-slate-800/20`}>
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">💬</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Чат сонгоно уу</h3>
          <p className="text-slate-400 max-w-sm">
            Зүүн талаас харилцагч сонгож чатыг харна уу. AI автоматаар хариулсан бол шар өнгөтэй харагдана.
          </p>

          {/* Stats */}
          {conversations.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 max-w-md lg:max-w-none mx-auto">
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl">
                <p className="text-lg font-bold text-white">{conversations.length}</p>
                <p className="text-xs text-slate-400">Нийт чат</p>
              </div>
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl">
                <p className="text-lg font-bold text-red-400">
                  {conversations.filter((c) => {
                    const msgs = c.messages || []
                    return msgs.length > 0 && msgs[msgs.length - 1].is_from_customer
                  }).length}
                </p>
                <p className="text-xs text-slate-400">Хариулаагүй</p>
              </div>
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl">
                <p className="text-lg font-bold text-amber-400">
                  {conversations.filter((c) =>
                    (c.messages || []).some((m) => m.is_ai_response)
                  ).length}
                </p>
                <p className="text-xs text-slate-400">AI хариулсан</p>
              </div>
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl">
                <p className="text-lg font-bold text-orange-400">
                  {conversations.filter((c) =>
                    c.escalation_level === 'high' || c.escalation_level === 'critical'
                  ).length}
                </p>
                <p className="text-xs text-slate-400">Шилжсэн</p>
              </div>
            </div>
          )}

          {!hasMessenger && (
            <Link
              href="/dashboard/settings/integrations"
              className="inline-flex items-center gap-2 px-6 py-3 mt-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all"
            >
              <span>💬</span>
              <span>Messenger холбох</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
