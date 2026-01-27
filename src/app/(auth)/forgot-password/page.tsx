'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
        return
      }

      setSent(true)
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Нууц үг сэргээх</h1>
          <p className="text-slate-400 mt-2">
            Бүртгэлтэй имэйл хаягаа оруулна уу
          </p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">📧</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Имэйл илгээгдлээ!</h2>
              <p className="text-slate-400 text-sm">
                <span className="text-white font-medium">{email}</span> хаягруу нууц үг сэргээх линк илгээлээ.
                Имэйлээ шалгана уу.
              </p>
              <p className="text-slate-500 text-xs">
                Имэйл ирээгүй бол spam хавтсыг шалгана уу
              </p>
              <div className="pt-4 space-y-3">
                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                >
                  Өөр имэйл оруулах
                </button>
                <Link
                  href="/login"
                  className="block w-full py-3 px-4 text-center text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Нэвтрэх хуудас руу буцах
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Имэйл хаяг
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="example@email.com"
                  required
                  autoFocus
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">⚠️ {error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Илгээж байна...</span>
                  </>
                ) : (
                  'Сэргээх линк илгээх'
                )}
              </button>

              {/* Back to login */}
              <Link
                href="/login"
                className="block text-center text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                ← Нэвтрэх хуудас руу буцах
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
