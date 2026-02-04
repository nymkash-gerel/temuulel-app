'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LaundryItem {
  id: string
  item_type: string
  service_type: string
  quantity: number
  unit_price: string
  notes: string
}

interface Customer {
  id: string
  name: string | null
}

const SERVICE_TYPES: Record<string, string> = {
  wash_fold: 'Угаах & хатаах',
  dry_clean: 'Хуурай цэвэрлэгээ',
  press_only: 'Индүүдэх',
  stain_removal: 'Толбо арилгах',
  alterations: 'Засвар',
}

const ITEM_TYPES = ['Цамц', 'Өмд', 'Даашинз', 'Хөнжил', 'Бусад']

function generateOrderNumber(): string {
  return `LO-${Date.now()}`
}

export default function NewLaundryOrderPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])

  // Form fields
  const [orderNumber, setOrderNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [rushOrder, setRushOrder] = useState(false)
  const [pickupDate, setPickupDate] = useState('')
  const [notes, setNotes] = useState('')

  // Items
  const [items, setItems] = useState<LaundryItem[]>([
    {
      id: crypto.randomUUID(),
      item_type: '',
      service_type: '',
      quantity: 1,
      unit_price: '',
      notes: '',
    },
  ])

  useEffect(() => {
    setOrderNumber(generateOrderNumber())

    const fetchCustomers = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) return

      const { data } = await supabase
        .from('customers')
        .select('id, name')
        .eq('store_id', store.id)
        .order('name')

      if (data) setCustomers(data)
    }

    fetchCustomers()
  }, [supabase])

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        item_type: '',
        service_type: '',
        quantity: 1,
        unit_price: '',
        notes: '',
      },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof LaundryItem, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        order_number: orderNumber,
        customer_id: customerId || undefined,
        rush_order: rushOrder,
        pickup_date: pickupDate || undefined,
        notes: notes || undefined,
        items: items.map((item) => ({
          item_type: item.item_type,
          service_type: item.service_type || undefined,
          quantity: item.quantity || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          notes: item.notes || undefined,
        })),
      }

      const res = await fetch('/api/laundry-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Захиалга үүсгэхэд алдаа гарлаа')
      }

      router.push('/dashboard/laundry')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Захиалга үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/laundry"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ угаалгын захиалга</h1>
          <p className="text-slate-400 mt-1">Угаалгын захиалга үүсгэх</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Захиалгын мэдээлэл</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Захиалгын дугаар *
                    </label>
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Хэрэглэгч
                    </label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Сонгоно уу</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Авах огноо
                  </label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Тэмдэглэл
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Нэмэлт тэмдэглэл..."
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Бараанууд</h2>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-all"
                >
                  + Бараа нэмэх
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="p-4 bg-slate-700/30 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-400">
                        Бараа {index + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-400 hover:text-red-300 text-sm transition-all"
                        >
                          Устгах
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Барааны төрөл *
                        </label>
                        <select
                          value={item.item_type}
                          onChange={(e) => updateItem(item.id, 'item_type', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Сонгоно уу</option>
                          {ITEM_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Үйлчилгээний төрөл
                        </label>
                        <select
                          value={item.service_type}
                          onChange={(e) => updateItem(item.id, 'service_type', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Сонгоно уу</option>
                          {Object.entries(SERVICE_TYPES).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Тоо
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          min={1}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Нэгж үнэ (₮) *
                        </label>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                          placeholder="0"
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Тэмдэглэл
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                        placeholder="Нэмэлт тэмдэглэл..."
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <span>+</span>
                  <span>Бараа нэмэх</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Rush Order */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Нэмэлт тохиргоо</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rushOrder}
                  onChange={(e) => setRushOrder(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-white">Яаралтай захиалга</span>
              </label>
              <p className="text-xs text-slate-400 mt-2 ml-8">
                Яаралтай захиалга нь тэргүүлэх ач холбогдолтой боловсруулагдана
              </p>
            </div>

            {/* Order Summary */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Захиалгын хураангуй</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Нийт бараа</span>
                  <span className="text-white">
                    {items.reduce((sum, item) => sum + (item.quantity || 1), 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Нийт дүн</span>
                  <span className="text-white font-medium">
                    {new Intl.NumberFormat('mn-MN').format(
                      items.reduce(
                        (sum, item) => sum + (parseFloat(item.unit_price) || 0) * (item.quantity || 1),
                        0
                      )
                    )}
                    ₮
                  </span>
                </div>
                {rushOrder && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-xs text-yellow-400">Яаралтай захиалга</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Хадгалж байна...</span>
                ) : (
                  <span>Захиалга үүсгэх</span>
                )}
              </button>
              <Link
                href="/dashboard/laundry"
                className="block w-full py-3 text-center bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
