'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  name: string | null
}

export default function NewGuestPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storeId, setStoreId] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [nationality, setNationality] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [vipLevel, setVipLevel] = useState('regular')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .single()
        if (store) {
          setStoreId(store.id)
          const { data } = await supabase
            .from('customers')
            .select('id, name')
            .eq('store_id', store.id)
            .order('name')
          if (data) setCustomers(data)
        }
      }
    }
    init()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          customer_id: customerId || undefined,
          document_type: documentType || undefined,
          document_number: documentNumber || undefined,
          nationality: nationality || undefined,
          phone: phone || undefined,
          email: email || undefined,
          vip_level: vipLevel || undefined,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Алдаа гарлаа')
      }
      router.push('/dashboard/guests')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Зочин бүртгэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/guests" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Шинэ зочин</h1>
          <p className="text-slate-400 mt-1">Зочны мэдээлэл бүртгэх</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Хувийн мэдээлэл</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Овог *</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Овог" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Нэр *</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Нэр" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Харилцагч</label>
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Сонгоно уу (заавал биш)</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name || 'Нэргүй'}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Утасны дугаар</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="99001122" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Имэйл</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Бичиг баримт</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Бичиг баримтын төрөл</label>
                    <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Сонгоно уу</option>
                      <option value="passport">Паспорт</option>
                      <option value="national_id">Иргэний үнэмлэх</option>
                      <option value="driving_license">Жолооны үнэмлэх</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Бичиг баримтын дугаар</label>
                    <input type="text" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="AA12345678" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Иргэншил</label>
                  <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Монгол" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">VIP & Тэмдэглэл</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">VIP түвшин</label>
                  <select value={vipLevel} onChange={(e) => setVipLevel(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="regular">Энгийн</option>
                    <option value="silver">Мөнгө</option>
                    <option value="gold">Алт</option>
                    <option value="platinum">Платинум</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Тэмдэглэл</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Нэмэлт мэдээлэл..." />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading || !firstName || !lastName}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all">
              {loading ? 'Хадгалж байна...' : 'Зочин бүртгэх'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
