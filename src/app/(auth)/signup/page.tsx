'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BUSINESS_TYPES } from '@/lib/business-types'

type Step = 1 | 2 | 3

export default function SignupPage() {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Step 1: Account info
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2: Verification
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)

  // Step 3: Store info
  const [fullName, setFullName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [businessType, setBusinessType] = useState('')

  const router = useRouter()
  const supabase = createClient()

  // Password validation
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  }

  const isPasswordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.number

  const handleStep1 = async (e: React.FormEvent) => {
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
      // Sign up with Supabase
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone,
          },
          emailRedirectTo: `${window.location.origin}/verify`,
        }
      })

      if (error) {
        if (error.message.includes('already registered')) {
          setError('Энэ имэйл хаяг бүртгэлтэй байна')
        } else {
          setError(error.message)
        }
        return
      }

      // Move to verification step
      setStep(2)
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyEmail = async () => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setEmailVerified(true)
      }
    } catch {
      setError('Имэйл илгээхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPhone = async () => {
    // Phone verification is optional for now
    setPhoneVerified(true)
  }

  const handleStep2 = () => {
    if (emailVerified) {
      setStep(3)
    } else {
      setError('Имэйл баталгаажуулна уу')
    }
  }

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('Хэрэглэгч олдсонгүй')
        return
      }

      // Create user profile in users table
      const { error: userError } = await supabase.from('users').insert({
        id: user.id,
        email: email,
        phone: phone,
        full_name: fullName,
        password_hash: 'supabase_auth', // Handled by Supabase Auth
        is_verified: true,
        email_verified: true,
      })

      if (userError && !userError.message.includes('duplicate')) {
        console.error('User insert error:', userError)
      }

      // Create store
      const { data: store, error: storeError } = await supabase.from('stores').insert({
        owner_id: user.id,
        name: storeName,
        slug: storeName.toLowerCase().replace(/\s+/g, '-'),
        business_type: businessType,
      }).select().single()

      if (storeError) {
        console.error('Store insert error:', storeError)
        setError('Дэлгүүр үүсгэхэд алдаа гарлаа')
        return
      }

      // Create free subscription
      const { data: freePlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('slug', 'free')
        .single()

      if (freePlan) {
        await supabase.from('store_subscriptions').insert({
          store_id: store.id,
          plan_id: freePlan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }

      // Apply industry template (non-blocking)
      fetch('/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: businessType }),
      }).catch(() => {})

      router.push('/dashboard?welcome=true')
      router.refresh()
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl mb-4">
            <span className="text-3xl">🤖</span>
          </div>
          <h1 className="text-2xl font-bold text-white">TEMUULEL</h1>
          <p className="text-slate-400 mt-2">Бүртгүүлэх</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-all ${
                s === step
                  ? 'bg-blue-500 w-8'
                  : s < step
                  ? 'bg-blue-500'
                  : 'bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8">
          {/* Step 1: Account Info */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <h2 className="text-lg font-semibold text-white mb-4">Бүртгэл үүсгэх (1/3)</h2>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Имэйл хаяг *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="example@email.com"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Утасны дугаар *
                </label>
                <div className="flex gap-2">
                  <span className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-slate-400">
                    +976
                  </span>
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Нууц үг *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {/* Password requirements */}
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
                  Нууц үг давтах *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Уншиж байна...' : 'Үргэлжлүүлэх →'}
              </button>
            </form>
          )}

          {/* Step 2: Verification */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white mb-4">Баталгаажуулалт (2/3)</h2>

              {/* Email verification */}
              <div className="p-4 bg-slate-700/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-300">📧 Имэйл</span>
                  {emailVerified ? (
                    <span className="text-green-400 text-sm">✅ Линк илгээгдсэн</span>
                  ) : (
                    <button
                      onClick={handleVerifyEmail}
                      disabled={loading}
                      className="text-blue-400 text-sm hover:text-blue-300 disabled:opacity-50"
                    >
                      {loading ? 'Илгээж байна...' : 'Баталгаажуулах'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-400">{email}</p>
                {emailVerified && (
                  <p className="text-xs text-slate-500 mt-2">
                    Баталгаажуулах линк имэйл рүү илгээгдлээ. Та одоо үргэлжлүүлж болно.
                  </p>
                )}
              </div>

              {/* Phone verification */}
              <div className="p-4 bg-slate-700/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-300">📱 Утас</span>
                  {phoneVerified ? (
                    <span className="text-green-400 text-sm">✅ Баталгаажсан</span>
                  ) : (
                    <button
                      onClick={handleVerifyPhone}
                      className="text-blue-400 text-sm hover:text-blue-300"
                    >
                      Баталгаажуулах (optional)
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-400">+976 {phone}</p>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">⚠️ {error}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                >
                  ← Буцах
                </button>
                <button
                  onClick={handleStep2}
                  disabled={!emailVerified}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50"
                >
                  Үргэлжлүүлэх →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Store Info */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-5">
              <h2 className="text-lg font-semibold text-white mb-4">Дэлгүүрээ нээх (3/3)</h2>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Таны нэр *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Батболд"
                  required
                />
              </div>

              {/* Store Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Дэлгүүрийн нэр *
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Номин Fashion"
                  required
                />
              </div>

              {/* Business Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Бизнесийн төрөл *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {BUSINESS_TYPES.map(({ type, icon, label, desc }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBusinessType(type)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        businessType === type
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                      }`}
                    >
                      <div className="text-xl mb-1">{icon}</div>
                      <div className="text-white font-medium text-xs">{label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  required
                  className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-400">
                  <Link href="/terms" className="text-blue-400 hover:text-blue-300">Үйлчилгээний нөхцөл</Link> болон{' '}
                  <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Нууцлалын бодлого</Link>-ыг зөвшөөрч байна
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">⚠️ {error}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                >
                  ← Буцах
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50"
                >
                  {loading ? 'Үүсгэж байна...' : '🚀 Дэлгүүр үүсгэх'}
                </button>
              </div>
            </form>
          )}

          {/* Login link */}
          <p className="text-center text-slate-400 mt-6">
            Бүртгэлтэй юу?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Нэвтрэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
