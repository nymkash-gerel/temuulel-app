'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'

interface Customer {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  messenger_id: string | null
  instagram_id: string | null
  whatsapp_id: string | null
  channel: string
  address: string | null
  notes: string | null
  created_at: string
}

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  created_at: string
  order_items: { quantity: number }[]
}

interface Conversation {
  id: string
  status: string
  updated_at: string
  messages: {
    content: string
    is_from_customer: boolean
    is_ai_response: boolean
    created_at: string
  }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  processing: { label: 'Бэлтгэж буй', color: 'bg-purple-500/20 text-purple-400' },
  shipped: { label: 'Илгээсэн', color: 'bg-cyan-500/20 text-cyan-400' },
  delivered: { label: 'Хүргэсэн', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}


export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')

  useEffect(() => {
    async function load() {
      // Load customer
      const { data: cust } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (!cust) {
        router.push('/dashboard/customers')
        return
      }

      setCustomer(cust)
      setNotes(cust.notes || '')
      setEditName(cust.name || '')
      setEditPhone(cust.phone || '')
      setEditEmail(cust.email || '')
      setEditAddress(cust.address || '')

      // Load orders
      const { data: ords } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, order_items(quantity)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      setOrders(ords || [])

      // Load conversations
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, status, updated_at, messages(content, is_from_customer, is_ai_response, created_at)')
        .eq('customer_id', customerId)
        .order('updated_at', { ascending: false })
        .limit(10)

      setConversations(convs || [])

      setLoading(false)
    }
    load()
  }, [customerId, supabase, router])

  async function saveNotes() {
    if (!customer) return
    await supabase
      .from('customers')
      .update({ notes })
      .eq('id', customer.id)
  }

  async function saveCustomerInfo() {
    if (!customer) return
    await supabase
      .from('customers')
      .update({
        name: editName,
        phone: editPhone || null,
        email: editEmail || null,
        address: editAddress || null,
      })
      .eq('id', customer.id)

    setCustomer({
      ...customer,
      name: editName,
      phone: editPhone || null,
      email: editEmail || null,
      address: editAddress || null,
    })
    setEditing(false)
  }

  function getChannelInfo() {
    if (!customer) return { label: 'Вэб', color: 'bg-slate-400', badge: 'bg-slate-500/20 text-slate-400' }
    if (customer.messenger_id) return { label: 'Messenger', color: 'bg-blue-400', badge: 'bg-blue-500/20 text-blue-400' }
    if (customer.instagram_id) return { label: 'Instagram', color: 'bg-pink-400', badge: 'bg-pink-500/20 text-pink-400' }
    if (customer.whatsapp_id) return { label: 'WhatsApp', color: 'bg-green-400', badge: 'bg-green-500/20 text-green-400' }
    return { label: 'Вэб', color: 'bg-slate-400', badge: 'bg-slate-500/20 text-slate-400' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) return null

  const channel = getChannelInfo()
  const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0)
  const orderCount = orders.filter(o => o.status !== 'cancelled').length
  const totalMessages = conversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            ←
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white font-bold">
                {customer.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{customer.name || 'Нэргүй'}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${channel.badge}`}>
                  {channel.label}
                </span>
              </div>
              <p className="text-slate-400 mt-0.5">
                Бүртгүүлсэн: {new Date(customer.created_at).toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
          >
            {editing ? 'Болих' : 'Засах'}
          </button>
          <Link
            href={`/dashboard/chat?customer=${customer.id}`}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all"
          >
            💬 Чат бичих
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт захиалга</p>
          <p className="text-2xl font-bold text-white mt-1">{orderCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт зарцуулсан</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(totalSpent)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Дундаж захиалга</p>
          <p className="text-2xl font-bold text-white mt-1">{orderCount > 0 ? formatPrice(Math.round(totalSpent / orderCount)) : '0₮'}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт мессеж</p>
          <p className="text-2xl font-bold text-white mt-1">{totalMessages}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Orders */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-white font-medium">Захиалгууд</h3>
            </div>
            {orders.length > 0 ? (
              <div className="divide-y divide-slate-700/50">
                {orders.map((order) => {
                  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
                  return (
                    <Link
                      key={order.id}
                      href={`/dashboard/orders/${order.id}`}
                      className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center">
                          <span>🛒</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">#{order.order_number}</p>
                          <p className="text-slate-400 text-xs">
                            {order.order_items?.reduce((s, i) => s + i.quantity, 0) || 0} бүтээгдэхүүн
                            {' '}&middot;{' '}
                            {new Date(order.created_at).toLocaleDateString('mn-MN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-white font-medium">{formatPrice(order.total_amount)}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">Захиалга байхгүй</p>
              </div>
            )}
          </div>

          {/* Conversations */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-white font-medium">Чат түүх</h3>
            </div>
            {conversations.length > 0 ? (
              <div className="divide-y divide-slate-700/50">
                {conversations.map((conv) => {
                  const lastMsg = conv.messages?.[conv.messages.length - 1]
                  return (
                    <Link
                      key={conv.id}
                      href={`/dashboard/chat/${conv.id}`}
                      className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center">
                          <span>💬</span>
                        </div>
                        <div>
                          <p className="text-white text-sm">
                            {lastMsg?.is_ai_response && '🤖 '}
                            {lastMsg?.content?.substring(0, 60) || 'Мессеж байхгүй'}
                            {(lastMsg?.content?.length || 0) > 60 ? '...' : ''}
                          </p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {conv.messages?.length || 0} мессеж &middot; {new Date(conv.updated_at).toLocaleDateString('mn-MN')}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        conv.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {conv.status === 'active' ? 'Идэвхтэй' : 'Хаагдсан'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">Чат түүх байхгүй</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info / Edit */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">
              {editing ? 'Мэдээлэл засах' : 'Холбоо барих'}
            </h3>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Нэр</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Утас</label>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Имэйл</label>
                  <input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Хаяг</label>
                  <textarea
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  />
                </div>
                <button
                  onClick={saveCustomerInfo}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  Хадгалах
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">📱</span>
                    <span className="text-slate-300">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">📧</span>
                    <span className="text-slate-300">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">📍</span>
                    <span className="text-slate-300">{customer.address}</span>
                  </div>
                )}
                {customer.messenger_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">💬</span>
                    <span className="text-slate-300">Messenger холбогдсон</span>
                  </div>
                )}
                {!customer.phone && !customer.email && !customer.address && (
                  <p className="text-slate-500">Мэдээлэл оруулаагүй</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Тэмдэглэл</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={4}
              className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
              placeholder="Харилцагчийн тэмдэглэл..."
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-3">
            <h3 className="text-white font-medium mb-2">Үйлдэл</h3>
            <Link
              href={`/dashboard/chat?customer=${customer.id}`}
              className="block w-full py-2.5 text-center text-sm text-blue-400 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all"
            >
              💬 Мессеж илгээх
            </Link>
            <button
              onClick={async () => {
                if (!confirm('Энэ харилцагчийг устгах уу?')) return
                const { error } = await supabase.from('customers').delete().eq('id', customer.id)
                if (error) {
                  alert('Устгахад алдаа гарлаа: ' + error.message)
                  return
                }
                router.push('/dashboard/customers')
                router.refresh()
              }}
              className="block w-full py-2.5 text-center text-sm text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg transition-all"
            >
              Устгах
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
