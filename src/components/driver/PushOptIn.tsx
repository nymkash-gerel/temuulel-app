'use client'

import { useEffect, useState } from 'react'

export default function PushOptIn() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(isSupported)

    if (isSupported) {
      setPermission(Notification.permission)
      checkSubscription()
    }
  }, [])

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {
      // Ignore
    }
  }

  async function handleToggle() {
    if (!supported) return
    setLoading(true)

    try {
      if (subscribed) {
        // Unsubscribe
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/driver/push/unsubscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setSubscribed(false)
      } else {
        // Subscribe
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return

        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        })

        const json = sub.toJSON()
        await fetch('/api/driver/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys?.p256dh,
              auth: json.keys?.auth,
            },
          }),
        })

        setSubscribed(true)
        setPermission(Notification.permission)
      }
    } catch {
      // Permission denied or other error
      setPermission(Notification.permission)
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">Мэдэгдэл</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {permission === 'denied'
              ? 'Хөтчийн тохиргоогоор зөвшөөрнө үү'
              : subscribed
              ? 'Push мэдэгдэл идэвхтэй'
              : 'Шинэ хүргэлт оноогдоход мэдэгдэл авах'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading || permission === 'denied'}
          className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
            subscribed ? 'bg-blue-500' : 'bg-slate-600'
          }`}
        >
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
            subscribed ? 'left-6' : 'left-1'
          }`} />
        </button>
      </div>
    </div>
  )
}
