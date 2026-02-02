'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { FlowState, FlowMessage } from '@/lib/flow-types'

interface ChatMessage {
  id: string
  type: 'bot' | 'user'
  content: string
  quick_replies?: { title: string; payload: string }[]
  products?: { id: string; name: string; price: number; description?: string }[]
  time: string
}

interface FlowDemoChatProps {
  businessType: string
  accentColor: string
  storeName: string
}

export default function FlowDemoChat({ businessType, accentColor, storeName }: FlowDemoChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [flowState, setFlowState] = useState<FlowState | null>(null)
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [input, setInput] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  const now = () =>
    new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })

  // Auto-scroll messages container
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  // Convert FlowMessage[] to ChatMessage[]
  const appendBotMessages = useCallback((flowMessages: FlowMessage[]) => {
    const newMsgs: ChatMessage[] = []
    for (const fm of flowMessages) {
      if (fm.type === 'text' && fm.text) {
        newMsgs.push({
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'bot',
          content: fm.text,
          time: now(),
        })
      } else if (fm.type === 'quick_replies') {
        newMsgs.push({
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'bot',
          content: fm.text ?? '',
          quick_replies: fm.quick_replies,
          time: now(),
        })
      } else if (fm.type === 'product_cards' && fm.products) {
        newMsgs.push({
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'bot',
          content: '',
          products: fm.products,
          time: now(),
        })
      }
    }
    setMessages(prev => [...prev, ...newMsgs])
  }, [])

  // Call the demo API
  const callApi = useCallback(async (message: string, state: FlowState | null) => {
    setLoading(true)
    try {
      const res = await fetch('/api/demo/flow-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_type: businessType,
          message,
          flow_state: state,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      setFlowState(data.flow_state ?? null)
      setCompleted(data.completed ?? false)

      // Small delay for typing feel
      await new Promise(r => setTimeout(r, 500))
      appendBotMessages(data.messages ?? [])
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        type: 'bot',
        content: 'Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.',
        time: now(),
      }])
    } finally {
      setLoading(false)
    }
  }, [businessType, appendBotMessages])

  // Start flow on mount / business type change
  useEffect(() => {
    setMessages([])
    setFlowState(null)
    setCompleted(false)
    setInput('')
    callApi('', null)
  }, [businessType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Send user message
  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || loading || completed) return
    const trimmed = text.trim()
    setInput('')
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      type: 'user',
      content: trimmed,
      time: now(),
    }])
    callApi(trimmed, flowState)
  }, [loading, completed, flowState, callApi])

  // Handle quick reply click
  const handleQuickReply = useCallback((title: string) => {
    if (loading || completed) return
    sendMessage(title)
  }, [loading, completed, sendMessage])

  // Handle product selection (by number)
  const handleProductSelect = useCallback((index: number) => {
    sendMessage(String(index + 1))
  }, [sendMessage])

  // Restart flow
  const restart = useCallback(() => {
    setMessages([])
    setFlowState(null)
    setCompleted(false)
    setInput('')
    callApi('', null)
  }, [callApi])

  // Find the latest quick_replies (only show for the last message)
  const lastBotMsg = [...messages].reverse().find(m => m.type === 'bot')
  const showQuickReplies = lastBotMsg?.quick_replies && !loading && !completed

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: accentColor }}
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <span className="text-white text-sm">🤖</span>
        </div>
        <div className="flex-1">
          <p className="text-white font-medium text-sm">{storeName}</p>
          <p className="text-white/70 text-xs">Flow Demo</p>
        </div>
        {completed && (
          <button
            onClick={restart}
            className="px-3 py-1 text-xs rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            Дахин эхлэх
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="h-96 overflow-y-auto p-4 space-y-3 bg-slate-800/50">
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* Text message */}
            {(msg.content || msg.type === 'user') && (
              <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.type === 'user'
                      ? 'text-white rounded-br-md'
                      : 'bg-slate-700 text-slate-200 rounded-bl-md'
                  }`}
                  style={msg.type === 'user' ? { backgroundColor: accentColor } : undefined}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${msg.type === 'user' ? 'text-white/60' : 'text-slate-400'}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            )}

            {/* Product cards */}
            {msg.products && msg.products.length > 0 && (
              <div className="mt-2 space-y-2">
                {msg.products.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => handleProductSelect(i)}
                    disabled={loading || completed || msg !== lastBotMsg}
                    className="w-full text-left p-3 rounded-xl bg-slate-700/80 border border-slate-600 hover:bg-slate-600/80 transition-colors disabled:opacity-60 disabled:cursor-default"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {i + 1}. {p.name}
                        </p>
                        {p.description && (
                          <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-cyan-400 whitespace-nowrap ml-2">
                        {p.price.toLocaleString()}\u20AE
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Completion message */}
        {completed && (
          <div className="text-center py-3">
            <p className="text-xs text-slate-500">Flow дууслаа</p>
            <button
              onClick={restart}
              className="mt-2 px-4 py-1.5 text-xs rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Дахин эхлэх
            </button>
          </div>
        )}
      </div>

      {/* Quick reply buttons */}
      {showQuickReplies && (
        <div className="px-4 py-2 bg-slate-800/80 border-t border-slate-700 flex flex-wrap gap-2">
          {lastBotMsg.quick_replies!.map((qr) => (
            <button
              key={qr.payload}
              onClick={() => handleQuickReply(qr.title)}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
            >
              {qr.title}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-slate-900 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder={completed ? 'Flow дууссан' : 'Мессеж бичих...'}
            className="flex-1 px-3.5 py-2.5 bg-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 border border-slate-700"
            disabled={loading || completed}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading || completed}
            className="p-2.5 rounded-xl text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-500 mt-2">
          Powered by Temuulel Flow
        </p>
      </div>
    </div>
  )
}
