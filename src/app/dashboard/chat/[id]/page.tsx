'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  content: string
  is_from_customer: boolean
  is_ai_response: boolean
  created_at: string
  metadata?: Record<string, unknown> | null
}

interface Conversation {
  id: string
  status: string
  channel: string
  updated_at: string
  escalation_score: number
  escalation_level: string
  escalated_at: string | null
  assigned_to: string | null
  customers: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    messenger_id: string | null
    instagram_id: string | null
  } | null
}

const ESC_LEVEL_LABELS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Маш яаралтай' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Яаралтай' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Дунд' },
}

const QUICK_REPLIES = [
  'Сайн байна уу! Танд юугаар туслах вэ?',
  'Баярлалаа, захиалга баталгаажлаа.',
  'Уучлаарай, одоогоор нөөцөд байхгүй байна.',
  'Хүргэлт 1-3 хоногт хийгдэнэ.',
  'Та утасны дугаараа үлдээнэ үү?',
]

function SentimentTagsBlock({ metadata }: { metadata: Record<string, unknown> }) {
  const sentiment = metadata.sentiment as string | undefined
  const tags = Array.isArray(metadata.tags) ? metadata.tags as string[] : []
  if (!sentiment && tags.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {sentiment && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          sentiment === 'positive'
            ? 'bg-emerald-500/20 text-emerald-400'
            : sentiment === 'negative'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-slate-600/30 text-slate-400'
        }`}>
          {sentiment === 'positive' ? 'Эерэг' : sentiment === 'negative' ? 'Сөрөг' : 'Төвийг'}
        </span>
      )}
      {tags.map((tag: string, i: number) => (
        <span key={i} className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/20">
          #{tag}
        </span>
      ))}
    </div>
  )
}

function ComplaintSummaryBlock({ data }: { data: Record<string, unknown> }) {
  const cs = data as { summary?: string; main_issues?: string[]; action_hint?: string }
  return (
    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs">
      <p className="text-red-300 font-medium mb-1">Гомдлын товчлол:</p>
      {cs.summary && <p className="text-red-200">{cs.summary}</p>}
      {cs.main_issues && cs.main_issues.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {cs.main_issues.map((issue: string, i: number) => (
            <span key={i} className="px-1.5 py-0.5 bg-red-500/20 rounded text-red-300">{issue}</span>
          ))}
        </div>
      )}
      {cs.action_hint && (
        <p className="mt-1 text-amber-300">Зөвлөгөө: {cs.action_hint}</p>
      )}
    </div>
  )
}

export default function ChatConversationPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load conversation and messages
  useEffect(() => {
    async function loadConversation() {
      const { data: conv } = await supabase
        .from('conversations')
        .select(`
          *,
          customers(id, name, phone, email, messenger_id, instagram_id)
        `)
        .eq('id', conversationId)
        .single()

      if (!conv) {
        router.push('/dashboard/chat')
        return
      }

      setConversation(conv)

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100)

      setMessages((msgs || []) as Message[])
      setLoading(false)

      // Reset unread count when agent opens conversation
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
    }

    loadConversation()
  }, [conversationId, supabase, router])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Real-time subscription for new messages + conversation metadata
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // Reset unread since agent has the conversation open
          if (newMsg.is_from_customer) {
            supabase
              .from('conversations')
              .update({ unread_count: 0 })
              .eq('id', conversationId)
              .then()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Conversation
          setConversation((prev) =>
            prev ? { ...prev, status: updated.status, escalation_level: updated.escalation_level, escalation_score: updated.escalation_score, escalated_at: updated.escalated_at, assigned_to: updated.assigned_to } : prev
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  async function sendMessage(content: string) {
    if (!content.trim() || sending) return

    setSending(true)
    setNewMessage('')
    setShowQuickReplies(false)

    // Optimistic update
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      is_from_customer: false,
      is_ai_response: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: content.trim(),
        is_from_customer: false,
        is_ai_response: false,
      })
      .select()
      .single()

    if (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
    } else if (data) {
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? data as Message : m))
      )
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString(), status: 'active' })
      .eq('id', conversationId)

    setSending(false)
  }

  async function handleSendAiResponse() {
    if (!conversation) return

    setSending(true)

    try {
      const res = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          customer_message: messages.filter((m) => m.is_from_customer).pop()?.content || '',
        }),
      })

      if (!res.ok) throw new Error('AI response failed')

      const data = await res.json()

      if (data.response) {
        // AI response is saved by the API, realtime will pick it up
        // But also add optimistically
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          content: data.response,
          is_from_customer: false,
          is_ai_response: true,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, aiMsg])
      }
    } catch {
      // Silently fail - could show toast
    }

    setSending(false)
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Дөнгөж сая'
    if (diffMins < 60) return `${diffMins} мин`
    if (diffMins < 1440) {
      return date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function getChannelInfo() {
    if (!conversation?.customers) return { label: 'Вэб', color: 'bg-slate-400' }
    if (conversation.customers.messenger_id) return { label: 'Messenger', color: 'bg-blue-400' }
    if (conversation.customers.instagram_id) return { label: 'Instagram', color: 'bg-pink-400' }
    return { label: 'Вэб', color: 'bg-slate-400' }
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

  if (!conversation) return null

  const channel = getChannelInfo()

  return (
    <div className="h-[calc(100vh-8rem)] flex">
      {/* Chat Messages Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/30">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/chat"
              className="text-slate-400 hover:text-white transition-colors lg:hidden"
            >
              ← Буцах
            </Link>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">
                {conversation.customers?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h3 className="text-white font-medium">
                {conversation.customers?.name || 'Нэргүй'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${channel.color}`} />
                <span className="text-xs text-slate-400">{channel.label}</span>
                {conversation.customers?.phone && (
                  <span className="text-xs text-slate-500">
                    | {conversation.customers.phone}
                  </span>
                )}
                {ESC_LEVEL_LABELS[conversation.escalation_level] && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESC_LEVEL_LABELS[conversation.escalation_level].bg} ${ESC_LEVEL_LABELS[conversation.escalation_level].text}`}>
                    {ESC_LEVEL_LABELS[conversation.escalation_level].label}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* AI Toggle */}
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                aiEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600'
              }`}
            >
              <span>🤖</span>
              <span>AI {aiEnabled ? 'Идэвхтэй' : 'Унтраасан'}</span>
            </button>

            {/* Customer Info Link */}
            {conversation.customers?.id && (
              <Link
                href={`/dashboard/customers/${conversation.customers.id}`}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all"
              >
                Дэлгэрэнгүй
              </Link>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">💬</span>
              </div>
              <p className="text-slate-400">Мессеж байхгүй байна</p>
              <p className="text-slate-500 text-sm mt-1">
                Харилцагч мессеж бичихэд энд харагдана
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.is_from_customer ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    msg.is_from_customer
                      ? 'bg-slate-700/50 text-white rounded-bl-md'
                      : msg.is_ai_response
                        ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30 rounded-br-md'
                        : 'bg-blue-500 text-white rounded-br-md'
                  }`}
                >
                  {msg.is_ai_response && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs">🤖</span>
                      <span className="text-xs text-amber-400 font-medium">AI хариулт</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {/* Complaint summary from AI (shown on escalation messages) */}
                  {(msg.metadata?.type === 'escalation' && msg.metadata?.complaint_summary != null) ? (
                    <ComplaintSummaryBlock data={msg.metadata.complaint_summary as Record<string, unknown>} />
                  ) : null}
                  {/* Sentiment & tags (customer messages only) */}
                  {msg.is_from_customer && msg.metadata && (
                    <SentimentTagsBlock metadata={msg.metadata as Record<string, unknown>} />
                  )}
                  <p className={`text-xs mt-1.5 ${
                    msg.is_from_customer ? 'text-slate-500' :
                    msg.is_ai_response ? 'text-amber-500/70' : 'text-blue-200/70'
                  }`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        {showQuickReplies && (
          <div className="px-6 py-3 border-t border-slate-700/50 bg-slate-800/30">
            <p className="text-xs text-slate-400 mb-2">Түргэн хариулт:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(reply)}
                  className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-600 transition-all"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30">
          <div className="flex items-end gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className={`p-2.5 rounded-xl transition-all ${
                  showQuickReplies
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                }`}
                title="Түргэн хариулт"
              >
                ⚡
              </button>
              <button
                onClick={handleSendAiResponse}
                disabled={sending || messages.length === 0}
                className="p-2.5 bg-slate-700/50 text-amber-400 hover:bg-amber-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="AI хариулт авах"
              >
                🤖
              </button>
            </div>

            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(newMessage)
                  }
                }}
                placeholder="Мессеж бичих... (Enter илгээх, Shift+Enter шинэ мөр)"
                rows={1}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none transition-all"
              />
            </div>

            <button
              onClick={() => sendMessage(newMessage)}
              disabled={!newMessage.trim() || sending}
              className="px-5 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {sending ? '...' : 'Илгээх'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Customer Info */}
      <div className="hidden xl:block w-72 border-l border-slate-700 bg-slate-800/20 overflow-y-auto">
        <div className="p-6">
          {/* Customer Avatar & Name */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-white font-medium">
                {conversation.customers?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <h4 className="text-white font-medium">
              {conversation.customers?.name || 'Нэргүй'}
            </h4>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${channel.color}`} />
              <span className="text-xs text-slate-400">{channel.label}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3 mb-6">
            <h5 className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Холбоо барих
            </h5>
            {conversation.customers?.phone && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">📱</span>
                <span className="text-slate-300">{conversation.customers.phone}</span>
              </div>
            )}
            {conversation.customers?.email && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">📧</span>
                <span className="text-slate-300">{conversation.customers.email}</span>
              </div>
            )}
            {conversation.customers?.messenger_id && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">💬</span>
                <span className="text-slate-300">Messenger холбогдсон</span>
              </div>
            )}
          </div>

          {/* Conversation Status */}
          <div className="space-y-3 mb-6">
            <h5 className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Чатын мэдээлэл
            </h5>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Статус</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                conversation.status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : conversation.status === 'closed'
                    ? 'bg-slate-500/20 text-slate-400'
                    : 'bg-amber-500/20 text-amber-400'
              }`}>
                {conversation.status === 'active' ? 'Идэвхтэй' :
                 conversation.status === 'closed' ? 'Хаагдсан' : 'Хүлээгдэж буй'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Нийт мессеж</span>
              <span className="text-white">{messages.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">AI хариулт</span>
              <span className="text-amber-400">
                {messages.filter((m) => m.is_ai_response).length}
              </span>
            </div>
            {conversation.escalation_level !== 'low' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Шилжилт</span>
                <span className={ESC_LEVEL_LABELS[conversation.escalation_level]?.text || 'text-slate-400'}>
                  {ESC_LEVEL_LABELS[conversation.escalation_level]?.label || conversation.escalation_level}
                  {' '}({conversation.escalation_score})
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <h5 className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">
              Үйлдэл
            </h5>
            {(conversation.escalation_level === 'high' || conversation.escalation_level === 'critical') && !conversation.assigned_to && (
              <button
                onClick={async () => {
                  await supabase
                    .from('conversations')
                    .update({
                      assigned_to: (await supabase.auth.getUser()).data.user?.id,
                      status: 'active',
                      escalation_score: 0,
                      escalation_level: 'low',
                    })
                    .eq('id', conversationId)
                  setConversation((prev) =>
                    prev ? { ...prev, status: 'active', escalation_score: 0, escalation_level: 'low', assigned_to: 'self' } : prev
                  )
                }}
                className="w-full py-2 text-sm text-white bg-orange-500/80 hover:bg-orange-500 border border-orange-500/50 rounded-lg transition-all font-medium"
              >
                Хүлээж авах
              </button>
            )}
            <button
              onClick={async () => {
                await supabase
                  .from('conversations')
                  .update({ status: conversation.status === 'closed' ? 'active' : 'closed' })
                  .eq('id', conversationId)
                setConversation((prev) =>
                  prev ? { ...prev, status: prev.status === 'closed' ? 'active' : 'closed' } : prev
                )
              }}
              className="w-full py-2 text-sm text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all"
            >
              {conversation.status === 'closed' ? 'Дахин нээх' : 'Чат хаах'}
            </button>
            {conversation.customers?.id && (
              <Link
                href={`/dashboard/customers/${conversation.customers.id}`}
                className="block w-full py-2 text-center text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all"
              >
                👤 Харилцагчийн мэдээлэл
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
