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

const serviceTypes = [
  { value: 'cleaning', label: 'Цэвэрлэгээ' },
  { value: 'plumbing', label: 'Сантехник' },
  { value: 'electrical', label: 'Цахилгаан' },
  { value: 'painting', label: 'Будаг' },
  { value: 'carpentry', label: 'Мужааны ажил' },
  { value: 'hvac', label: 'Халаалт/Агаар' },
  { value: 'landscaping', label: 'Тохижилт' },
  { value: 'moving', label: 'Зөөвөрлөлт' },
  { value: 'pest_control', label: 'Хортон устгал' },
  { value: 'general', label: 'Ерөнхий' },
  { value: 'other', label: 'Бусад' },
]

const priorities = [
  { value: 'low', label: 'Бага' },
  { value: 'medium', label: 'Дунд' },
  { value: 'high', label: 'Өндөр' },
  { value: 'urgent', label: 'Яаралтай' },
]

export default function NewServiceRequestPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState<string>('')

  // Dropdown data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])

  // Form fields
  const [requestNumber, setRequestNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [address, setAddress] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationEstimate, setDurationEstimate] = useState('')
  const [priority, setPriority] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [notes, setNotes] = useState('')

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

      // Generate request number
      setRequestNumber(`SR-${Date.now()}`)

      // Fetch customers and staff
      const [customersRes, staffRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, phone')
          .eq('store_id', store.id)
          .order('name'),
        supabase
          .from('staff')
          .select('id, name')
          .eq('store_id', store.id)
          .order('name'),
      ])

      if (customersRes.data) setCustomers(customersRes.data)
      if (staffRes.data) setStaffList(staffRes.data)
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
        request_number: requestNumber,
      }

      if (customerId) body.customer_id = customerId
      if (assignedTo) body.assigned_to = assignedTo
      if (serviceType) body.service_type = serviceType
      if (address) body.address = address
      if (scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString()
      if (durationEstimate) body.duration_estimate = parseInt(durationEstimate)
      if (priority) body.priority = priority
      if (estimatedCost) body.estimated_cost = parseFloat(estimatedCost)
      if (notes) body.notes = notes

      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Үйлчилгээний хүсэлт үүсгэхэд алдаа гарлаа')
      }

      router.push('/dashboard/service-requests')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Үйлчилгээний хүсэлт үүсгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/service-requests"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ үйлчилгээний хүсэлт</h1>
          <p className="text-slate-400 mt-1">Шинэ үйлчилгээний хүсэлт бүртгэх</p>
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
            {/* Request Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Хүсэлтийн мэдээлэл</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Хүсэлтийн дугаар *
                  </label>
                  <input
                    type="text"
                    value={requestNumber}
                    onChange={(e) => setRequestNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="SR-1234567890"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Үйлчилгээний төрөл
                    </label>
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Сонгоно уу</option>
                      {serviceTypes.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
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
            </div>

            {/* Address & Schedule */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Хаяг & Цаг</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Хаяг
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Үйлчилгээний хаяг оруулах..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Товлосон цаг
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Тооцоолсон хугацаа (минут)
                    </label>
                    <input
                      type="number"
                      value={durationEstimate}
                      onChange={(e) => setDurationEstimate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Тэмдэглэл</h2>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Нэмэлт тэмдэглэл..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cost */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Зардал</h2>

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
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || !requestNumber}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Хадгалж байна...' : 'Хүсэлт үүсгэх'}
              </button>
              <Link
                href="/dashboard/service-requests"
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
