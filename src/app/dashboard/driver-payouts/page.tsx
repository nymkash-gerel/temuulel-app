'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToFile } from '@/lib/export-utils'
import { resolveStoreId } from '@/lib/resolve-store'
import { formatPrice } from '@/lib/format'

interface Payout {
  id: string
  driver_id: string
  period_start: string
  period_end: string
  total_amount: number
  delivery_count: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paid_at: string | null
  notes: string | null
  created_at: string
  delivery_drivers: { id: string; name: string; phone: string } | null
}

interface Driver {
  id: string
  name: string
  phone: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-blue-500/20 text-blue-400' },
  paid: { label: 'Төлсөн', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}


export default function DriverPayoutsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  // Generate form state
  const [genStart, setGenStart] = useState('')
  const [genEnd, setGenEnd] = useState('')

  // Form state
  const [formDriverId, setFormDriverId] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formCount, setFormCount] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const storeId = await resolveStoreId(supabase, user.id)
      const store = storeId ? { id: storeId } : null

      if (!store) return

      const [payoutsRes, driversRes] = await Promise.all([
        fetch('/api/driver-payouts'),
        supabase
          .from('delivery_drivers')
          .select('id, name, phone')
          .eq('store_id', store.id)
          .order('name'),
      ])

      if (payoutsRes.ok) {
        const data = await payoutsRes.json()
        setPayouts(data.payouts)
      }
      if (driversRes.data) setDrivers(driversRes.data)

      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleCreate() {
    if (!formDriverId || !formStart || !formEnd || !formAmount) return
    setCreating(true)

    try {
      const res = await fetch('/api/driver-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: formDriverId,
          period_start: formStart,
          period_end: formEnd,
          total_amount: Number(formAmount),
          delivery_count: Number(formCount) || 0,
          notes: formNotes.trim() || undefined,
        }),
      })

      if (res.ok) {
        const { payout } = await res.json()
        const driver = drivers.find(d => d.id === formDriverId)
        setPayouts(prev => [{
          ...payout,
          delivery_drivers: driver ? { id: driver.id, name: driver.name, phone: driver.phone } : null,
        }, ...prev])
        setShowForm(false)
        setFormDriverId('')
        setFormStart('')
        setFormEnd('')
        setFormAmount('')
        setFormCount('')
        setFormNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
  }

  async function handleStatusUpdate(payoutId: string, newStatus: string) {
    setUpdating(payoutId)
    try {
      const res = await fetch(`/api/driver-payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const { payout } = await res.json()
        setPayouts(prev => prev.map(p =>
          p.id === payoutId ? { ...p, ...payout } : p
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setUpdating(null)
    }
  }

  async function handleGenerate() {
    if (!genStart || !genEnd) return
    setGenerating(true)
    try {
      const res = await fetch('/api/driver-payouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_start: genStart, period_end: genEnd }),
      })
      const data = await res.json()
      if (data.payouts && data.payouts.length > 0) {
        setPayouts(prev => [...data.payouts, ...prev])
        setShowGenerate(false)
        setGenStart('')
        setGenEnd('')
        alert(`${data.created_count} төлбөр амжилттай үүсгэлээ${data.skipped_count > 0 ? ` (${data.skipped_count} давхардсан)` : ''}`)
      } else {
        alert(data.message || data.error || 'Хүргэгдсэн захиалга олдсонгүй')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = payouts.map(p => ({
      'Жолооч': p.delivery_drivers?.name || '',
      'Эхлэх огноо': new Date(p.period_start).toLocaleDateString('mn-MN'),
      'Дуусах огноо': new Date(p.period_end).toLocaleDateString('mn-MN'),
      'Хүргэлт тоо': p.delivery_count,
      'Нийт дүн': Number(p.total_amount),
      'Төлөв': STATUS_CONFIG[p.status]?.label || p.status,
    }))
    exportToFile(data, 'joloochiin-tolbor', format, 'Жолоочийн төлбөр')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pendingTotal = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.total_amount), 0)
  const paidTotal = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.total_amount), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Жолоочийн төлбөр</h1>
          <p className="text-slate-400 mt-1">Нийт {payouts.length} төлбөр</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('xlsx')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📥</span><span>Excel</span>
          </button>
          <button onClick={() => handleExport('csv')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📄</span><span>CSV</span>
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium rounded-xl transition-all"
          >
            Автомат тооцоолох
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            + Төлбөр нэмэх
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(pendingTotal)}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Төлсөн (нийт)</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(paidTotal)}</p>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ төлбөр</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Жолооч *</label>
                <select
                  value={formDriverId}
                  onChange={(e) => setFormDriverId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Жолооч сонгох...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Эхлэх огноо *</label>
                  <input
                    type="date"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Дуусах огноо *</label>
                  <input
                    type="date"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Нийт дүн *</label>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүргэлтийн тоо</label>
                  <input
                    type="number"
                    value={formCount}
                    onChange={(e) => setFormCount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="25"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Нэмэлт мэдээлэл..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formDriverId || !formStart || !formEnd || !formAmount}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Төлбөр үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGenerate(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2">Автомат тооцоолох</h2>
            <p className="text-slate-400 text-sm mb-4">
              Хугацааны хүрээнд хүргэгдсэн захиалгаар жолооч бүрийн төлбөрийг автомат тооцоолно.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Эхлэх огноо *</label>
                <input
                  type="date"
                  value={genStart}
                  onChange={(e) => setGenStart(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Дуусах огноо *</label>
                <input
                  type="date"
                  value={genEnd}
                  onChange={(e) => setGenEnd(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGenerate(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !genStart || !genEnd}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {generating ? 'Тооцоолж байна...' : 'Тооцоолох'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payouts Table */}
      {payouts.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Жолооч</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Хугацаа</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Дүн</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Хүргэлт</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
                return (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-4">
                      <p className="text-white font-medium text-sm">{p.delivery_drivers?.name || '—'}</p>
                      <p className="text-slate-400 text-xs">{p.delivery_drivers?.phone || ''}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-300 text-sm">
                        {new Date(p.period_start).toLocaleDateString('mn-MN')} — {new Date(p.period_end).toLocaleDateString('mn-MN')}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-white font-medium">{formatPrice(Number(p.total_amount))}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-300">{p.delivery_count}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                      {p.paid_at && (
                        <p className="text-slate-500 text-xs mt-0.5">
                          {new Date(p.paid_at).toLocaleDateString('mn-MN')}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1.5 justify-end">
                        {p.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(p.id, 'approved')}
                              disabled={updating === p.id}
                              className="px-2.5 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all disabled:opacity-50"
                            >
                              Зөвшөөрөх
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(p.id, 'cancelled')}
                              disabled={updating === p.id}
                              className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all disabled:opacity-50"
                            >
                              Цуцлах
                            </button>
                          </>
                        )}
                        {p.status === 'approved' && (
                          <button
                            onClick={() => handleStatusUpdate(p.id, 'paid')}
                            disabled={updating === p.id}
                            className="px-2.5 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-all disabled:opacity-50"
                          >
                            Төлсөн
                          </button>
                        )}
                        {['paid', 'cancelled'].includes(p.status) && (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">💸</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Төлбөр байхгүй</h3>
          <p className="text-slate-400 mb-6">Жолоочдод төлбөр үүсгэхийн тулд дээрх товчийг дарна уу</p>
        </div>
      )}
    </div>
  )
}
