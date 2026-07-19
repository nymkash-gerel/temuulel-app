'use client'

import { useEffect, useState } from 'react'

interface TrackingData {
  delivery_number: string
  status: string
  estimated_delivery_time: string | null
  actual_delivery_time: string | null
  scheduled_date: string | null
  scheduled_time_slot: string | null
  created_at: string
  updated_at: string
  driver: { name: string; vehicle_type: string } | null
  status_log: { status: string; notes: string | null; created_at: string }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; step: number }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'text-yellow-400', icon: '⏳', step: 1 },
  assigned: { label: 'Жолооч оноогдсон', color: 'text-blue-400', icon: '👤', step: 2 },
  picked_up: { label: 'Авсан', color: 'text-indigo-400', icon: '📦', step: 3 },
  in_transit: { label: 'Зам дээр', color: 'text-purple-400', icon: '🚚', step: 4 },
  delivered: { label: 'Хүргэсэн', color: 'text-green-400', icon: '✅', step: 5 },
  failed: { label: 'Амжилтгүй', color: 'text-red-400', icon: '❌', step: -1 },
  cancelled: { label: 'Цуцлагдсан', color: 'text-slate-400', icon: '🚫', step: -1 },
  delayed: { label: 'Хоцорсон', color: 'text-orange-400', icon: '⚠️', step: 4 },
}

const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: '🏍️ Мотоцикл',
  car: '🚗 Машин',
  bicycle: '🚲 Дугуй',
  on_foot: '🚶 Явган',
}

const STEPS = [
  { key: 'pending', label: 'Хүлээгдэж буй' },
  { key: 'assigned', label: 'Жолооч оноогдсон' },
  { key: 'picked_up', label: 'Авсан' },
  { key: 'in_transit', label: 'Зам дээр' },
  { key: 'delivered', label: 'Хүргэсэн' },
]

