'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface InviteData {
  storeName: string
  role: string
  email: string
  inviterEmail: string
}

export default function InviteSignupPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)

  // Signup form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<'form' | 'verify'>('form')

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }
  const isPasswordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.number

  // Load invite data
  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await fetch(`/api/team/invite/verify?token=${token}`)
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 410) {
            setExpired(true)
          } else {
            setError(data.error || 'Урилга олдсонгүй')
          }
          return
        }

        setInvite(data)
      } catch {
        setError('Алдаа гарлаа')
      } finally {
        setLoading(false)
      }
    }
    loadInvite()
  }, [token])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    setError(null)

    if (password !== confirmPassword) {
      setError('Нууц үг таарахгүй байна')
      return
    }
    if (!isPasswordValid) {
      setError('Нууц үг шаардлага хангахгүй байна')
      return
    }

    setSubmitting(true)
    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: { phone, invite_token: token },
          emailRedirectTo: `${window.location.origin}/api/team/invite/accept?token=${token}`,
        },
      })

      if (signupError) {
        if (signupError.message.includes('already registered')) {
          setError('Энэ имэйл хаяг бүртгэлтэй байна. Нэвтэрсний дараа автоматаар багт нэмэгдэнэ.')
        } else {
          setError(signupError.message)
        }
        return
      }

      // Create user profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('users').insert({
          id: user.id,
          email: invite.email,
          phone,
          full_name: fullName,
          password_hash: 'supabase_auth',
          is_verified: true,
          email_verified: true,
        })
      }

      setStep('verify')
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8 text-center">
          <div className="text-4xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-white mb-2">Урилга хугацаа дууссан</h2>
          <p className="text-slate-400 text-sm mb-6">Энэ урилгын хугацаа дууссан байна. Дэлгүүрийн эзэмшигчээс шинэ урилга авна уу.</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
            Нэвтрэх хуудас руу очих
          </Link>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-white mb-2">Урилга олдсонгүй</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
            Нэвтрэх хуудас руу очих
          </Link>
        </div>
      </div>
    )
  }

  if (!invite) return null

  const roleLabel = invite.role === 'admin' ? 'Админ' : 'Ажилтан'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl mb-4">
            <span className="text-3xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">TEMUULEL</h1>
          <p className="text-slate-400 mt-2">Багийн урилга</p>
        </div>

        {/* Invite info card */}
        <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">{invite.storeName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">{invite.storeName}</p>
              <p className="text-slate-400 text-xs">
                {invite.inviterEmail} таныг <span className="text-blue-400 font-medium">{roleLabel}</span> болгон урьсан
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8">
          {step === 'form' ? (
            <form onSubmit={handleSignup} className="space-y-5">
              <h2 className="text-lg font-semibold text-white mb-4">Бүртгүүлэх</h2>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Имэйл</label>
                <input
                  type="email"
                  value={invite.email}
                  disabled
                  className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600 rounded-xl text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Урилга илгээсэн имэйл хаягаар бүртгүүлнэ</p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Нэр *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Батболд"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Утас *</label>
                <div className="flex gap-2">
                  <span className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-slate-400">+976</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="99112233"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Нууц үг *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-12"
                    placeholder="********"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {showPassword ? 'Нуух' : 'Харах'}
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
                <label className="block text-sm font-medium text-slate-300 mb-2">Нууц үг давтах *</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="********"
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Нууц үг таарахгүй байна</p>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !isPasswordValid || !fullName.trim() || !phone}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Бүртгүүлж байна...' : 'Бүртгүүлэх'}
              </button>

              <p className="text-center text-slate-400 text-sm">
                Бүртгэлтэй юу?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Нэвтрэх</Link>
              </p>
            </form>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">📧</div>
              <h2 className="text-xl font-bold text-white">Имэйлээ шалгана уу</h2>
              <p className="text-slate-400 text-sm">
                <span className="text-white font-medium">{invite.email}</span> хаяг руу баталгаажуулах линк илгээлээ.
              </p>
              <p className="text-slate-500 text-xs">
                Линк дээр дарсны дараа та автоматаар <span className="text-blue-400">{invite.storeName}</span> багт нэмэгдэнэ.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
