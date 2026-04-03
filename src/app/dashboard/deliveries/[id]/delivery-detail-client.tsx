'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'

interface DeliveryDetail {
  id: string
  delivery_number: string
  status: string
  delivery_type: 'own_driver' | 'external_provider'
  provider_name: string | null
  provider_tracking_id: string | null
  pickup_address: string | null
  delivery_address: string
  customer_name: string | null
  customer_phone: string | null
  estimated_delivery_time: string | null
  actual_delivery_time: string | null
  delivery_fee: number | null
  notes: string | null
  failure_reason: string | null
  proof_photo_url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  orders: { id: string; order_number: string; total_amount: number; status: string } | null
  delivery_drivers: { id: string; name: string; phone: string; vehicle_type: string; vehicle_number: string | null; status: string } | null
  delivery_status_log: StatusLog[]
}

interface StatusLog {
  id: string
  status: string
  changed_by: string | null
  notes: string | null
  location: { lat: number; lng: number } | null
  created_at: string
}

interface Driver {
  id: string
  name: string
  phone: string
  status: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' },
  assigned: { label: 'Оноосон', color: 'bg-blue-500/20 text-blue-400', icon: '👤' },
  picked_up: { label: 'Авсан', color: 'bg-indigo-500/20 text-indigo-400', icon: '📦' },
  in_transit: { label: 'Зам дээр', color: 'bg-purple-500/20 text-purple-400', icon: '🚚' },
  delivered: { label: 'Хүргэсэн', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  failed: { label: 'Амжилтгүй', color: 'bg-red-500/20 text-red-400', icon: '❌' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-slate-500/20 text-slate-400', icon: '🚫' },
  delayed: { label: 'Хоцорсон', color: 'bg-orange-500/20 text-orange-400', icon: '⚠️' },
}

const NEXT_ACTIONS: Record<string, { status: string; label: string; color: string }[]> = {
  pending: [
    { status: 'assigned', label: 'Жолооч оноох', color: 'from-blue-600 to-cyan-600' },
    { status: 'cancelled', label: 'Цуцлах', color: 'from-red-600 to-red-700' },
  ],
  assigned: [
    { status: 'picked_up', label: 'Авсан гэж тэмдэглэх', color: 'from-indigo-600 to-indigo-700' },
    { status: 'cancelled', label: 'Цуцлах', color: 'from-red-600 to-red-700' },
  ],
  picked_up: [
    { status: 'in_transit', label: 'Зам дээр', color: 'from-purple-600 to-purple-700' },
  ],
  in_transit: [
    { status: 'delivered', label: 'Хүргэсэн', color: 'from-green-600 to-green-700' },
    { status: 'delayed', label: 'Хоцорсон', color: 'from-orange-600 to-orange-700' },
    { status: 'failed', label: 'Амжилтгүй', color: 'from-red-600 to-red-700' },
  ],
  delayed: [
    { status: 'in_transit', label: 'Зам дээр буцаах', color: 'from-purple-600 to-purple-700' },
    { status: 'delivered', label: 'Хүргэсэн', color: 'from-green-600 to-green-700' },
    { status: 'failed', label: 'Амжилтгүй', color: 'from-red-600 to-red-700' },
  ],
}

interface Props {
  initialDelivery: DeliveryDetail
  initialDrivers: Driver[]
  storeId: string
}

export default function DeliveryDetailClient({ initialDelivery, initialDrivers, storeId }: Props) {
  const supabase = createClient()
  const id = initialDelivery.id

  const [delivery, setDelivery] = useState<DeliveryDetail>(initialDelivery)
  const [drivers] = useState<Driver[]>(initialDrivers)
  const [updating, setUpdating] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [failureReason, setFailureReason] = useState('')

  async function reloadDelivery() {
    const { data: updated } = await supabase
      .from('deliveries')
      .select(`*, orders(id, order_number, total_amount, status), delivery_drivers(id, name, phone, vehicle_type, vehicle_number, status), delivery_status_log(id, status, changed_by, notes, location, created_at)`)
      .eq('id', id).eq('store_id', storeId).single()
    if (updated) {
      const d = updated as unknown as DeliveryDetail
      d.delivery_status_log = (d.delivery_status_log || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setDelivery(d)
    }
  }

  async function handleReassignDriver() {
    if (!delivery || !selectedDriverId) return
    if (selectedDriverId === delivery.delivery_drivers?.id) { alert('Өөр жолооч сонгоно уу'); return }
    setUpdating(true)
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driver_id: selectedDriverId }) })
      if (res.ok) { await reloadDelivery(); setSelectedDriverId('') }
      else { const err = await res.json(); alert(err.error || 'Error') }
    } catch { alert('Алдаа гарлаа') }
    finally { setUpdating(false) }
  }

  async function handleStatusUpdate(newStatus: string) {
    if (!delivery) return
    if (newStatus === 'assigned' && !delivery.delivery_drivers && !selectedDriverId) { alert('Жолооч сонгоно уу'); return }
    if (newStatus === 'failed' && !failureReason.trim()) { alert('Амжилтгүй болсон шалтгаан оруулна уу'); return }
    setUpdating(true)
    try {
      const payload: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'assigned' && selectedDriverId) payload.driver_id = selectedDriverId
      if (newStatus === 'failed') payload.failure_reason = failureReason.trim()
      const res = await fetch(`/api/deliveries/${delivery.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { await reloadDelivery(); setFailureReason(''); setSelectedDriverId('') }
      else { const err = await res.json(); alert(err.error || 'Error') }
    } catch { alert('Алдаа гарлаа') }
    finally { setUpdating(false) }
  }

  const sc = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending
  const actions = NEXT_ACTIONS[delivery.status] || []

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/deliveries" className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all">←</Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">#{delivery.delivery_number}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${sc.color}`}>{sc.icon} {sc.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${delivery.delivery_type === 'own_driver' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {delivery.delivery_type === 'own_driver' ? 'Өөрийн жолооч' : delivery.provider_name || 'Гадны хүргэлт'}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">Үүсгэсэн: {new Date(delivery.created_at).toLocaleString('mn-MN')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Info */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Хүргэлтийн мэдээлэл</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-slate-400">Хүргэх хаяг</p><p className="text-white mt-1">{delivery.delivery_address}</p></div>
              {delivery.pickup_address && <div><p className="text-sm text-slate-400">Авах хаяг</p><p className="text-white mt-1">{delivery.pickup_address}</p></div>}
              {delivery.customer_name && <div><p className="text-sm text-slate-400">Хүлээн авагч</p><p className="text-white mt-1">{delivery.customer_name}</p></div>}
              {delivery.customer_phone && <div><p className="text-sm text-slate-400">Утас</p><p className="text-white mt-1">{delivery.customer_phone}</p></div>}
              {delivery.estimated_delivery_time && <div><p className="text-sm text-slate-400">Хүргэх хугацаа</p><p className="text-white mt-1">{new Date(delivery.estimated_delivery_time).toLocaleString('mn-MN')}</p></div>}
              {delivery.actual_delivery_time && <div><p className="text-sm text-slate-400">Хүргэсэн цаг</p><p className="text-green-400 mt-1">{new Date(delivery.actual_delivery_time).toLocaleString('mn-MN')}</p></div>}
              {delivery.delivery_fee != null && <div><p className="text-sm text-slate-400">Хүргэлтийн төлбөр</p><p className="text-white mt-1 font-medium">{formatPrice(delivery.delivery_fee)}</p></div>}
              {delivery.provider_tracking_id && <div><p className="text-sm text-slate-400">Гадны tracking ID</p><p className="text-white mt-1 font-mono text-sm">{delivery.provider_tracking_id}</p></div>}
            </div>
            {delivery.notes && <div className="mt-4 pt-4 border-t border-white/[0.06]"><p className="text-sm text-slate-400 mb-1">Тэмдэглэл</p><p className="text-white">{delivery.notes}</p></div>}
            {delivery.failure_reason && <div className="mt-4 pt-4 border-t border-white/[0.06]"><p className="text-sm text-red-400 mb-1">Амжилтгүй болсон шалтгаан</p><p className="text-red-300">{delivery.failure_reason}</p></div>}
            {delivery.proof_photo_url && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-sm text-slate-400 mb-2">Хүргэсэн баталгаа</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={delivery.proof_photo_url} alt="Proof of delivery" className="w-48 h-48 object-cover rounded-xl border border-white/[0.06]" />
              </div>
            )}
            {delivery.status === 'failed' && delivery.metadata && (delivery.metadata.wrong_item_photo_url || delivery.metadata.wrong_item_photo_file_id || delivery.metadata.awaiting_wrong_photo !== undefined) && (
              <div className="mt-4 pt-4 border-t border-red-800/50">
                <p className="text-sm text-red-400 mb-2 font-medium">Буруу бараа</p>
                {(delivery.metadata.wrong_item_photo_url || delivery.metadata.wrong_item_photo_file_id) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={(delivery.metadata.wrong_item_photo_url as string) || `/api/deliveries/photo?file_id=${encodeURIComponent(delivery.metadata.wrong_item_photo_file_id as string)}&bot=driver`} alt="Wrong item photo" className="w-48 h-48 object-cover rounded-xl border border-red-700/50" />
                ) : <p className="text-slate-500 text-sm">Зураг хүлээгдэж байна...</p>}
                <div className="mt-3 space-y-1">
                  {delivery.metadata.wrong_item_returned ? (
                    <p className="text-green-400 text-sm">✅ Агуулахад буцааж өгсөн {delivery.metadata.wrong_item_returned_at ? `— ${new Date(delivery.metadata.wrong_item_returned_at as string).toLocaleString('mn-MN')}` : ''}</p>
                  ) : <p className="text-yellow-400 text-sm">⏳ Буцаагдаагүй байна</p>}
                  {delivery.metadata.wrong_product_note && <p className="text-slate-300 text-sm">📝 {delivery.metadata.wrong_product_note as string}</p>}
                  {delivery.metadata.wrong_product_received_by && <p className="text-slate-400 text-xs">Хүлээн авсан: {delivery.metadata.wrong_product_received_by as string}</p>}
                </div>
                <details className="mt-2"><summary className="text-slate-600 text-xs cursor-pointer">metadata</summary><pre className="text-slate-500 text-xs mt-1 overflow-auto max-h-32">{JSON.stringify(delivery.metadata, null, 2)}</pre></details>
              </div>
            )}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Үйлдэл</h2>
              {delivery.status === 'pending' && !delivery.delivery_drivers && drivers.length > 0 && (
                <div className="mb-4"><label className="block text-sm text-slate-400 mb-1">Жолооч сонгох</label><select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"><option value="">Жолооч сонгох...</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>)}</select></div>
              )}
              {delivery.delivery_drivers && !['delivered', 'failed', 'cancelled'].includes(delivery.status) && drivers.length > 0 && (
                <div className="mb-4"><label className="block text-sm text-slate-400 mb-1">Жолооч солих</label><div className="flex gap-2"><select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"><option value="">Өөр жолооч сонгох...</option>{drivers.filter(d => d.id !== delivery.delivery_drivers?.id).map(d => <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>)}</select><button onClick={handleReassignDriver} disabled={updating || !selectedDriverId} className="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 hover:opacity-90 whitespace-nowrap">{updating ? '...' : '🔄 Солих'}</button></div></div>
              )}
              {['in_transit', 'delayed'].includes(delivery.status) && (
                <div className="mb-4"><label className="block text-sm text-slate-400 mb-1">Шалтгаан (амжилтгүй болвол)</label><input type="text" value={failureReason} onChange={(e) => setFailureReason(e.target.value)} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20" placeholder="Утсанд хариулахгүй байна..." /></div>
              )}
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => (
                  <button key={action.status} onClick={() => handleStatusUpdate(action.status)} disabled={updating} className={`px-5 py-2.5 bg-gradient-to-r ${action.color} text-white font-medium rounded-xl transition-all disabled:opacity-50 hover:opacity-90`}>
                    {updating ? '...' : action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status Timeline */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Түүх</h2>
            {delivery.delivery_status_log.length > 0 ? (
              <div className="space-y-4">
                {delivery.delivery_status_log.map((log, i) => {
                  const logSc = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending
                  return (
                    <div key={log.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${logSc.color}`}>{logSc.icon}</div>
                        {i < delivery.delivery_status_log.length - 1 && <div className="w-px h-full bg-white/[0.06] mt-1" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{logSc.label}</p>
                          <span className="text-slate-500 text-xs">{new Date(log.created_at).toLocaleString('mn-MN')}</span>
                        </div>
                        {log.changed_by && <p className="text-slate-400 text-sm mt-0.5">Өөрчилсөн: {log.changed_by}</p>}
                        {log.notes && <p className="text-slate-400 text-sm mt-0.5">{log.notes}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-slate-400">Түүх байхгүй</p>}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {delivery.delivery_drivers ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Жолооч</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/[0.06] rounded-xl flex items-center justify-center">
                  <span className="text-xl">{delivery.delivery_drivers.vehicle_type === 'motorcycle' ? '🏍️' : delivery.delivery_drivers.vehicle_type === 'car' ? '🚗' : delivery.delivery_drivers.vehicle_type === 'bicycle' ? '🚲' : '🚶'}</span>
                </div>
                <div><p className="text-white font-medium">{delivery.delivery_drivers.name}</p><p className="text-slate-400 text-sm">{delivery.delivery_drivers.phone}</p></div>
              </div>
              {delivery.delivery_drivers.vehicle_number && <p className="text-slate-400 text-sm">Дугаар: {delivery.delivery_drivers.vehicle_number}</p>}
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5"><h3 className="text-sm font-medium text-slate-400 mb-3">Жолооч</h3><p className="text-slate-500 text-sm">Жолооч оноогоогүй</p></div>
          )}
          {delivery.orders && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Захиалга</h3>
              <Link href={`/dashboard/orders/${delivery.orders.id}`} className="text-blue-400 hover:text-blue-300 font-medium transition-all">#{delivery.orders.order_number}</Link>
              <p className="text-white mt-1">{formatPrice(delivery.orders.total_amount)}</p>
              <p className="text-slate-400 text-sm mt-1">Статус: {delivery.orders.status}</p>
            </div>
          )}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Хураангуй</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Дугаар</span><span className="text-white">#{delivery.delivery_number}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Төрөл</span><span className="text-white">{delivery.delivery_type === 'own_driver' ? 'Өөрийн жолооч' : 'Гадны хүргэлт'}</span></div>
              {delivery.delivery_fee != null && <div className="flex justify-between"><span className="text-slate-400">Төлбөр</span><span className="text-white">{formatPrice(delivery.delivery_fee)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-400">Үүсгэсэн</span><span className="text-white">{new Date(delivery.created_at).toLocaleDateString('mn-MN')}</span></div>
              {delivery.updated_at !== delivery.created_at && <div className="flex justify-between"><span className="text-slate-400">Шинэчилсэн</span><span className="text-white">{new Date(delivery.updated_at).toLocaleString('mn-MN')}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
