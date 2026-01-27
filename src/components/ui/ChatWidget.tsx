'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  id: string
  content: string
  is_from_customer: boolean
  is_ai_response: boolean
  created_at: string
}

interface ChatWidgetProps {
  storeId: string
  storeName: string
  accentColor?: string
}

export default function ChatWidget({
  storeId,
  storeName,
  accentColor = '#3b82f6',
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Generate or retrieve a visitor ID
  const getVisitorId = useCallback(() => {
    let visitorId = localStorage.getItem('temuulel_visitor_id')
    if (!visitorId) {
      visitorId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem('temuulel_visitor_id', visitorId)
    }
    return visitorId
  }, [])

  // Load existing session and messages
  useEffect(() => {
    if (!isOpen) return

    async function loadSession() {
      const visitorId = getVisitorId()

      try {
        const res = await fetch(
          `/api/chat?sender_id=${visitorId}&store_id=${storeId}&limit=20`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.conversation_id) {
            setConversationId(data.conversation_id)
          }
          if (data.messages?.length > 0) {
            setMessages(
              data.messages.map((m: { role: string; content: string; created_at: string; is_ai_response?: boolean }, i: number) => ({
                id: `loaded-${i}`,
                content: m.content,
                is_from_customer: m.role === 'user',
                is_ai_response: m.is_ai_response || m.role === 'assistant',
                created_at: m.created_at,
              }))
            )
          }
        }
      } catch {
        // Failed to load session
      }
    }

    loadSession()
  }, [isOpen, storeId, getVisitorId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || sending) return

    const content = input.trim()
    setInput('')
    setSending(true)

    // Add customer message optimistically
    const customerMsg: Message = {
      id: `customer-${Date.now()}`,
      content,
      is_from_customer: true,
      is_ai_response: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, customerMsg])

    const visitorId = getVisitorId()

    try {
      // Save customer message (this also creates conversation + customer if needed)
      const saveRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: visitorId,
          store_id: storeId,
          role: 'user',
          content,
        }),
      })

      let currentConversationId = conversationId

      if (saveRes.ok) {
        const saveData = await saveRes.json()
        if (saveData.conversation_id) {
          currentConversationId = saveData.conversation_id
          setConversationId(saveData.conversation_id)
        }
      }

      // Get AI response — pass conversation_id so widget API saves directly
      const aiRes = await fetch('/api/chat/widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          customer_message: content,
          sender_id: visitorId,
          conversation_id: currentConversationId,
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()

        // If AI is disabled or handoff, don't show AI response
        if (aiData.response) {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            content: aiData.response,
            is_from_customer: false,
            is_ai_response: true,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, aiMsg])
        } else if (aiData.handoff) {
          const handoffMsg: Message = {
            id: `handoff-${Date.now()}`,
            content: 'Таны мессежийг хүлээн авлаа. Манай ажилтан удахгүй холбогдоно.',
            is_from_customer: false,
            is_ai_response: false,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, handoffMsg])
        }
      }
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        content: 'Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.',
        is_from_customer: false,
        is_ai_response: true,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    }

    setSending(false)
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('mn-MN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50"
          style={{ backgroundColor: accentColor }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {messages.length === 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">
              1
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200">
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">🤖</span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">{storeName}</p>
                <p className="text-white/70 text-xs">Онлайн | AI туслах</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">👋</span>
                </div>
                <p className="text-gray-600 text-sm font-medium">Сайн байна уу!</p>
                <p className="text-gray-400 text-xs mt-1">
                  Танд юугаар туслах вэ? Бүтээгдэхүүн, захиалга, хүргэлтийн талаар асууна уу.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.is_from_customer ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                    msg.is_from_customer
                      ? 'text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                  }`}
                  style={msg.is_from_customer ? { backgroundColor: accentColor } : undefined}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${
                    msg.is_from_customer ? 'text-white/60' : 'text-gray-400'
                  }`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Мессеж бичих..."
                className="flex-1 px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="p-2.5 rounded-xl text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-2">
              Powered by Temuulel AI
            </p>
          </div>
        </div>
      )}
    </>
  )
}
