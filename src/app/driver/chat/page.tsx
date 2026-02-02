'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Message {
  id: string
  sender_type: 'store' | 'driver'
  message: string
  read_at: string | null
  created_at: string
}

export default function DriverChatPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [storeName, setStoreName] = useState('Дэлгүүр')
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/driver/chat')
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages.reverse())
      setStoreName(data.store_name)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('driver-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_messages',
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    const res = await fetch('/api/driver/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage.trim() }),
    })

    if (res.ok) {
      const data = await res.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage('')
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-slate-800 border-b border-slate-700">
        <Link href="/driver" className="text-blue-400 text-sm">← Буцах</Link>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{storeName}</p>
          <p className="text-slate-400 text-xs">Дэлгүүрийн эзэнтэй чат</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Мессеж байхгүй</p>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === 'driver' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  msg.sender_type === 'driver'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-slate-700 text-white rounded-bl-md'
                }`}
              >
                <p>{msg.message}</p>
                <p className={`text-xs mt-1 ${msg.sender_type === 'driver' ? 'text-blue-200' : 'text-slate-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Мессеж бичих..."
            className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {sending ? '...' : 'Илгээх'}
          </button>
        </div>
      </div>
    </div>
  )
}
