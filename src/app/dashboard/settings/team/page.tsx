'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  ROLE_DEFAULT_PERMISSIONS,
  getGrantedPermissions,
  buildPermissions,
  type Permission,
} from '@/lib/permissions'

interface TeamMember {
  id: string
  email: string
  full_name: string
  role: string
  permissions: Record<string, boolean> | null
  created_at: string
}

interface PendingInvite {
  id: string
  email: string
  role: string
  permissions: Record<string, boolean>
  created_at: string
  expires_at: string
}

export default function TeamSettingsPage() {
  const { allowed, loading: roleLoading } = useRoleGuard(['owner', 'admin'])
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')
  const [invitePerms, setInvitePerms] = useState<Set<Permission>>(new Set(ROLE_DEFAULT_PERMISSIONS.staff))
  const [showInvitePerms, setShowInvitePerms] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [invited, setInvited] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [teamLimit, setTeamLimit] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [savingPerms, setSavingPerms] = useState(false)

  // Update default permissions when role changes
  useEffect(() => {
    setInvitePerms(new Set(ROLE_DEFAULT_PERMISSIONS[inviteRole] || []))
  }, [inviteRole])

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
        const { data: sub } = await supabase
          .from('store_subscriptions')
          .select('subscription_plans(limits)')
          .eq('store_id', store.id)
          .single()

        if (sub?.subscription_plans) {
          const plans = sub.subscription_plans as { limits?: { team_members?: number } }
          setTeamLimit(plans.limits?.team_members || 1)
        }

        const { data: teamMembers } = await supabase
          .from('store_members')
          .select('user_id, role, permissions, created_at, users(id, email, full_name)')
          .eq('store_id', store.id)

        if (teamMembers) {
          setMembers(teamMembers.map((m) => {
            const u = m.users as unknown as { id: string; email: string; full_name: string } | null
            return {
              id: m.user_id,
              email: u?.email || '',
              full_name: u?.full_name || '',
              role: m.role || 'staff',
              permissions: (m.permissions ?? null) as Record<string, boolean> | null,
              created_at: m.created_at || '',
            }
          }))
        }

        // Load pending invites
        const { data: invites } = await supabase
          .from('pending_invites')
          .select('id, email, role, permissions, created_at, expires_at')
          .eq('store_id', store.id)
          .gt('expires_at', new Date().toISOString())

        if (invites) {
          setPendingInvites(invites.map(inv => ({
            ...inv,
            permissions: (inv.permissions ?? {}) as Record<string, boolean>,
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInvited(null)
    setError(null)

    try {
      const perms = buildPermissions([...invitePerms])
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, permissions: perms }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Алдаа гарлаа')
        return
      }

      if (data.status === 'added') {
        // Existing user — added directly
        setMembers([...members, {
          id: data.member.user_id,
          email: data.member.email,
          full_name: '',
          role: data.member.role,
          permissions: data.member.permissions || null,
          created_at: new Date().toISOString(),
        }])
        setInvited('added')
      } else {
        // New user — pending invite created
        setPendingInvites([...pendingInvites, {
          id: '',
          email: data.invite.email,
          role: data.invite.role,
          permissions: data.invite.permissions,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }])
        setInvited('pending')
      }

      setInviteEmail('')
      setShowInvitePerms(false)
      setTimeout(() => setInvited(null), 5000)
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setInviting(false)
    }
  }

  async function handleCancelInvite(inviteId: string, email: string) {
    if (!confirm(`${email} урилгыг цуцлах уу?`)) return

    try {
      await supabase.from('pending_invites').delete().eq('id', inviteId)
      setPendingInvites(pendingInvites.filter(inv => inv.id !== inviteId))
    } catch {
      setError('Урилга цуцлахад алдаа гарлаа')
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

  async function handleSavePermissions(member: TeamMember, newPerms: Record<string, boolean>) {
    setSavingPerms(true)
    setError(null)

    try {
      const res = await fetch('/api/team/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: member.id, permissions: newPerms }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Эрх өөрчлөхөд алдаа гарлаа')
        return
      }

      setMembers(members.map(m =>
        m.id === member.id ? { ...m, permissions: newPerms } : m
      ))
      setEditingMember(null)
    } catch {
      setError('Эрх өөрчлөхөд алдаа гарлаа')
    } finally {
      setSavingPerms(false)
    }
  }

  function toggleInvitePerm(perm: Permission) {
    const next = new Set(invitePerms)
    if (next.has(perm)) {
      next.delete(perm)
    } else {
      next.add(perm)
    }
    setInvitePerms(next)
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

  const totalCount = members.length + pendingInvites.length
  const canInvite = teamLimit === -1 || totalCount < teamLimit

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Баг</h1>
          <p className="text-slate-400 mt-1">Хамтран ажиллах хүмүүс нэмэх, эрх тохируулах</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Team Usage */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Багийн гишүүд</p>
              <p className="text-white text-2xl font-bold mt-1">
                {members.length}
                {pendingInvites.length > 0 && <span className="text-yellow-400 text-base font-normal"> (+{pendingInvites.length} хүлээгдэж буй)</span>}
                <span className="text-slate-400 text-base font-normal">/{teamLimit === -1 ? '∞' : teamLimit}</span>
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

              {/* Permission picker toggle */}
              <button
                type="button"
                onClick={() => setShowInvitePerms(!showInvitePerms)}
                className={`text-xs font-medium transition-colors ${
                  showInvitePerms ? 'text-blue-400' : 'text-slate-400 hover:text-blue-400'
                }`}
              >
                {showInvitePerms ? '▼' : '▶'} Эрх тохируулах ({invitePerms.size}/{ALL_PERMISSIONS.length})
              </button>

              {/* Permission picker */}
              {showInvitePerms && (
                <div className="p-4 bg-slate-900/50 rounded-xl space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.map((perm) => (
                      <label
                        key={perm}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={invitePerms.has(perm)}
                          onChange={() => toggleInvitePerm(perm)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <div>
                          <p className="text-white text-sm">{PERMISSION_LABELS[perm]}</p>
                          <p className="text-slate-500 text-xs">{PERMISSION_DESCRIPTIONS[perm]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {inviting ? 'Урьж байна...' : 'Урих'}
                </button>
                {invited === 'added' && <span className="text-emerald-400 text-sm">Багт нэмэгдлээ</span>}
                {invited === 'pending' && <span className="text-yellow-400 text-sm">Урилга илгээгдлээ (бүртгүүлээгүй хэрэглэгч)</span>}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm">Таны план {teamLimit} гишүүнтэй. Нэмэлт гишүүн нэмэхийн тулд план шинэчилнэ үү.</p>
            </div>
          )}
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="bg-slate-800/50 border border-yellow-500/20 rounded-2xl divide-y divide-slate-700">
            <div className="p-4">
              <h3 className="text-yellow-400 font-medium text-sm">Хүлээгдэж буй урилгууд</h3>
            </div>
            {pendingInvites.map((inv) => (
              <div key={inv.id || inv.email} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center">
                    <span className="text-yellow-400 text-sm">✉</span>
                  </div>
                  <div>
                    <p className="text-white text-sm">{inv.email}</p>
                    <p className="text-slate-500 text-xs">
                      {getRoleLabel(inv.role)} · Хүчинтэй: {new Date(inv.expires_at).toLocaleDateString('mn-MN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400`}>
                    Хүлээгдэж буй
                  </span>
                  {inv.id && (
                    <button
                      onClick={() => handleCancelInvite(inv.id, inv.email)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Members List */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl divide-y divide-slate-700">
          <div className="p-4">
            <h3 className="text-white font-medium">Гишүүд</h3>
          </div>
          {members.length > 0 ? (
            members.map((member) => (
              <div key={member.id} className="p-4">
                <div className="flex items-center justify-between">
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
                      <>
                        <button
                          onClick={() => setEditingMember(editingMember === member.id ? null : member.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            editingMember === member.id
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'text-slate-400 hover:text-blue-400 hover:bg-slate-700'
                          }`}
                        >
                          Эрх
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Permission editor */}
                {editingMember === member.id && member.role !== 'owner' && (
                  <PermissionEditor
                    member={member}
                    onSave={(perms) => handleSavePermissions(member, perms)}
                    saving={savingPerms}
                  />
                )}
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

function PermissionEditor({
  member,
  onSave,
  saving,
}: {
  member: TeamMember
  onSave: (perms: Record<string, boolean>) => void
  saving: boolean
}) {
  const granted = getGrantedPermissions(member.role, member.permissions)
  const [selected, setSelected] = useState<Set<Permission>>(new Set(granted))

  function toggle(perm: Permission) {
    const next = new Set(selected)
    if (next.has(perm)) {
      next.delete(perm)
    } else {
      next.add(perm)
    }
    setSelected(next)
  }

  function handleSave() {
    onSave(buildPermissions([...selected]))
  }

  const hasChanges = (() => {
    const current = new Set(granted)
    if (current.size !== selected.size) return true
    for (const p of selected) {
      if (!current.has(p)) return true
    }
    return false
  })()

  return (
    <div className="mt-4 p-4 bg-slate-900/50 rounded-xl space-y-3">
      <p className="text-slate-300 text-sm font-medium">Модуль эрхүүд</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_PERMISSIONS.map((perm) => (
          <label
            key={perm}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(perm)}
              onChange={() => toggle(perm)}
              className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <div>
              <p className="text-white text-sm">{PERMISSION_LABELS[perm]}</p>
              <p className="text-slate-500 text-xs">{PERMISSION_DESCRIPTIONS[perm]}</p>
            </div>
          </label>
        ))}
      </div>
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        >
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
      )}
    </div>
  )
}
