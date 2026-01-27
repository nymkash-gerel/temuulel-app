'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function VerifyPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [email, setEmail] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase handles email confirmation via the URL hash fragment automatically.
    // When the user clicks the confirmation link, Supabase exchanges the token
    // and establishes a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setEmail(session.user.email || '')

        // Update email_verified in users table
        await supabase
          .from('users')
          .update({ email_verified: true, is_verified: true })
          .eq('id', session.user.id)

        setStatus('success')

        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 3000)
      }
    })

    // Check if already signed in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email_confirmed_at) {
        setEmail(user.email || '')
        setStatus('success')
        // Update the users table
        supabase
          .from('users')
          .update({ email_verified: true, is_verified: true })
          .eq('id', user.id)
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 3000)
      } else {
        // Wait a moment for hash processing, then check again
        setTimeout(() => {
          supabase.auth.getUser().then(({ data: { user: u } }) => {
            if (u?.email_confirmed_at) {
              setEmail(u.email || '')
              setStatus('success')
              supabase
                .from('users')
                .update({ email_verified: true, is_verified: true })
                .eq('id', u.id)
              setTimeout(() => {
                router.push('/dashboard')
                router.refresh()
              }, 3000)
            } else {
              setStatus('error')
            }
          })
        }, 2000)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl mb-4">
            <span className="text-3xl">📧</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Имэйл баталгаажуулалт</h1>
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8">
          {status === 'loading' && (
            <div className="text-center py-8 space-y-4">
              <svg className="animate-spin h-10 w-10 mx-auto text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-slate-400">Баталгаажуулж байна...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Амжилттай баталгаажлаа!</h2>
              <p className="text-slate-400 text-sm">
                <span className="text-white font-medium">{email}</span> имэйл хаяг баталгаажлаа.
              </p>
              <p className="text-slate-500 text-xs">
                Хяналтын самбар руу чиглүүлж байна...
              </p>
              <Link
                href="/dashboard"
                className="inline-block mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
              >
                Хяналтын самбар руу очих
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Баталгаажуулалт амжилтгүй</h2>
              <p className="text-slate-400 text-sm">
                Линк хүчингүй болсон эсвэл хугацаа дууссан байна.
                Дахин бүртгүүлнэ үү.
              </p>
              <div className="pt-4 space-y-3">
                <Link
                  href="/signup"
                  className="block w-full py-3 px-4 text-center bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
                >
                  Дахин бүртгүүлэх
                </Link>
                <Link
                  href="/login"
                  className="block text-center text-sm text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Нэвтрэх хуудас руу буцах
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
