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
  welcomeMessage?: string
  /** Always render as a compact panel (never full-screen on mobile) */
  compact?: boolean
}

export default function ChatWidget({
  storeId,
  storeName,
  accentColor = '#3b82f6',
  welcomeMessage,
  compact = false,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Notify parent frame of open/close for iframe resize
  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'temuulel-widget', isOpen }, '*')
    }
  }, [isOpen])

  // Close on ESC key + prevent background page scroll when widget is open
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    const savedScrollY = window.scrollY

    // CSS scroll lock with !important (defined in globals.css)
    document.documentElement.classList.add('scroll-lock')

    // Snap back any programmatic / focus-driven scroll immediately
    function guardScroll() {
      if (window.scrollY !== savedScrollY) {
        window.scrollTo(0, savedScrollY)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', guardScroll)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', guardScroll)
      document.documentElement.classList.remove('scroll-lock')
      window.scrollTo(0, savedScrollY)
    }
  }, [isOpen])

  // Generate or retrieve a visitor ID (with Safari ITP fallback)
  const getVisitorId = useCallback(() => {
    const key = 'temuulel_visitor_id'
    try {
      let visitorId = localStorage.getItem(key)
      if (!visitorId) {
        visitorId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        localStorage.setItem(key, visitorId)
      }
      return visitorId
    } catch {
      // Safari ITP blocks third-party localStorage in iframes
      let visitorId = sessionStorage.getItem(key)
      if (!visitorId) {
        visitorId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        sessionStorage.setItem(key, visitorId)
      }
      return visitorId
    }
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
    const el = messagesContainerRef.current
    if (el) {
      // Use requestAnimationFrame to ensure DOM has painted before scrolling
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || sending) return

    const content = input.trim()
    setInput('')
    setSending(true)
    // Keep focus on input so user can continue typing.
    // Calling blur() here would dismiss the mobile keyboard and cause the
    // browser to scroll the page as the viewport height changes.

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
          aria-label="Чат нээх"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50"
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
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {welcomeMessage && messages.length === 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">
              1
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div ref={widgetRef} className={`fixed z-50 flex flex-col overflow-hidden shadow-2xl ${
          compact
            ? 'bottom-20 right-4 w-80 h-[28rem] rounded-2xl border border-gray-200 bg-white'
            : 'inset-0 sm:inset-auto sm:bottom-6 sm:right-6 w-full h-full sm:w-96 sm:h-[32rem] bg-white sm:rounded-2xl sm:border border-gray-200'
        }`}>
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
              aria-label="Чат хаах"
              className="text-white/70 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              welcomeMessage ? (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm">
                    <p className="text-sm whitespace-pre-wrap">{welcomeMessage}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">👋</span>
                  </div>
                  <p className="text-gray-600 text-sm font-medium">Сайн байна уу!</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Танд юугаар туслах вэ? Бүтээгдэхүүн, захиалга, хүргэлтийн талаар асууна уу.
                  </p>
                </div>
              )
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

          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                onFocus={(e) => {
                  // Prevent browser from scrolling the page to bring the input into view
                  e.target.scrollIntoView = () => {}
                }}
                placeholder="Мессеж бичих..."
                className="flex-1 px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
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
