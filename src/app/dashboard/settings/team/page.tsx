'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'

interface TeamMember {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

export default function TeamSettingsPage() {
  const { allowed, loading: roleLoading } = useRoleGuard(['owner', 'admin'])
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')
  const [inviting, setInviting] = useState(false)
  const [invited, setInvited] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [teamLimit, setTeamLimit] = useState(1)
  const [storeId, setStoreId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        // Get subscription for team limit
        const { data: sub } = await supabase
          .from('store_subscriptions')
          .select('subscription_plans(limits)')
          .eq('store_id', store.id)
          .single()

        if (sub?.subscription_plans) {
          const plans = sub.subscription_plans as { limits?: { team_members?: number } }
          setTeamLimit(plans.limits?.team_members || 1)
        }

        // Get team members
        const { data: teamMembers } = await supabase
          .from('store_members')
          .select('user_id, role, created_at, users(id, email, full_name)')
          .eq('store_id', store.id)

        if (teamMembers) {
          setMembers(teamMembers.map((m) => {
            const u = m.users as unknown as { id: string; email: string; full_name: string } | null
            return {
              id: m.user_id,
              email: u?.email || '',
              full_name: u?.full_name || '',
              role: m.role,
              created_at: m.created_at,
            }
          }))
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInvited(false)
    setError(null)

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Алдаа гарлаа')
        return
      }

      setMembers([...members, {
        id: data.member.user_id,
        email: data.member.email,
        full_name: '',
        role: data.member.role,
        created_at: new Date().toISOString(),
      }])

      setInvited(true)
      setInviteEmail('')
      setTimeout(() => setInvited(false), 3000)
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Энэ гишүүнийг хасах уу?')) return

    try {
      const res = await fetch('/api/team/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Гишүүнийг хасахад алдаа гарлаа')
        return
      }

      setMembers(members.filter(m => m.id !== userId))
    } catch {
      setError('Гишүүнийг хасахад алдаа гарлаа')
    }
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case 'owner': return 'Эзэмшигч'
      case 'admin': return 'Админ'
      case 'staff': return 'Ажилтан'
      default: return role
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'owner': return 'bg-amber-500/20 text-amber-400'
      case 'admin': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  if (loading || roleLoading || !allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const canInvite = members.length < teamLimit

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Баг</h1>
          <p className="text-slate-400 mt-1">Хамтран ажиллах хүмүүс нэмэх, удирдах</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Team Usage */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Багийн гишүүд</p>
              <p className="text-white text-2xl font-bold mt-1">
                {members.length}<span className="text-slate-400 text-base font-normal">/{teamLimit === -1 ? '∞' : teamLimit}</span>
              </p>
            </div>
            {!canInvite && teamLimit > 0 && (
              <Link
                href="/dashboard/settings/billing"
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-medium transition-all hover:from-blue-600 hover:to-cyan-600"
              >
                План шинэчлэх
              </Link>
            )}
          </div>
        </div>

        {/* Invite */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-medium">Гишүүн урих</h3>

          {canInvite ? (
            <>
              <div className="flex gap-3">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  placeholder="Имэйл хаяг"
                  className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="admin">Админ</option>
                  <option value="staff">Ажилтан</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {inviting ? 'Урьж байна...' : 'Урих'}
                </button>
                {invited && <span className="text-emerald-400 text-sm">Урилга илгээгдлээ</span>}
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p><span className="text-slate-400 font-medium">Админ:</span> Бүх тохиргоо, бүтээгдэхүүн, захиалга удирдах</p>
                <p><span className="text-slate-400 font-medium">Ажилтан:</span> Чат хариулах, захиалга харах</p>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm">Таны план {teamLimit} гишүүнтэй. Нэмэлт гишүүн нэмэхийн тулд план шинэчилнэ үү.</p>
            </div>
          )}
        </div>

        {/* Members List */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl divide-y divide-slate-700">
          <div className="p-4">
            <h3 className="text-white font-medium">Гишүүд</h3>
          </div>
          {members.length > 0 ? (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {(member.full_name || member.email)?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{member.full_name || 'Нэр оруулаагүй'}</p>
                    <p className="text-slate-400 text-xs">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                    {getRoleLabel(member.role)}
                  </span>
                  {member.id !== currentUserId && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">Багийн гишүүд нэмэгдээгүй байна</p>
              <p className="text-slate-500 text-xs mt-1">Дээрх хэсгээс гишүүн урина уу</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
