'use client'

import { useEffect, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'temuulel_pwa_dismissed_at'
const DISMISS_COOLDOWN_DAYS = 14

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // iOS doesn't fire beforeinstallprompt — detect standalone + iOS Safari
    const ua = window.navigator.userAgent
    const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    if (isStandalone) return // already installed

    // Check cooldown
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
      if (daysSince < DISMISS_COOLDOWN_DAYS) return
    }

    if (iOSDevice) {
      setIsIOS(true)
      // Show iOS "Add to Home Screen" hint after 10s
      const t = setTimeout(() => setVisible(true), 10000)
      return () => clearTimeout(t)
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[55] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4 animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-xl">📱</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm mb-1">Аппликэйшн суулгах</h3>
          {isIOS ? (
            <p className="text-slate-400 text-xs">
              Safari дээрээс <strong className="text-white">Share</strong> → <strong className="text-white">Add to Home Screen</strong> дар.
            </p>
          ) : (
            <p className="text-slate-400 text-xs">
              Temuulel-ыг гар утасны аппаар хурдан нээж ашигла.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
              >
                Суулгах
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs"
            >
              Одоогоор үгүй
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-500 hover:text-slate-300 text-lg leading-none"
          aria-label="Хаах"
        >
          ×
        </button>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
