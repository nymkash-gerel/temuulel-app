'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ClientProfile {
  id: string
  customer_id: string
  skin_type: string | null
  hair_type: string | null
  allergies: string[] | null
  preferred_staff_id: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
  customers: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
  } | null
  preferred_staff: {
    id: string
    name: string
  } | null
}

interface EditingProfile {
  id: string
  skin_type: string
  hair_type: string
  allergies: string
  preferred_staff_id: string
  notes: string
}

interface StaffMember {
  id: string
  name: string
}

export default function ClientProfilesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<ClientProfile[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editingProfile, setEditingProfile] = useState<EditingProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadProfiles = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('client_preferences')
      .select(`
        id, customer_id, skin_type, hair_type, allergies,
        preferred_staff_id, notes, created_at, updated_at,
        customers(id, name, phone, email),
        preferred_staff:staff!client_preferences_preferred_staff_id_fkey(id, name)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })

    if (data) {
      setProfiles(data as unknown as ClientProfile[])
    }
  }, [supabase])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)

        const [, staffRes] = await Promise.all([
          loadProfiles(store.id),
          supabase.from('staff').select('id, name').eq('store_id', store.id).eq('status', 'active').order('name'),
        ])

        if (staffRes.data) setStaffList(staffRes.data)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router, loadProfiles])

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles
    const q = search.trim().toLowerCase()
    return profiles.filter(p =>
      p.customers?.name?.toLowerCase().includes(q) ||
      p.customers?.phone?.includes(q) ||
      p.customers?.email?.toLowerCase().includes(q) ||
      p.skin_type?.toLowerCase().includes(q) ||
      p.hair_type?.toLowerCase().includes(q)
    )
  }, [profiles, search])

  function startEdit(profile: ClientProfile) {
    setEditingProfile({
      id: profile.id,
      skin_type: profile.skin_type || '',
      hair_type: profile.hair_type || '',
      allergies: (profile.allergies || []).join(', '),
      preferred_staff_id: profile.preferred_staff_id || '',
      notes: profile.notes || '',
    })
    setError('')
  }

  function cancelEdit() {
    setEditingProfile(null)
    setError('')
  }

  async function handleSave() {
    if (!editingProfile) return

    setSaving(true)
    setError('')

    const allergies = editingProfile.allergies
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0)

    try {
      const { error: updateError } = await supabase
        .from('client_preferences')
        .update({
          skin_type: editingProfile.skin_type || null,
          hair_type: editingProfile.hair_type || null,
          allergies: allergies.length > 0 ? allergies : [],
          preferred_staff_id: editingProfile.preferred_staff_id || null,
          notes: editingProfile.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProfile.id)

      if (updateError) throw updateError

      await loadProfiles(storeId)
      setEditingProfile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Profiles</h1>
          <p className="text-slate-400 mt-1">
            {profiles.length} client profiles
            {filtered.length !== profiles.length && ` (${filtered.length} shown)`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">&#128269;</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, skin type, hair type..."
            className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
          />
        </div>
      </div>

      {/* Edit Modal / Inline Form */}
      {editingProfile && (
        <div className="bg-slate-800/50 border border-pink-500/30 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Edit Client Profile</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Skin Type</label>
              <select
                value={editingProfile.skin_type}
                onChange={(e) => setEditingProfile({ ...editingProfile, skin_type: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
              >
                <option value="">Not specified</option>
                <option value="normal">Normal</option>
                <option value="dry">Dry</option>
                <option value="oily">Oily</option>
                <option value="combination">Combination</option>
                <option value="sensitive">Sensitive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Hair Type</label>
              <select
                value={editingProfile.hair_type}
                onChange={(e) => setEditingProfile({ ...editingProfile, hair_type: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
              >
                <option value="">Not specified</option>
                <option value="straight">Straight</option>
                <option value="wavy">Wavy</option>
                <option value="curly">Curly</option>
                <option value="coily">Coily</option>
                <option value="fine">Fine</option>
                <option value="thick">Thick</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Allergies (comma-separated)</label>
              <input
                type="text"
                value={editingProfile.allergies}
                onChange={(e) => setEditingProfile({ ...editingProfile, allergies: e.target.value })}
                placeholder="e.g. Latex, Fragrance, Parabens"
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Preferred Staff</label>
              <select
                value={editingProfile.preferred_staff_id}
                onChange={(e) => setEditingProfile({ ...editingProfile, preferred_staff_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
              >
                <option value="">No preference</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
              <textarea
                value={editingProfile.notes}
                onChange={(e) => setEditingProfile({ ...editingProfile, notes: e.target.value })}
                placeholder="Any special preferences, conditions, or notes..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={cancelEdit}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Profiles Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Skin Type</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Hair Type</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Allergies</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Preferred Staff</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Notes</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium">
                          {profile.customers?.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{profile.customers?.name || 'Unknown'}</p>
                        <p className="text-slate-400 text-sm">{profile.customers?.phone || profile.customers?.email || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    {profile.skin_type ? (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full capitalize">
                        {profile.skin_type}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    {profile.hair_type ? (
                      <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full capitalize">
                        {profile.hair_type}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    {profile.allergies && profile.allergies.length > 0 ? (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                        {profile.allergies.length} allergi{profile.allergies.length === 1 ? 'y' : 'es'}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-sm">None</span>
                    )}
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">
                      {profile.preferred_staff?.name || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm truncate block max-w-[180px]">
                      {profile.notes || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <button
                      onClick={() => startEdit(profile)}
                      className="px-3 py-1 text-xs bg-slate-600/20 text-slate-300 rounded-lg hover:bg-slate-600/40 transition-all"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : profiles.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No profiles match your search</p>
          <button
            onClick={() => setSearch('')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128113;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Client Profiles</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Client profiles are created when customers book services. They store skin type,
            hair type, allergies, and preferences for personalized service.
          </p>
        </div>
      )}
    </div>
  )
}
