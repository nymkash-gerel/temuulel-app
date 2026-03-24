'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const d = await res.json()
        alert(d.error || 'Устгахад алдаа гарлаа')
      }
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-red-400 hidden sm:inline truncate max-w-[80px]">Устгах уу?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="p-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? '...' : '✓'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="p-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-all"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`${productName} устгах`}
      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all"
    >
      🗑️
    </button>
  )
}
