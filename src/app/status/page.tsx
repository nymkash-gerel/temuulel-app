'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Service { name: string; status: 'operational' | 'degraded' | 'outage' | 'checking'; latency?: number; url?: string }

const INITIAL: Service[] = [
  { name: 'Landing page', status: 'checking', url: '/' },
  { name: 'Dashboard API', status: 'checking', url: '/api/health' },
  { name: 'Chat widget', status: 'checking', url: '/api/chat/widget' },
  { name: 'Messenger webhook', status: 'checking', url: '/api/webhook/messenger' },
]

export default function StatusPage() {
  const [services, setServices] = useState<Service[]>(INITIAL)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  async function checkAll() {
    const updated = await Promise.all(INITIAL.map(async s => {
      if (!s.url) return s
      const start = Date.now()
      try {
        const res = await fetch(s.url, { method: s.url.includes('webhook') ? 'GET' : 'HEAD' })
        const latency = Date.now() - start
        if (!res.ok && res.status !== 405 && res.status !== 403 && res.status !== 401) {
          return { ...s, status: 'degraded' as const, latency }
        }
        return { ...s, status: 'operational' as const, latency }
      } catch {
        return { ...s, status: 'outage' as const, latency: Date.now() - start }
      }
    }))
    setServices(updated)
    setLastCheck(new Date())
  }

  useEffect(() => {
    checkAll()
    const i = setInterval(checkAll, 30000)
    return () => clearInterval(i)
  }, [])

  const allOperational = services.every(s => s.status === 'operational')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">🟢 System Status</h1>
          <p className={`text-lg ${allOperational ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {allOperational ? 'Бүх систем нормал ажиллаж байна' : 'Зарим систем удаан эсвэл хариулахгүй байна'}
          </p>
          {lastCheck && <p className="text-sm text-slate-500 mt-2">Сүүлд шалгасан: {lastCheck.toLocaleTimeString('mn-MN')}</p>}
        </div>

        <div className="space-y-3">
          {services.map(s => (
            <div key={s.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  s.status === 'operational' ? 'bg-emerald-400' :
                  s.status === 'degraded' ? 'bg-yellow-400' :
                  s.status === 'outage' ? 'bg-red-400' :
                  'bg-slate-600 animate-pulse'
                }`} />
                <span className="font-medium">{s.name}</span>
              </div>
              <div className="text-sm">
                {s.latency !== undefined && <span className="text-slate-500 mr-3">{s.latency}ms</span>}
                <span className={
                  s.status === 'operational' ? 'text-emerald-400' :
                  s.status === 'degraded' ? 'text-yellow-400' :
                  s.status === 'outage' ? 'text-red-400' :
                  'text-slate-500'
                }>
                  {s.status === 'operational' ? 'Operational' :
                   s.status === 'degraded' ? 'Degraded' :
                   s.status === 'outage' ? 'Outage' : 'Checking...'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button onClick={checkAll} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm">
            🔄 Дахин шалгах
          </button>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm">
          <Link href="/dashboard" className="text-blue-400 hover:underline">← Dashboard-руу буцах</Link>
        </div>
      </div>
    </div>
  )
}
