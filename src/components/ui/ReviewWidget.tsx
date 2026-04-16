'use client'

import { useState } from 'react'

interface ReviewWidgetProps {
  storeId: string
  orderId?: string
  productId?: string
  customerId?: string
  onSubmit?: () => void
}

export default function ReviewWidget({ storeId, orderId, productId, customerId, onSubmit }: ReviewWidgetProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!rating) return
    setLoading(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, order_id: orderId, product_id: productId, customer_id: customerId, rating, comment }),
      })
      if (res.ok) {
        setSubmitted(true)
        onSubmit?.()
      }
    } catch { /* */ }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
        <div className="text-4xl mb-2">🙏</div>
        <p className="text-emerald-400 font-medium">Үнэлгээ өгсөнд баярлалаа!</p>
      </div>
    )
  }

  return (
    <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
      <h3 className="text-lg font-semibold text-white mb-2">⭐ Бидэнд үнэлгээ өгнө үү</h3>
      <p className="text-sm text-slate-400 mb-4">Таны үнэлгээ бусад хэрэглэгчдэд туслана</p>

      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className={`text-3xl transition-all ${(hover || rating) >= n ? 'text-yellow-400' : 'text-slate-600'}`}
            aria-label={`${n} star`}
          >
            ★
          </button>
        ))}
        {rating > 0 && <span className="ml-3 self-center text-sm text-slate-400">{rating}/5</span>}
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Та сэтгэгдлээ бичнэ үү (заавал биш)..."
        rows={3}
        className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none mb-3"
      />

      <button
        onClick={submit}
        disabled={!rating || loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50"
      >
        {loading ? 'Илгээж байна...' : 'Илгээх'}
      </button>
    </div>
  )
}
