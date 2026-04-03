'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  driver_id: string
  driver_name: string
  driver_phone: string
  driver_status: string
  last_message: string | null
  last_message_sender: string | null
  last_message_at: string | null
  unread_count: number
}

interface Message {
  id: string
  sender_type: 'store' | 'driver'
  message: string
  read_at: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active:   { label: 'Идэвхтэй', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  busy:     { label: 'Завгүй',    dot: 'bg-amber-400',   bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  offline:  { label: 'Офлайн',    dot: 'bg-slate-400',   bg: 'bg-slate-500/10',   text: 'text-slate-400' },
  on_break: { label: 'Завсарлага', dot: 'bg-orange-400',  bg: 'bg-orange-500/10',  text: 'text-orange-400' },
}

export default function DriverChatClient() {
  const supabase = useMemo(() => createClient(), [])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const refreshConversations = useCallback(async () => {
    const res = await fetch('/api/driver-chat')
    if (res.ok) {
      const data = await res.json()
      setConversations(data.conversations)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/driver-chat')
      if (cancelled) return
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedDriver) return
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/driver-chat/${selectedDriver}`)
      if (cancelled) return
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages.reverse())
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedDriver])

  useEffect(() => {
    if (!selectedDriver) return

    const channel = supabase
      .channel(`driver-chat-${selectedDriver}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_messages',
          filter: `driver_id=eq.${selectedDriver}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => [...prev, newMsg])
          refreshConversations()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedDriver, supabase, refreshConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedDriver || sending) return

    setSending(true)
    const res = await fetch(`/api/driver-chat/${selectedDriver}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage.trim() }),
    })

    if (res.ok) {
      const data = await res.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage('')
      refreshConversations()
    }
    setSending(false)
  }

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(c =>
      c.driver_name.toLowerCase().includes(q) ||
      c.driver_phone.includes(q)
    )
  }, [conversations, searchQuery])

  const selectedConv = conversations.find(c => c.driver_id === selectedDriver)
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0)

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

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Ачааллаж байна...</p>
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

      {/* Sidebar — Driver List */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 absolute lg:relative inset-0 lg:inset-auto z-[5] bg-[#0c0f1a]/95 lg:bg-white/[0.02] backdrop-blur-xl border-r border-white/[0.06] flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Жолоочид</h2>
            {totalUnread > 0 && (
              <span className="min-w-[22px] h-[22px] bg-blue-500 rounded-full flex items-center justify-center px-1.5">
                <span className="text-[10px] text-white font-bold">{totalUnread}</span>
              </span>
            )}
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Жолооч хайх..."
              className="w-full pl-10 pr-4 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] transition-all"
            />
          </div>
        </div>

        {/* Driver list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125V14.25m17.25 0V4.125c0-.621-.504-1.125-1.125-1.125H13.5V7.5l-2.25-1.313L9 7.5V3H5.625A1.125 1.125 0 0 0 4.5 4.125v10.125" /></svg>
              </div>
              <p className="text-slate-400 text-sm">Жолооч байхгүй</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = selectedDriver === conv.driver_id
              const hasUnread = conv.unread_count > 0
              const sc = STATUS_CONFIG[conv.driver_status] || STATUS_CONFIG.offline

              return (
                <button
                  key={conv.driver_id}
                  onClick={() => { setSelectedDriver(conv.driver_id); setShowSidebar(false) }}
                  className={`w-full text-left p-4 border-b border-white/[0.04] hover:bg-white/[0.04] transition-all relative ${
                    isSelected ? 'bg-white/[0.06]' : ''
                  }`}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-blue-500 rounded-r" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/80 to-blue-500/80 rounded-xl flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">{conv.driver_name.charAt(0)}</span>
                      </div>
                      {/* Status dot */}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0c0f1a] ${sc.dot}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-slate-300 font-medium'}`}>
                          {conv.driver_name}
                        </span>
                        {conv.last_message_at && (
                          <span className="text-[10px] text-slate-600 shrink-0">
                            {formatTime(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className={`text-xs truncate mt-0.5 ${hasUnread ? 'text-slate-300' : 'text-slate-500'}`}>
                          {conv.last_message_sender === 'store' && (
                            <span className="text-slate-600">Та: </span>
                          )}
                          {conv.last_message}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                          <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                        {hasUnread && (
                          <span className="min-w-[18px] h-[18px] bg-blue-500 rounded-full flex items-center justify-center px-1">
                            <span className="text-[10px] text-white font-bold">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
          <span className="text-slate-600 text-xs">{conversations.length} жолооч</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 ${showSidebar ? 'hidden lg:flex' : 'flex'} flex-col bg-white/[0.01]`}>
        {selectedDriver && selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-3 bg-white/[0.02]">
              {/* Back button on mobile */}
              <button
                onClick={() => setShowSidebar(true)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all mr-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500/80 to-blue-500/80 rounded-xl flex items-center justify-center">
                <span className="text-white font-semibold text-sm">{selectedConv.driver_name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{selectedConv.driver_name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">{selectedConv.driver_phone}</span>
                  {(() => {
                    const sc = STATUS_CONFIG[selectedConv.driver_status] || STATUS_CONFIG.offline
                    return (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    )
                  })()}
                </div>
              </div>
              <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
                    </div>
                    <p className="text-slate-500 text-sm">Мессеж байхгүй</p>
                    <p className="text-slate-600 text-xs mt-1">Эхлээд мессеж бичнэ үү</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isStore = msg.sender_type === 'store'
                  const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString()

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <span className="text-[10px] text-slate-600 bg-white/[0.04] px-3 py-1 rounded-full">
                            {new Date(msg.created_at).toLocaleDateString('mn-MN', { month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isStore ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 text-sm ${
                          isStore
                            ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-md shadow-lg shadow-blue-500/10'
                            : 'bg-white/[0.06] text-white rounded-2xl rounded-bl-md border border-white/[0.06]'
                        }`}>
                          <p className="leading-relaxed">{msg.message}</p>
                          <div className={`flex items-center gap-1.5 mt-1 ${isStore ? 'justify-end' : ''}`}>
                            <span className={`text-[10px] ${isStore ? 'text-blue-200' : 'text-slate-500'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isStore && msg.read_at && (
                              <svg className="w-3 h-3 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.02]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Мессеж бичих..."
                  className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                  )}
                  <span className="hidden sm:inline">Илгээх</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center max-w-lg px-6">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-2xl blur-xl" />
                <div className="relative w-20 h-20 bg-white/[0.04] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                  <svg className="w-9 h-9 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125V14.25m17.25 0V4.125c0-.621-.504-1.125-1.125-1.125H13.5V7.5l-2.25-1.313L9 7.5V3H5.625A1.125 1.125 0 0 0 4.5 4.125v10.125" /></svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Жолооч сонгоно уу</h3>
              <p className="text-slate-500 text-sm">
                Зүүн талаас жолоочийг сонгож мессеж илгээнэ үү
              </p>

              {conversations.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
                  {[
                    { label: 'Нийт жолооч', value: conversations.length, gradient: 'from-slate-500/20 to-slate-600/5' },
                    { label: 'Уншаагүй', value: totalUnread, gradient: 'from-blue-500/20 to-blue-600/5' },
                    { label: 'Идэвхтэй', value: conversations.filter(c => c.driver_status === 'active').length, gradient: 'from-emerald-500/20 to-emerald-600/5' },
                  ].map((stat) => (
                    <div key={stat.label} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{stat.label}</p>
                      <p className="text-2xl font-bold text-white mt-1 relative">{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
