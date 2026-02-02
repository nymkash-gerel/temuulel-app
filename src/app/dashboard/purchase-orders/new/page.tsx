'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
}

interface OrderItem {
  id: string
  product_id: string
  variant_id: string
  quantity_ordered: string
  unit_cost: string
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState<string>('')

  // Dropdown data
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Form fields
  const [poNumber, setPoNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')

  // Items
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', product_id: '', variant_id: '', quantity_ordered: '', unit_cost: '' }
  ])

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) return
      setStoreId(store.id)

      // Generate PO number
      setPoNumber(`PO-${Date.now()}`)

      // Fetch suppliers
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('store_id', store.id)
        .order('name')

      if (suppliersData) setSuppliers(suppliersData)

      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name')
        .eq('store_id', store.id)
        .order('name')

      if (productsData) setProducts(productsData)
    }

    initialize()
  }, [])

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), product_id: '', variant_id: '', quantity_ordered: '', unit_cost: '' }
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof OrderItem, value: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const getLineTotal = (item: OrderItem): number => {
    const qty = parseFloat(item.quantity_ordered) || 0
    const cost = parseFloat(item.unit_cost) || 0
    return qty * cost
  }

  const getTotal = (): number => {
    return items.reduce((sum, item) => sum + getLineTotal(item), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return

    setLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        store_id: storeId,
        supplier_id: supplierId,
        po_number: poNumber,
        items: items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity_ordered: parseInt(item.quantity_ordered),
          unit_cost: parseFloat(item.unit_cost),
        })),
      }

      if (expectedDate) body.expected_date = expectedDate
      if (notes) body.notes = notes

      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Худалдан авалтын захиалга үүсгэхэд алдаа гарлаа')
      }

      router.push('/dashboard/purchase-orders')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Худалдан авалтын захиалга үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/purchase-orders"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ худалдан авалтын захиалга</h1>
          <p className="text-slate-400 mt-1">Худалдан авалтын захиалга үүсгэх</p>
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
                      PO дугаар *
                    </label>
                    <input
                      type="text"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="PO-1234567890"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Нийлүүлэгч *
                    </label>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Сонгоно уу</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Хүлээгдэж буй огноо
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
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
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Нэмэлт тэмдэглэл..."
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Бараанууд</h2>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-700/30 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-300">
                        Бараа {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1}
                        className="text-sm text-slate-400 hover:text-red-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Устгах
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Бүтээгдэхүүн *
                        </label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItem(item.id, 'product_id', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Сонгоно уу</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Хувилбар (variant)
                        </label>
                        <input
                          type="text"
                          value={item.variant_id}
                          onChange={(e) => updateItem(item.id, 'variant_id', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Variant ID (заавал биш)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Тоо ширхэг *
                        </label>
                        <input
                          type="number"
                          value={item.quantity_ordered}
                          onChange={(e) => updateItem(item.id, 'quantity_ordered', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          min="1"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Нэгж зардал *
                        </label>
                        <input
                          type="number"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(item.id, 'unit_cost', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Мөрийн дүн
                        </label>
                        <div className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600 rounded-xl text-slate-300">
                          {getLineTotal(item).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  + Бараа нэмэх
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Захиалгын хураангуй</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Барааны тоо</span>
                  <span className="text-white">{items.filter(i => i.product_id).length}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Нийт мөр</span>
                  <span className="text-white">{items.length}</span>
                </div>

                <div className="pt-3 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Нийт дүн</span>
                    <span className="text-xl font-bold text-white">
                      {getTotal().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || !supplierId || !poNumber || items.every(i => !i.product_id)}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Хадгалж байна...' : 'Захиалга үүсгэх'}
              </button>
              <Link
                href="/dashboard/purchase-orders"
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