export default function TrackingClient({ deliveryNumber }: { deliveryNumber: string }) {
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Rating state
  const [ratingValue, setRatingValue] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingName, setRatingName] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [existingRating, setExistingRating] = useState<{ rating: number; comment?: string; customer_name?: string } | null>(null)

  useEffect(() => {
    async function fetch_data() {
      try {
        const res = await fetch(`/api/track/${deliveryNumber}`)
        if (res.ok) {
          setData(await res.json())
        } else {
          const err = await res.json()
          setError(err.error || 'Олдсонгүй')
        }
      } catch {
        setError('Алдаа гарлаа')
      } finally {
        setLoading(false)
      }
    }
    fetch_data()

    // Poll every 30 seconds for live updates
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/track/${deliveryNumber}`)
        if (res.ok) {
          setData(await res.json())
        }
      } catch {
        // Ignore polling errors
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [deliveryNumber])

  // Check for existing rating
  useEffect(() => {
    if (!data || data.status !== 'delivered') return
    fetch(`/api/track/${deliveryNumber}/rate`)
      .then(r => r.json())
      .then(d => {
        if (d.rated && d.rating) {
          setExistingRating(d.rating)
          setRatingSubmitted(true)
        }
      })
      .catch(() => {})
  }, [data, deliveryNumber])

  const handleRatingSubmit = async () => {
    if (ratingValue === 0) return
    setRatingSubmitting(true)
    try {
      const res = await fetch(`/api/track/${deliveryNumber}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: ratingValue,
          comment: ratingComment || undefined,
          customer_name: ratingName || undefined,
        }),
      })
      if (res.ok) {
        setRatingSubmitted(true)
        setExistingRating({ rating: ratingValue, comment: ratingComment, customer_name: ratingName })
      }
    } catch {
      // Silently fail
    } finally {
      setRatingSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <span className="text-5xl block mb-4">🔍</span>
        <h2 className="text-xl font-bold text-white mb-2">Хүргэлт олдсонгүй</h2>
        <p className="text-slate-400">
          &quot;{deliveryNumber}&quot; дугаартай хүргэлт олдсонгүй. Дугаараа шалгана уу.
        </p>
      </div>
    )
  }

  const currentStatus = STATUS_CONFIG[data.status] || STATUS_CONFIG.pending
  const currentStep = currentStatus.step

  return (
    <div className="space-y-6">
      {/* Delivery Number + Status */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-center">
        <p className="text-slate-400 text-sm mb-1">Хүргэлтийн дугаар</p>
        <h2 className="text-2xl font-bold text-white mb-3">#{data.delivery_number}</h2>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 ${currentStatus.color}`}>
          <span className="text-lg">{currentStatus.icon}</span>
          <span className="font-medium">{currentStatus.label}</span>
        </div>
      </div>

      {/* Progress Steps */}
      {currentStep > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const stepNum = i + 1
              const isCompleted = currentStep > stepNum
              const isCurrent = currentStep === stepNum
              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-blue-500 text-white animate-pulse' :
                    'bg-slate-700 text-slate-500'
                  }`}>
                    {isCompleted ? '✓' : stepNum}
                  </div>
                  <p className={`text-xs text-center ${
                    isCompleted || isCurrent ? 'text-white' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </p>
                  {i < STEPS.length - 1 && (
                    <div className={`absolute h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-slate-700'}`}
                      style={{ display: 'none' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
        {/* Address and recipient name are intentionally not shown here: this page is
            public and keyed by a guessable delivery number, so exposing them would
            allow PII harvesting. Full details live in the owner dashboard. */}
        {data.driver && (
          <div>
            <p className="text-slate-400 text-sm">Жолооч</p>
            <p className="text-white mt-0.5">
              {data.driver.name} — {VEHICLE_LABELS[data.driver.vehicle_type] || data.driver.vehicle_type}
            </p>
          </div>
        )}

        {data.scheduled_date && data.scheduled_time_slot && (
          <div>
            <p className="text-slate-400 text-sm">Товлосон хүргэлт</p>
            <p className="text-white mt-0.5">
              {new Date(data.scheduled_date + 'T00:00:00').toLocaleDateString('mn-MN')} — {data.scheduled_time_slot}
            </p>
          </div>
        )}

        {data.estimated_delivery_time && (
          <div>
            <p className="text-slate-400 text-sm">Хүргэх хугацаа</p>
            <p className="text-white mt-0.5">
              {new Date(data.estimated_delivery_time).toLocaleString('mn-MN')}
            </p>
          </div>
        )}

        {data.actual_delivery_time && (
          <div>
            <p className="text-slate-400 text-sm">Хүргэсэн цаг</p>
            <p className="text-green-400 mt-0.5">
              {new Date(data.actual_delivery_time).toLocaleString('mn-MN')}
            </p>
          </div>
        )}
      </div>

      {/* Status Timeline */}
      {data.status_log.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Явц</h3>
          <div className="space-y-4">
            {data.status_log.map((log, i) => {
              const logStatus = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${logStatus.color} bg-slate-700/50`}>
                      {logStatus.icon}
                    </div>
                    {i < data.status_log.length - 1 && (
                      <div className="w-px h-full bg-slate-700 mt-1" />
                    )}
                  </div>
                  <div className="pb-3">
                    <p className="text-white text-sm font-medium">{logStatus.label}</p>
                    {log.notes && (
                      <p className="text-slate-400 text-xs mt-0.5">{log.notes}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-0.5">
                      {new Date(log.created_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Driver Rating */}
      {data.status === 'delivered' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          {ratingSubmitted ? (
            <div className="text-center">
              <span className="text-4xl block mb-2">🎉</span>
              <h3 className="text-white font-semibold mb-1">Баярлалаа!</h3>
              <p className="text-slate-400 text-sm">Үнэлгээ амжилттай бүртгэгдлээ</p>
              {existingRating && (
                <div className="mt-3 flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={`text-xl ${star <= existingRating.rating ? 'text-yellow-400' : 'text-slate-600'}`}>
                      ★
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-white font-semibold mb-3 text-center">Жолоочид үнэлгээ өгөх</h3>

              {/* Stars */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingValue(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className={`text-3xl transition-transform hover:scale-110 ${
                      star <= (hoverRating || ratingValue) ? 'text-yellow-400' : 'text-slate-600'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>

              {/* Name (optional) */}
              <input
                type="text"
                placeholder="Нэр (заавал биш)"
                value={ratingName}
                onChange={e => setRatingName(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 mb-3 focus:outline-none focus:border-blue-500"
              />

              {/* Comment (optional) */}
              <textarea
                placeholder="Сэтгэгдэл (заавал биш)"
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                rows={2}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 mb-3 resize-none focus:outline-none focus:border-blue-500"
              />

              <button
                onClick={handleRatingSubmit}
                disabled={ratingValue === 0 || ratingSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {ratingSubmitting ? 'Илгээж байна...' : 'Үнэлгээ илгээх'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-slate-500 text-xs">
        Хүргэлтийн мэдээлэл 30 секунд тутам шинэчлэгдэнэ
      </p>
    </div>
  )
}
