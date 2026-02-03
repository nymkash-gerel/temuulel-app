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

export default function DriverChatPage() {
  const supabase = useMemo(() => createClient(), [])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
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

  // Realtime subscription
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
          // Update unread count in conversations
          refreshConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDriver, supabase, refreshConversations])

  // Scroll to bottom on new messages
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

  const selectedConv = conversations.find(c => c.driver_id === selectedDriver)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Жолоочтой чат</h1>

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Driver List */}
        <div className="w-80 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-semibold text-sm">Жолоочид</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Жолооч байхгүй</p>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.driver_id}
                  onClick={() => setSelectedDriver(conv.driver_id)}
                  className={`w-full text-left p-4 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors ${
                    selectedDriver === conv.driver_id ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium">{conv.driver_name}</span>
                    {conv.unread_count > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="text-slate-400 text-xs truncate">
                      {conv.last_message_sender === 'store' ? 'Та: ' : ''}
                      {conv.last_message}
                    </p>
                  )}
                  {conv.last_message_at && (
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(conv.last_message_at).toLocaleString('mn-MN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          {selectedDriver && selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
                  {selectedConv.driver_name.charAt(0)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{selectedConv.driver_name}</p>
                  <p className="text-slate-400 text-xs">{selectedConv.driver_phone}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">Мессеж байхгүй. Эхлээд бичнэ үү.</p>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'store' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                          msg.sender_type === 'store'
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-slate-700 text-white rounded-bl-md'
                        }`}
                      >
                        <p>{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.sender_type === 'store' ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Мессеж бичих..."
                    className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {sending ? '...' : 'Илгээх'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-500 text-sm">Жолооч сонгоно уу</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
