'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface StaffMember {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string | null
}

interface RepairOrder {
  id: string
  order_number: string
  device_type: string
  brand: string | null
  model: string | null
  issue_description: string
  status: string
  priority: string
  estimated_cost: number | null
  actual_cost: number | null
  customer_id: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string } | null
}

interface NewRepairForm {
  order_number: string
  device_type: string
  brand: string
  model: string
  issue_description: string
  status: string
  priority: string
  estimated_cost: string
  actual_cost: string
  customer_id: string
  assigned_to: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  received: { label: 'Хүлээн авсан', color: 'bg-blue-500/20 text-blue-400' },
  diagnosing: { label: 'Оношилж байна', color: 'bg-cyan-500/20 text-cyan-400' },
  waiting_parts: { label: 'Сэлбэг хүлээж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  in_repair: { label: 'Засварлаж байна', color: 'bg-orange-500/20 text-orange-400' },
  testing: { label: 'Шалгаж байна', color: 'bg-indigo-500/20 text-indigo-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  delivered: { label: 'Хүлээлгэн өгсөн', color: 'bg-emerald-500/20 text-emerald-400' },
  cancelled: { label: 'Цуцалсан', color: 'bg-red-500/20 text-red-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-gray-500/20 text-gray-400' },
  normal: { label: 'Дунд', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  phone: 'Утас',
  laptop: 'Зөөврийн компьютер',
  desktop: 'Компьютер',
  tablet: 'Таблет',
  tv: 'Телевиз',
  appliance: 'Гэр ахуйн',
  console: 'Тоглоомын консол',
  camera: 'Камер',
  other: 'Бусад',
}

function formatPrice(amount: number | null) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function RepairOrdersPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<RepairOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState<NewRepairForm>({
    order_number: '',
    device_type: 'phone',
    brand: '',
    model: '',
    issue_description: '',
    status: 'received',
    priority: 'normal',
    estimated_cost: '',
    actual_cost: '',
    customer_id: '',
    assigned_to: '',
  })

  const loadOrders = useCallback(async (sid: string) => {
    let query = supabase
      .from('repair_orders')
      .select(`
        id, order_number, device_type, brand, model,
        issue_description, status, priority,
        estimated_cost, actual_cost, customer_id, assigned_to,
        created_at, updated_at,
        customers(id, name),
        staff!repair_orders_assigned_to_fkey(id, name)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    if (deviceTypeFilter) {
      query = query.eq('device_type', deviceTypeFilter)
    }
    if (priorityFilter) {
      query = query.eq('priority', priorityFilter)
    }

    const { data } = await query
    if (data) {
      setOrders(data as unknown as RepairOrder[])
    }
  }, [supabase, statusFilter, deviceTypeFilter, priorityFilter])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)

        const [, customersRes, staffRes] = await Promise.all([
          loadOrders(store.id),
          supabase.from('customers').select('id, name').eq('store_id', store.id).order('name'),
          supabase.from('staff').select('id, name').eq('store_id', store.id).order('name'),
        ])

        if (customersRes.data) setCustomers(customersRes.data)
        if (staffRes.data) setStaffList(staffRes.data)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router, loadOrders])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadOrders(storeId) }
    reload()
  }, [storeId, loading, loadOrders])

  const filtered = useMemo(() => {
    if (!search.trim()) return orders
    const q = search.trim().toLowerCase()
    return orders.filter(o =>
      o.order_number.toLowerCase().includes(q) ||
      o.brand?.toLowerCase().includes(q) ||
      o.model?.toLowerCase().includes(q) ||
      o.issue_description.toLowerCase().includes(q) ||
      o.customers?.name?.toLowerCase().includes(q)
    )
  }, [orders, search])

  const kpis = useMemo(() => {
    const total = orders.length
    const inRepair = orders.filter(o => ['received', 'diagnosed', 'quoted', 'approved', 'in_repair'].includes(o.status)).length
    const completed = orders.filter(o => o.status === 'completed' || o.status === 'delivered').length
    const cancelled = orders.filter(o => o.status === 'cancelled').length
    return [
      { label: 'Нийт захиалга', value: total },
      { label: 'Явагдаж буй', value: inRepair },
      { label: 'Дууссан', value: completed },
      { label: 'Цуцлагдсан', value: cancelled },
    ]
  }, [orders])

  function resetForm() {
    setForm({
      order_number: '',
      device_type: 'phone',
      brand: '',
      model: '',
      issue_description: '',
      status: 'received',
      priority: 'normal',
      estimated_cost: '',
      actual_cost: '',
      customer_id: '',
      assigned_to: '',
    })
    setShowForm(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        store_id: storeId,
        order_number: form.order_number,
        device_type: form.device_type,
        brand: form.brand || null,
        model: form.model || null,
        issue_description: form.issue_description,
        status: form.status,
        priority: form.priority,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
        actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
        customer_id: form.customer_id || null,
        assigned_to: form.assigned_to || null,
      }

      const { error: insertError } = await supabase
        .from('repair_orders')
        .insert(payload)

      if (insertError) throw insertError

      await loadOrders(storeId)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Засварын захиалга</h1>
          <p className="text-gray-400 mt-1">
            Нийт {orders.length} захиалга
            {filtered.length !== orders.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/repair-orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Шинэ захиалга
        </Link>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Дугаар, брэнд, загвар, асуудал, харилцагчаар хайх..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="received">Хүлээн авсан</option>
              <option value="diagnosing">Оношилж байна</option>
              <option value="waiting_parts">Сэлбэг хүлээж буй</option>
              <option value="in_repair">Засварлаж байна</option>
              <option value="testing">Шалгаж байна</option>
              <option value="completed">Дууссан</option>
              <option value="delivered">Хүлээлгэн өгсөн</option>
              <option value="cancelled">Цуцалсан</option>
            </select>
            <select
              value={deviceTypeFilter}
              onChange={(e) => setDeviceTypeFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төхөөрөмж</option>
              <option value="phone">Утас</option>
              <option value="laptop">Зөөврийн компьютер</option>
              <option value="desktop">Компьютер</option>
              <option value="tablet">Таблет</option>
              <option value="tv">Телевиз</option>
              <option value="appliance">Гэр ахуйн</option>
              <option value="console">Тоглоомын консол</option>
              <option value="camera">Камер</option>
              <option value="other">Бусад</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх зэрэглэл</option>
              <option value="low">Бага</option>
              <option value="normal">Дунд</option>
              <option value="high">Өндөр</option>
              <option value="urgent">Яаралтай</option>
            </select>
          </div>
        </div>
        {(statusFilter || deviceTypeFilter || priorityFilter || search) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => { setStatusFilter(''); setDeviceTypeFilter(''); setPriorityFilter(''); setSearch('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Шинэ засварын захиалга</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Захиалгын дугаар *</label>
                  <input
                    type="text"
                    value={form.order_number}
                    onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                    placeholder="REP-001"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Төхөөрөмжийн төрөл *</label>
                  <select
                    value={form.device_type}
                    onChange={(e) => setForm({ ...form, device_type: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                    required
                  >
                    <option value="phone">Утас</option>
                    <option value="laptop">Зөөврийн компьютер</option>
                    <option value="desktop">Компьютер</option>
                    <option value="tablet">Таблет</option>
                    <option value="tv">Телевиз</option>
                    <option value="appliance">Гэр ахуйн</option>
                    <option value="console">Тоглоомын консол</option>
                    <option value="camera">Камер</option>
                    <option value="other">Бусад</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Брэнд</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Жишээ: Samsung"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Загвар</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="Жишээ: Galaxy S24"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Асуудлын тайлбар *</label>
                <textarea
                  value={form.issue_description}
                  onChange={(e) => setForm({ ...form, issue_description: e.target.value })}
                  placeholder="Асуудлыг дэлгэрэнгүй тайлбарлана уу"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Төлөв</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="received">Хүлээн авсан</option>
                    <option value="diagnosing">Оношилж байна</option>
                    <option value="waiting_parts">Сэлбэг хүлээж буй</option>
                    <option value="in_repair">Засварлаж байна</option>
                    <option value="testing">Шалгаж байна</option>
                    <option value="completed">Дууссан</option>
                    <option value="delivered">Хүлээлгэн өгсөн</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Зэрэглэл</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="low">Бага</option>
                    <option value="normal">Дунд</option>
                    <option value="high">Өндөр</option>
                    <option value="urgent">Яаралтай</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Урьдчилсан зардал</label>
                  <input
                    type="number"
                    value={form.estimated_cost}
                    onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Бодит зардал</label>
                  <input
                    type="number"
                    value={form.actual_cost}
                    onChange={(e) => setForm({ ...form, actual_cost: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Харилцагч</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">-- Сонгох --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name || 'N/A'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Хариуцах ажилтан</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">-- Сонгох --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
                >
                  {saving ? 'Хадгалж байна...' : 'Бүртгэх'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Дугаар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төхөөрөмж</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Асуудал</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Зэрэглэл</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Хариуцагч</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Зардал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-gray-400">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const sc = STATUS_CONFIG[order.status] || { label: order.status, color: 'bg-gray-500/20 text-gray-400' }
                const pc = PRIORITY_CONFIG[order.priority] || { label: order.priority, color: 'bg-gray-500/20 text-gray-400' }
                return (
                  <tr key={order.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-blue-400 font-mono text-sm">#{order.order_number}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white text-sm font-medium">
                          {DEVICE_TYPE_LABELS[order.device_type] || order.device_type}
                        </p>
                        {(order.brand || order.model) && (
                          <p className="text-gray-400 text-xs mt-0.5">
                            {[order.brand, order.model].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-300 text-sm">{order.customers?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-gray-300 text-sm truncate max-w-[200px]" title={order.issue_description}>
                        {order.issue_description}
                      </p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${pc.color}`}>
                        {pc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-300 text-sm">{order.staff?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div>
                        <p className="text-white text-sm">{formatPrice(order.actual_cost)}</p>
                        {order.estimated_cost != null && order.actual_cost == null && (
                          <p className="text-gray-500 text-xs mt-0.5">
                            Урьдч: {formatPrice(order.estimated_cost)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-gray-400 text-sm">
                        {new Date(order.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : orders.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-400">Хайлтад тохирох захиалга олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setDeviceTypeFilter(''); setPriorityFilter('') }}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128295;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Засварын захиалга байхгүй</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Засварын захиалгуудаа бүртгэж эхэлнэ үү
          </p>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Эхний захиалга бүртгэх
          </button>
        </div>
      )}
    </div>
  )
}
