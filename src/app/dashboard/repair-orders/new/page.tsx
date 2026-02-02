'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  name: string | null
  phone: string | null
}

interface Staff {
  id: string
  name: string
}

export default function NewRepairOrderPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState<string>('')

  // Dropdown data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])

  // Form fields
  const [orderNumber, setOrderNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [deviceType, setDeviceType] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [priority, setPriority] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [estimatedCompletion, setEstimatedCompletion] = useState('')
  const [warrantyUntil, setWarrantyUntil] = useState('')
  const [notes, setNotes] = useState('')

  const deviceTypes = [
    { value: 'phone', label: 'Утас' },
    { value: 'tablet', label: 'Таблет' },
    { value: 'laptop', label: 'Зөөврийн компьютер' },
    { value: 'desktop', label: 'Ширээний компьютер' },
    { value: 'tv', label: 'ТВ' },
    { value: 'appliance', label: 'Гэр ахуйн хэрэгсэл' },
    { value: 'vehicle', label: 'Тээврийн хэрэгсэл' },
    { value: 'jewelry', label: 'Үнэт эдлэл' },
    { value: 'watch', label: 'Цаг' },
    { value: 'other', label: 'Бусад' },
  ]

  const priorities = [
    { value: 'low', label: 'Бага' },
    { value: 'medium', label: 'Дунд' },
    { value: 'high', label: 'Өндөр' },
    { value: 'urgent', label: 'Яаралтай' },
  ]

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

      // Generate order number
      setOrderNumber(`RO-${Date.now()}`)

      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('store_id', store.id)
        .order('name')

      if (customersData) setCustomers(customersData)

      // Fetch staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name')
        .eq('store_id', store.id)
        .order('name')

      if (staffData) setStaffList(staffData)
    }

    initialize()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return

    setLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        store_id: storeId,
        order_number: orderNumber,
        issue_description: issueDescription,
      }

      if (customerId) body.customer_id = customerId
      if (assignedTo) body.assigned_to = assignedTo
      if (deviceType) body.device_type = deviceType
      if (brand) body.brand = brand
      if (model) body.model = model
      if (serialNumber) body.serial_number = serialNumber
      if (diagnosis) body.diagnosis = diagnosis
      if (priority) body.priority = priority
      if (estimatedCost) body.estimated_cost = parseFloat(estimatedCost)
      if (depositAmount) body.deposit_amount = parseFloat(depositAmount)
      if (estimatedCompletion) body.estimated_completion = estimatedCompletion
      if (warrantyUntil) body.warranty_until = warrantyUntil
      if (notes) body.notes = notes

      const res = await fetch('/api/repair-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Засварын захиалга үүсгэхэд алдаа гарлаа')
      }

      router.push('/dashboard/repair-orders')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Засварын захиалга үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/repair-orders"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ засварын захиалга</h1>
          <p className="text-slate-400 mt-1">Шинэ засварын захиалга бүртгэх</p>
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
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Захиалгын дугаар *
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="RO-1234567890"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {customer.name}{customer.phone ? ` (${customer.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Хариуцах ажилтан
                    </label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Сонгоно уу</option>
                      {staffList.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Ачаалал
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Сонгоно уу</option>
                    {priorities.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Device Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Төхөөрөмжийн мэдээлэл</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Төхөөрөмжийн төрөл
                    </label>
                    <select
                      value={deviceType}
                      onChange={(e) => setDeviceType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Сонгоно уу</option>
                      {deviceTypes.map((dt) => (
                        <option key={dt.value} value={dt.value}>
                          {dt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Бренд
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Жишээ: Apple, Samsung"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Загвар
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Жишээ: iPhone 15 Pro"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Серийн дугаар
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Серийн дугаар оруулах"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Issue & Diagnosis */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Асуудал & Оношлогоо</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Асуудлын тайлбар *
                  </label>
                  <textarea
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Төхөөрөмжийн асуудлыг дэлгэрэнгүй бичнэ үү..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Оношлогоо
                  </label>
                  <textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Оношлогооны үр дүн..."
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
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Нэмэлт тэмдэглэл..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cost & Payment */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Зардал & Төлбөр</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Тооцоолсон зардал
                  </label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Урьдчилгаа
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Хугацаа</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Дуусах хугацаа
                  </label>
                  <input
                    type="date"
                    value={estimatedCompletion}
                    onChange={(e) => setEstimatedCompletion(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Баталгаат хугацаа
                  </label>
                  <input
                    type="date"
                    value={warrantyUntil}
                    onChange={(e) => setWarrantyUntil(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || !orderNumber || !issueDescription}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Хадгалж байна...' : 'Засварын захиалга үүсгэх'}
              </button>
              <Link
                href="/dashboard/repair-orders"
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
