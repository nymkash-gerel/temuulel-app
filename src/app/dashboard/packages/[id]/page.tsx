'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface PackageService {
  id: string
  service_id: string
  quantity: number
  services: { id: string; name: string } | null
}

interface Package {
  id: string
  name: string
  description: string | null
  price: number
  original_price: number | null
  valid_days: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  package_services: PackageService[]
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function PackageDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [pkg, setPkg] = useState<Package | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formOrigPrice, setFormOrigPrice] = useState('')
  const [formValidDays, setFormValidDays] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  useEffect(() => {
    loadPackage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPackage() {
    setLoading(true)
    try {
      const res = await fetch(`/api/packages/${id}`)
      if (res.ok) {
        const data = await res.json()
        setPkg(data)
        setFormName(data.name || '')
        setFormDescription(data.description || '')
        setFormPrice(data.price?.toString() || '')
        setFormOrigPrice(data.original_price?.toString() || '')
        setFormValidDays(data.valid_days?.toString() || '')
        setFormIsActive(data.is_active ?? true)
      }
    } catch { /* */ }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/packages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          price: parseFloat(formPrice),
          original_price: formOrigPrice ? parseFloat(formOrigPrice) : null,
          valid_days: formValidDays ? parseInt(formValidDays) : null,
          is_active: formIsActive,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPkg(data)
        setEditing(false)
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Багцыг устгах уу?')) return
    const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/dashboard/packages')
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

  if (!pkg) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Багц олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/packages')} className="mt-4 text-blue-400 hover:underline">&larr; Буцах</button>
      </div>
    )
  }

  const discount = pkg.original_price && pkg.original_price > pkg.price
    ? Math.round((1 - pkg.price / pkg.original_price) * 100)
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/packages')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">&larr; Буцах</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{pkg.name}</h1>
            <p className="text-slate-400 text-sm mt-1">Багцын дэлгэрэнгүй</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700">
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
                  <label className="block text-sm text-slate-400 mb-1">Анхны үнэ (₮)</label>
                  <input type="number" value={formOrigPrice} onChange={e => setFormOrigPrice(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хүчинтэй хугацаа (хоног)</label>
                <input type="number" value={formValidDays} onChange={e => setFormValidDays(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-slate-400">Нэр</span>
                  <p className="text-white font-medium">{pkg.name}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-400">Төлөв</span>
                  <p><span className={`px-3 py-1 rounded-full text-xs font-medium ${pkg.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{pkg.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}</span></p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-slate-400">Үнэ</span>
                  <p className="text-white text-lg font-semibold">₮{pkg.price.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-400">Анхны үнэ</span>
                  <p className="text-slate-400 line-through">{pkg.original_price ? `₮${pkg.original_price.toLocaleString()}` : '-'}</p>
                  {discount && <span className="text-green-400 text-xs">-{discount}%</span>}
                </div>
                <div>
                  <span className="text-sm text-slate-400">Хүчинтэй хугацаа</span>
                  <p className="text-white">{pkg.valid_days ? `${pkg.valid_days} хоног` : '-'}</p>
                </div>
              </div>
              {pkg.description && (
                <div>
                  <span className="text-sm text-slate-400">Тайлбар</span>
                  <p className="text-slate-300 whitespace-pre-wrap">{pkg.description}</p>
                </div>
              )}
              <div className="pt-4 border-t border-slate-700 text-sm text-slate-500 flex gap-6">
                <span>Үүсгэсэн: {formatDate(pkg.created_at)}</span>
                <span>Шинэчилсэн: {formatDate(pkg.updated_at)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Package Services */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Багцын үйлчилгээнүүд</h2>
          {pkg.package_services && pkg.package_services.length > 0 ? (
            <div className="space-y-3">
              {pkg.package_services.map(ps => (
                <div key={ps.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <span className="text-white text-sm">{ps.services?.name || ps.service_id}</span>
                  <span className="text-slate-400 text-xs">x{ps.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Үйлчилгээ нэмэгдээгүй</p>
          )}
        </div>
      </div>
    </div>
  )
}
