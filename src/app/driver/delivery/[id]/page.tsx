'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface DeliveryDetail {
  id: string
  delivery_number: string
  status: string
  delivery_address: string
  customer_name: string | null
  customer_phone: string | null
  delivery_fee: number
  notes: string | null
  failure_reason: string | null
  proof_photo_url: string | null
  estimated_delivery_time: string | null
  actual_delivery_time: string | null
  created_at: string
  order: { id: string; order_number: string; total_amount: number; status: string } | null
  status_log: { id: string; status: string; changed_by: string; notes: string | null; created_at: string }[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  assigned: { label: 'Оноосон', color: 'bg-yellow-500/20 text-yellow-400' },
  picked_up: { label: 'Авсан', color: 'bg-blue-500/20 text-blue-400' },
  in_transit: { label: 'Зам дээр', color: 'bg-purple-500/20 text-purple-400' },
  delivered: { label: 'Хүргэсэн', color: 'bg-green-500/20 text-green-400' },
  failed: { label: 'Амжилтгүй', color: 'bg-red-500/20 text-red-400' },
  delayed: { label: 'Хоцорсон', color: 'bg-orange-500/20 text-orange-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-slate-500/20 text-slate-400' },
}

const DRIVER_TRANSITIONS: Record<string, { label: string; status: string; color: string }[]> = {
  assigned: [
    { label: 'Авсан', status: 'picked_up', color: 'from-blue-500 to-blue-600' },
  ],
  picked_up: [
    { label: 'Зам дээр', status: 'in_transit', color: 'from-purple-500 to-purple-600' },
  ],
  in_transit: [
    { label: 'Хүргэсэн', status: 'delivered', color: 'from-green-500 to-green-600' },
    { label: 'Хоцорсон', status: 'delayed', color: 'from-orange-500 to-orange-600' },
    { label: 'Амжилтгүй', status: 'failed', color: 'from-red-500 to-red-600' },
  ],
  delayed: [
    { label: 'Зам дээр', status: 'in_transit', color: 'from-purple-500 to-purple-600' },
    { label: 'Хүргэсэн', status: 'delivered', color: 'from-green-500 to-green-600' },
    { label: 'Амжилтгүй', status: 'failed', color: 'from-red-500 to-red-600' },
  ],
}

