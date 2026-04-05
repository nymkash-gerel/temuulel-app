'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { DemoSector } from '@/lib/demo-data'

interface DemoMessage {
  id: string
  content: string
  isUser: boolean
  time: string
}

export default function DemoChatWidget({ sector }: { sector: DemoSector }) {
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [autoPlayIndex, setAutoPlayIndex] = useState(0)
  const [autoPlaying, setAutoPlaying] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const now = () =>
    new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })

  // Scroll to bottom
  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isTyping])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Auto-play conversation
  const playNext = useCallback(() => {
    if (!autoPlaying || isPaused) return
    if (autoPlayIndex >= sector.sampleQuestions.length) {
      // Loop: restart after a pause
      timeoutRef.current = setTimeout(() => {
        setMessages([])
        setAutoPlayIndex(0)
        setIsTyping(false)
      }, 4000)
      return
    }

    const q = sector.sampleQuestions[autoPlayIndex]

    // Step 1: Show user message with typing effect
    timeoutRef.current = setTimeout(() => {
      if (!autoPlaying) return
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, content: q.question, isUser: true, time: now() },
      ])

      // Step 2: Show typing indicator
      timeoutRef.current = setTimeout(() => {
        if (!autoPlaying) return
        setIsTyping(true)

        // Step 3: Show bot response
        timeoutRef.current = setTimeout(() => {
          if (!autoPlaying) return
          setIsTyping(false)
          setMessages((prev) => [
            ...prev,
            { id: `bot-${Date.now()}`, content: q.answer, isUser: false, time: now() },
          ])
          setAutoPlayIndex((i) => i + 1)
        }, 1200 + Math.random() * 800)
      }, 500)
    }, autoPlayIndex === 0 ? 1500 : 2500)
  }, [autoPlaying, isPaused, autoPlayIndex, sector.sampleQuestions])

  useEffect(() => {
    playNext()
  }, [playNext])

  // Stop autoplay when user interacts
  function stopAutoPlay() {
    setAutoPlaying(false)
    setIsPaused(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsTyping(false)
  }

  function addBotReply(answer: string) {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, content: answer, isUser: false, time: now() },
      ])
    }, 800)
  }

  function handleFreeText() {
    if (!input.trim() || isTyping) return
    stopAutoPlay()
    const text = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, content: text, isUser: true, time: now() },
    ])
    addBotReply(
      'Энэ бол демо хувилбар. Бүртгүүлээд жинхэнэ AI чатбот ашиглаарай! 🚀'
    )
  }

  return (
    <div
      className="w-full max-w-md mx-auto rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl"
      onMouseEnter={() => autoPlaying && setIsPaused(true)}
      onMouseLeave={() => {
        if (autoPlaying) {
          setIsPaused(false)
        }
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: sector.accentColor }}
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <span className="text-white text-sm">🤖</span>
        </div>
        <div className="flex-1">
          <p className="text-white font-medium text-sm">{sector.storeName}</p>
          <p className="text-white/70 text-xs">Онлайн | AI туслах</p>
        </div>
        {autoPlaying && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-white/50 text-[10px]">Live demo</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="h-80 overflow-y-auto p-4 space-y-3 bg-slate-800/50">
        {messages.length === 0 && !isTyping && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 bg-slate-700 text-slate-200 rounded-bl-md">
              <p className="text-sm whitespace-pre-wrap">
                {sector.welcomeMessage}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} animate-[fadeSlideIn_0.3s_ease-out]`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                msg.isUser
                  ? 'text-white rounded-br-md'
                  : 'bg-slate-700 text-slate-200 rounded-bl-md'
              }`}
              style={msg.isUser ? { backgroundColor: sector.accentColor } : undefined}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p
                className={`text-[10px] mt-1 ${
                  msg.isUser ? 'text-white/60' : 'text-slate-400'
                }`}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-[fadeSlideIn_0.3s_ease-out]">
            <div className="bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-slate-900 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={stopAutoPlay}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleFreeText()
              }
            }}
            placeholder={autoPlaying ? 'Бичиж эхлэвэл demo зогсоно...' : 'Мессеж бичих...'}
            className="flex-1 px-3.5 py-2.5 bg-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 border border-slate-700"
            disabled={isTyping && !autoPlaying}
          />
          <button
            onClick={handleFreeText}
            disabled={!input.trim() || isTyping}
            className="p-2.5 rounded-xl text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: sector.accentColor }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-500 mt-2">
          Powered by Temuulel AI
        </p>
      </div>
    </div>
  )
}
