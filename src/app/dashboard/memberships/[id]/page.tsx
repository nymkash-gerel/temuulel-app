'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Membership {
  id: string
  name: string
  description: string | null
  price: number
  billing_period: string | null
  benefits: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Сар бүр',
  quarterly: 'Улирал бүр',
  yearly: 'Жил бүр',
  one_time: 'Нэг удаа',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function MembershipDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formPeriod, setFormPeriod] = useState('monthly')
  const [formIsActive, setFormIsActive] = useState(true)

  useEffect(() => {
    loadMembership()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadMembership() {
    setLoading(true)
    try {
      const res = await fetch(`/api/memberships/${id}`)
      if (res.ok) {
        const data = await res.json()
        setMembership(data)
        setFormName(data.name || '')
        setFormDescription(data.description || '')
        setFormPrice(data.price?.toString() || '')
        setFormPeriod(data.billing_period || 'monthly')
        setFormIsActive(data.is_active ?? true)
      }
    } catch { /* */ }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/memberships/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          price: parseFloat(formPrice),
          billing_period: formPeriod,
          is_active: formIsActive,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setMembership(data)
        setEditing(false)
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Гишүүнчлэлийн төлөвлөгөөг устгах уу?')) return
    const res = await fetch(`/api/memberships/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/dashboard/memberships')
    else alert('Устгах үед алдаа гарлаа')
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-64 bg-slate-700 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Гишүүнчлэл олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/memberships')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/memberships')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{membership.name}</h1>
            <p className="text-slate-400 text-sm mt-1">Гишүүнчлэлийн дэлгэрэнгүй</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all">Засах</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl text-sm transition-all">Устгах</button>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        {editing ? (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Нэр *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Тайлбар</label>
              <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Үнэ (₮) *</label>
                <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төлбөрийн давтамж</label>
                <select value={formPeriod} onChange={e => setFormPeriod(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500">
                  <option value="monthly">Сар бүр</option>
                  <option value="quarterly">Улирал бүр</option>
                  <option value="yearly">Жил бүр</option>
                  <option value="one_time">Нэг удаа</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)} className="rounded" />
              <label className="text-sm text-slate-300">Идэвхтэй</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">Болих</button>
              <button onClick={handleSave} disabled={saving || !formName.trim() || !formPrice} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-slate-400">Нэр</span>
                <p className="text-white font-medium">{membership.name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Үнэ</span>
                <p className="text-white text-lg font-semibold">₮{membership.price.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Төлбөрийн давтамж</span>
                <p className="text-white">{PERIOD_LABELS[membership.billing_period || ''] || membership.billing_period || '-'}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-slate-400">Төлөв</span>
              <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${membership.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{membership.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}</span></p>
            </div>
            {membership.description && (
              <div>
                <span className="text-sm text-slate-400">Тайлбар</span>
                <p className="text-slate-300 whitespace-pre-wrap">{membership.description}</p>
              </div>
            )}
            <div className="pt-4 border-t border-slate-700 text-sm text-slate-500 flex gap-6">
              <span>Үүсгэсэн: {formatDate(membership.created_at)}</span>
              <span>Шинэчилсэн: {formatDate(membership.updated_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