export default function DriverDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [failureReason, setFailureReason] = useState('')
  const [showFailModal, setShowFailModal] = useState(false)
  const [proofUploading, setProofUploading] = useState(false)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  const fetchDelivery = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/deliveries/${id}`)
      const data = await res.json()
      if (res.ok) {
        setDelivery(data.delivery)
      }
    } catch {
      console.error('Failed to fetch delivery')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDelivery()
  }, [fetchDelivery])

  useEffect(() => {
    if (delivery?.proof_photo_url) {
      setProofUrl(delivery.proof_photo_url)
    }
  }, [delivery?.proof_photo_url])

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProofUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/driver/deliveries/${id}/upload-proof`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setProofUrl(data.url)
      }
    } catch {
      console.error('Proof upload failed')
    } finally {
      setProofUploading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (newStatus === 'failed') {
      setShowFailModal(true)
      return
    }

    setActionLoading(true)

    // Try to get current location
    let location: { lat: number; lng: number } | undefined
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      })
      location = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      // Location not available — continue without it
    }

    try {
      const res = await fetch(`/api/driver/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes: notes || undefined, location }),
      })

      if (res.ok) {
        setNotes('')
        await fetchDelivery()
        if (newStatus === 'delivered') {
          router.push('/driver')
        }
      }
    } catch {
      console.error('Status update failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleFailSubmit = async () => {
    if (!failureReason.trim()) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/driver/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', failure_reason: failureReason }),
      })

      if (res.ok) {
        setShowFailModal(false)
        setFailureReason('')
        router.push('/driver')
      }
    } catch {
      console.error('Failed to mark as failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !delivery) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[delivery.status] || STATUS_LABELS.pending
  const actions = DRIVER_TRANSITIONS[delivery.status] || []
  const isTerminal = ['delivered', 'failed', 'cancelled'].includes(delivery.status)

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link href="/driver" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
        ← Буцах
      </Link>

      {/* Header */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-white font-bold text-lg">{delivery.delivery_number}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
        <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Хүргэх мэдээлэл</h2>

        <div>
          <p className="text-white text-sm">{delivery.delivery_address}</p>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(delivery.delivery_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 text-xs hover:text-blue-300 mt-1 inline-block"
          >
            Газрын зураг дээр нээх →
          </a>
        </div>

        {delivery.customer_name && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">{delivery.customer_name}</span>
            {delivery.customer_phone && (
              <a
                href={`tel:+976${delivery.customer_phone}`}
                className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors"
              >
                Залгах
              </a>
            )}
          </div>
        )}

        {delivery.delivery_fee > 0 && (
          <p className="text-slate-400 text-sm">
            Хүргэлтийн төлбөр: <span className="text-white">{delivery.delivery_fee.toLocaleString()}₮</span>
          </p>
        )}
      </div>

      {/* Order Info */}
      {delivery.order && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Захиалга</h2>
          <p className="text-white text-sm">#{delivery.order.order_number}</p>
          <p className="text-slate-400 text-sm">{delivery.order.total_amount?.toLocaleString()}₮</p>
        </div>
      )}

      {/* Notes Input */}
      {!isTerminal && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-2">Тэмдэглэл</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Нэмэлт тэмдэглэл..."
            rows={2}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      )}

      {/* Proof Photo */}
      {(['in_transit', 'delayed'].includes(delivery.status) || proofUrl) && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Хүргэлтийн нотлох зураг</h2>

          {proofUrl && (
            <div className="mb-3">
              <img
                src={proofUrl}
                alt="Хүргэлтийн нотолгоо"
                className="w-full rounded-lg max-h-64 object-cover"
              />
            </div>
          )}

          {['in_transit', 'delayed'].includes(delivery.status) && (
            <label className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-dashed border-slate-600 rounded-xl text-sm cursor-pointer transition-colors ${proofUploading ? 'opacity-50' : 'hover:border-blue-500 hover:text-blue-400'} text-slate-400`}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleProofUpload}
                disabled={proofUploading}
                className="hidden"
              />
              {proofUploading ? 'Илгээж байна...' : proofUrl ? 'Зураг солих' : 'Зураг оруулах'}
            </label>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => handleStatusUpdate(action.status)}
              disabled={actionLoading}
              className={`w-full py-3 px-4 bg-gradient-to-r ${action.color} text-white font-medium rounded-xl transition-all disabled:opacity-50`}
            >
              {actionLoading ? 'Шинэчилж байна...' : action.label}
            </button>
          ))}
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Түүх</h2>
        <div className="space-y-3">
          {delivery.status_log.map((log) => {
            const logStatus = STATUS_LABELS[log.status] || { label: log.status, color: 'bg-slate-500/20 text-slate-400' }
            return (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${logStatus.color}`}>
                      {logStatus.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {log.changed_by && (
                    <p className="text-xs text-slate-500">{log.changed_by}</p>
                  )}
                  {log.notes && (
                    <p className="text-xs text-slate-400 mt-0.5">{log.notes}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Failure Reason Modal */}
      {showFailModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold text-lg mb-4">Амжилтгүй болсон шалтгаан</h3>
            <textarea
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              placeholder="Шалтгаанаа оруулна уу..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowFailModal(false); setFailureReason('') }}
                className="flex-1 py-2.5 px-4 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
              >
                Буцах
              </button>
              <button
                onClick={handleFailSubmit}
                disabled={!failureReason.trim() || actionLoading}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {actionLoading ? 'Илгээж байна...' : 'Илгээх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
