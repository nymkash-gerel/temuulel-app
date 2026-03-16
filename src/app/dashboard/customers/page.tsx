'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { exportToFile } from '@/lib/export-utils'
import { resolveStoreId } from '@/lib/resolve-store'

interface Customer {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  messenger_id: string | null
  instagram_id: string | null
  whatsapp_id: string | null
  channel: string
  created_at: string
  orders: { id: string; total_amount: number; status: string }[] | null
}

export default function CustomersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const storeId = await resolveStoreId(supabase, user.id)
      const store = storeId ? { id: storeId } : null

      if (store) {
        const { data } = await supabase
          .from('customers')
          .select(`
            id, name, phone, email, messenger_id, instagram_id, whatsapp_id, channel, created_at,
            orders(id, total_amount, status)
          `)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })

        if (data) {
          setCustomers(data as unknown as Customer[])
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filteredCustomers = useMemo(() => {
    let result = customers

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    }

    if (channelFilter) {
      result = result.filter(c => {
        if (channelFilter === 'messenger') return !!c.messenger_id
        if (channelFilter === 'instagram') return !!c.instagram_id
        if (channelFilter === 'whatsapp') return !!c.whatsapp_id
        if (channelFilter === 'web') return !c.messenger_id && !c.instagram_id && !c.whatsapp_id
        return true
      })
    }

    return result
  }, [customers, search, channelFilter])

  function getChannel(c: Customer): string {
    if (c.messenger_id) return 'Messenger'
    if (c.instagram_id) return 'Instagram'
    if (c.whatsapp_id) return 'WhatsApp'
    return 'Вэб'
  }

  function getChannelStyle(c: Customer): string {
    if (c.messenger_id) return 'bg-blue-500/20 text-blue-400'
    if (c.instagram_id) return 'bg-pink-500/20 text-pink-400'
    if (c.whatsapp_id) return 'bg-green-500/20 text-green-400'
    return 'bg-slate-500/20 text-slate-400'
  }

  function getChannelIcon(c: Customer): string {
    if (c.messenger_id) return '💬'
    if (c.instagram_id) return '📷'
    if (c.whatsapp_id) return '📱'
    return '🌐'
  }

  function getCustomerStats(c: Customer) {
    const orders = c.orders || []
    const activeOrders = orders.filter(o => o.status !== 'cancelled')
    return {
      orderCount: activeOrders.length,
      totalSpent: activeOrders.reduce((s, o) => s + Number(o.total_amount), 0),
    }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filteredCustomers.map(c => {
      const stats = getCustomerStats(c)
      return {
        'Нэр': c.name || '',
        'Утас': c.phone || '',
        'Имэйл': c.email || '',
        'Суваг': getChannel(c),
        'Захиалга тоо': stats.orderCount,
        'Нийт зарцуулсан': stats.totalSpent,
        'Бүртгүүлсэн': new Date(c.created_at).toLocaleDateString('mn-MN'),
      }
    })

    exportToFile(data, `харилцагч_${new Date().toISOString().slice(0, 10)}`, format, 'Харилцагч')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Харилцагч</h1>
          <p className="text-slate-400 mt-1">
            Нийт {customers.length} харилцагч
            {filteredCustomers.length !== customers.length && ` (${filteredCustomers.length} илэрц)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customers.length > 0 && (
            <>
              <button
                onClick={() => handleExport('xlsx')}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm"
              >
                <span>📥</span>
                <span>Excel</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm"
              >
                <span>📄</span>
                <span>CSV</span>
              </button>
            </>
          )}
          <Link
            href="/dashboard/customers/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all text-sm"
          >
            <span>+</span> Харилцагч нэмэх
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт харилцагч</p>
          <p className="text-2xl font-bold text-white mt-1">{customers.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Энэ сар шинэ</p>
          <p className="text-2xl font-bold text-white mt-1">
            {customers.filter(c => {
              const d = new Date(c.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Идэвхтэй (захиалгатай)</p>
          <p className="text-2xl font-bold text-white mt-1">
            {customers.filter(c => c.orders && c.orders.length > 0).length}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Messenger холбоотой</p>
          <p className="text-2xl font-bold text-white mt-1">
            {customers.filter(c => c.messenger_id).length}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Нэр, утас, имэйл хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх суваг</option>
              <option value="messenger">Messenger</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="web">Вэб</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      {filteredCustomers.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Холбоо барих</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Суваг</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалга</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нийт зарцуулсан</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Бүртгүүлсэн</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const stats = getCustomerStats(customer)
                return (
                  <tr key={customer.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {customer.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <span className="text-white font-medium">{customer.name || 'Нэргүй'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        {customer.phone && <p className="text-white">{customer.phone}</p>}
                        {customer.email && <p className="text-slate-400 text-sm">{customer.email}</p>}
                        {!customer.phone && !customer.email && <p className="text-slate-500">-</p>}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getChannelStyle(customer)}`}>
                        {getChannelIcon(customer)} {getChannel(customer)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">{stats.orderCount}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{stats.totalSpent.toLocaleString()}₮</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(customer.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                        >
                          👁️
                        </Link>
                        <Link
                          href={`/dashboard/chat?customer=${customer.id}`}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-all"
                        >
                          💬
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : customers.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох харилцагч олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setChannelFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">👥</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Харилцагч байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Messenger холбосны дараа chatbot-той ярьсан хэрэглэгчид энд харагдана
          </p>
          <Link
            href="/dashboard/settings/integrations"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all"
          >
            <span>💬</span>
            <span>Messenger холбох</span>
          </Link>
        </div>
      )}
    </div>
  )
}
