'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { phoneToDriverEmail } from '@/lib/driver-auth'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function DriverRegisterPage() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store') || ''
  const prefillPhone = searchParams.get('phone') || ''

  const [phone, setPhone] = useState(prefillPhone)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  if (!storeId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-2xl mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Бүртгэлийн линк буруу байна</h1>
          <p className="text-slate-400 mb-6">Дэлгүүрийн эзэнтэй холбогдож шинэ линк авна уу.</p>
          <Link href="/driver/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Нэвтрэх хуудас руу буцах
          </Link>
        </div>
      </div>
    )
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Нууц үг таарахгүй байна')
      return
    }

    if (password.length < 8) {
      setError('Нууц үг хамгийн багадаа 8 тэмдэгт')
      return
    }

    setLoading(true)

    try {
      // Register via API
      const res = await fetch('/api/driver/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, password, store_id: storeId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Бүртгэл амжилтгүй')
        return
      }

      // Auto sign in
      const email = phoneToDriverEmail(phone)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        // Registration succeeded but auto-login failed — redirect to login
        router.push('/driver/login')
        return
      }

      router.push('/driver')
      router.refresh()
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl mb-4">
            <span className="text-3xl">🚚</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Жолооч бүртгүүлэх</h1>
          <p className="text-slate-400 mt-2">Нууц үгээ тохируулна уу</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Нэр</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Таны нэр"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Утасны дугаар</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">+976</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-14 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="99112233"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Дэлгүүрт бүртгэлтэй утасны дугаар</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Нууц үг</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="8+ тэмдэгт"
                minLength={8}
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Нууц үг давтах</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || phone.length !== 8}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Бүртгэж байна...</span>
                </>
              ) : (
                'Бүртгүүлэх'
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 mt-5 text-sm">
            Бүртгэлтэй юу?{' '}
            <Link href="/driver/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Нэвтрэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
