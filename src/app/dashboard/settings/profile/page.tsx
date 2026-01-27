'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')

  // Password change
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setEmail(user.email || '')

      const { data: profile } = await supabase
        .from('users')
        .select('full_name, phone, role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setPhone(profile.phone || '')
        setRole(profile.role || 'owner')
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleSave() {
    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('users')
      .update({ full_name: fullName, phone })
      .eq('id', user.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handlePasswordChange() {
    setPasswordError('')
    setPasswordSaved(false)

    if (newPassword.length < 8) {
      setPasswordError('Нууц үг 8-аас дээш тэмдэгт байх ёстой')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Нууц үг таарахгүй байна')
      return
    }

    setChangingPassword(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSaved(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 3000)
    }
    setChangingPassword(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Профайл</h1>
          <p className="text-slate-400 mt-1">Хувийн мэдээлэл, нууц үг</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white font-bold">
                {fullName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h3 className="text-white font-medium">{fullName || 'Нэр оруулаагүй'}</h3>
              <p className="text-slate-400 text-sm">{email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                {role === 'owner' ? 'Эзэмшигч' : role === 'admin' ? 'Админ' : 'Ажилтан'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Бүтэн нэр</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="Таны нэр"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Имэйл</label>
            <input
              value={email}
              disabled
              className="w-full px-4 py-3 bg-slate-700/30 border border-slate-700 rounded-xl text-slate-400 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Имэйл өөрчлөх боломжгүй</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Утас</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="+976 9999 9999"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
            {saved && <span className="text-emerald-400 text-sm">Амжилттай хадгаллаа</span>}
          </div>
        </div>

        {/* Password Change */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-medium">Нууц үг солих</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Шинэ нууц үг</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="8+ тэмдэгт"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Нууц үг давтах</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="Дахин оруулна уу"
            />
          </div>

          {passwordError && (
            <p className="text-red-400 text-sm">{passwordError}</p>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handlePasswordChange}
              disabled={changingPassword || !newPassword}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {changingPassword ? 'Солиж байна...' : 'Нууц үг солих'}
            </button>
            {passwordSaved && <span className="text-emerald-400 text-sm">Нууц үг амжилттай солигдлоо</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
