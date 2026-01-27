'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }

  const isPasswordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.number

  // Supabase automatically handles the token from the URL hash fragment
  // and establishes a session when the page loads
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if user already has a session (e.g. page was refreshed)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSessionReady(true)
      } else {
        // Give Supabase a moment to process the hash fragment
        setTimeout(() => {
          supabase.auth.getUser().then(({ data: { user: u } }) => {
            if (u) {
              setSessionReady(true)
            } else {
              setSessionError(true)
            }
          })
        }, 1500)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Нууц үг таарахгүй байна')
      return
    }

    if (!isPasswordValid) {
      setError('Нууц үг шаардлага хангахгүй байна')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        if (error.message.includes('same_password')) {
          setError('Шинэ нууц үг хуучинтай адилхан байж болохгүй')
        } else {
          setError(error.message)
        }
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)
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
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Шинэ нууц үг</h1>
          <p className="text-slate-400 mt-2">Шинэ нууц үгээ оруулна уу</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Нууц үг амжилттай солигдлоо!</h2>
              <p className="text-slate-400 text-sm">
                Хяналтын самбар руу чиглүүлж байна...
              </p>
            </div>
          ) : sessionError ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Линкийн хугацаа дууссан</h2>
              <p className="text-slate-400 text-sm">
                Нууц үг сэргээх линк хүчингүй болсон эсвэл хугацаа дууссан байна.
                Дахин линк авна уу.
              </p>
              <Link
                href="/forgot-password"
                className="block w-full py-3 px-4 text-center bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
              >
                Дахин линк авах
              </Link>
              <Link
                href="/login"
                className="block text-center text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Нэвтрэх хуудас руу буцах
              </Link>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-8">
              <svg className="animate-spin h-8 w-8 mx-auto text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-slate-400 mt-4">Баталгаажуулж байна...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Шинэ нууц үг
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  <p className={`text-xs ${passwordChecks.length ? 'text-green-400' : 'text-slate-500'}`}>
                    {passwordChecks.length ? '✓' : '○'} 8+ тэмдэгт
                  </p>
                  <p className={`text-xs ${passwordChecks.uppercase ? 'text-green-400' : 'text-slate-500'}`}>
                    {passwordChecks.uppercase ? '✓' : '○'} Том үсэг
                  </p>
                  <p className={`text-xs ${passwordChecks.number ? 'text-green-400' : 'text-slate-500'}`}>
                    {passwordChecks.number ? '✓' : '○'} Тоо
                  </p>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Нууц үг давтах
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Нууц үг таарахгүй байна</p>
                )}
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
                disabled={loading || !isPasswordValid}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Хадгалж байна...</span>
                  </>
                ) : (
                  'Нууц үг солих'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
