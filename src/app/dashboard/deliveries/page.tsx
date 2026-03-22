'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { exportToFile } from '@/lib/export-utils'
import BatchDispatchModal from '@/components/BatchDispatchModal'
import type { BatchPreview } from '@/app/api/deliveries/batch-assign/route'

interface OrderItem {
  quantity: number
  products: { name: string } | null
}

interface Delivery {
  id: string
  delivery_number: string
  status: 'pending' | 'assigned' | 'at_store' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled' | 'delayed' | 'intercity_post'
  delivery_type: 'own_driver' | 'external_provider' | 'intercity_post'
  provider_name: string | null
  delivery_address: string
  customer_name: string | null
  customer_phone: string | null
  estimated_delivery_time: string | null
  actual_delivery_time: string | null
  delivery_fee: number | null
  failure_reason: string | null
  notes: string | null
  metadata: { proof_photo_file_id?: string; proof_photo_at?: string; [key: string]: unknown } | null
  ai_assignment: { recommended_driver_id?: string; confidence?: number; ranked_drivers?: { driver_id: string; score: number; reasons: string[] }[] } | null
  denial_info: { driver_id?: string; driver_name: string; reason: string; reason_label: string; denied_at: string } | null
  created_at: string
  orders: { id: string; order_number: string; total_amount: number; payment_status: string | null; order_items: OrderItem[] } | null
  delivery_drivers: { id: string; name: string; phone: string; vehicle_type: string } | null
}

interface Driver {
  id: string
  name: string
  phone: string
  status: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' },
  assigned: { label: 'Оноосон', color: 'bg-blue-500/20 text-blue-400', icon: '👤' },
  at_store: { label: 'Дэлгүүрт', color: 'bg-cyan-500/20 text-cyan-400', icon: '🏪' },
  picked_up: { label: 'Авсан', color: 'bg-indigo-500/20 text-indigo-400', icon: '📦' },
  in_transit: { label: 'Зам дээр', color: 'bg-purple-500/20 text-purple-400', icon: '🚚' },
  delivered: { label: 'Хүргэсэн', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  failed: { label: 'Амжилтгүй', color: 'bg-red-500/20 text-red-400', icon: '❌' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-slate-500/20 text-slate-400', icon: '🚫' },
  delayed: { label: 'Хоцорсон', color: 'bg-orange-500/20 text-orange-400', icon: '⚠️' },
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function DeliveriesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [, setStoreId] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formAddress, setFormAddress] = useState('')
  const [formCustomerName, setFormCustomerName] = useState('')
  const [formCustomerPhone, setFormCustomerPhone] = useState('')
  const [formDriverId, setFormDriverId] = useState('')
  const [formDeliveryType, setFormDeliveryType] = useState('own_driver')
  const [formDeliveryFee, setFormDeliveryFee] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [batchPreview, setBatchPreview] = useState<BatchPreview | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchConfirming, setBatchConfirming] = useState(false)
  const [bulkConfirming, setBulkConfirming] = useState<string | null>(null) // driver_id being bulk-confirmed

  // Multi-select for bulk assign / unassign
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDriverId, setBulkDriverId] = useState('')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [reassigningId, setReassigningId] = useState<string | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)))
    }
  }
  function clearSelection() { setSelectedIds(new Set()) }

  async function handleBulkAssign() {
    if (!bulkDriverId || selectedIds.size === 0) return
    setBulkActionLoading(true)
    const ids = [...selectedIds]
    await Promise.all(ids.map(id =>
      fetch(`/api/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: bulkDriverId }),
      })
    ))
    const driverObj = drivers.find(d => d.id === bulkDriverId)
    setDeliveries(prev => prev.map(d =>
      selectedIds.has(d.id)
        ? { ...d, status: 'assigned' as const, delivery_drivers: driverObj ? { id: driverObj.id, name: driverObj.name, phone: driverObj.phone, vehicle_type: driverObj.status } : d.delivery_drivers }
        : d
    ))
    clearSelection()
    setBulkActionLoading(false)
  }

  async function handleBulkUnassign() {
    if (selectedIds.size === 0) return
    setBulkActionLoading(true)
    const ids = [...selectedIds]
    await Promise.all(ids.map(id =>
      fetch(`/api/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: null, status: 'pending' }),
      })
    ))
    setDeliveries(prev => prev.map(d =>
      selectedIds.has(d.id) ? { ...d, status: 'pending' as const, delivery_drivers: null } : d
    ))
    clearSelection()
    setBulkActionLoading(false)
  }

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

        const [deliveriesRes, driversRes] = await Promise.all([
          supabase
            .from('deliveries')
            .select(`
              id, delivery_number, status, delivery_type, provider_name,
              delivery_address, customer_name, customer_phone,
              estimated_delivery_time, actual_delivery_time,
              delivery_fee, failure_reason, notes, metadata, ai_assignment, denial_info, created_at,
              orders(id, order_number, total_amount, payment_status, order_items(quantity, products(name))),
              delivery_drivers(id, name, phone, vehicle_type)
            `)
            .eq('store_id', store.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('delivery_drivers')
            .select('id, name, phone, status')
            .eq('store_id', store.id)
            .in('status', ['active', 'on_delivery'])
            .order('name'),
        ])

        if (deliveriesRes.data) setDeliveries(deliveriesRes.data as unknown as Delivery[])
        if (driversRes.data) setDrivers(driversRes.data as Driver[])
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = deliveries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(d =>
        d.delivery_number.toLowerCase().includes(q) ||
        d.customer_name?.toLowerCase().includes(q) ||
        d.customer_phone?.includes(q) ||
        d.orders?.order_number?.toLowerCase().includes(q) ||
        d.delivery_drivers?.name?.toLowerCase().includes(q)
      )
    }
    // Tab-based group filtering
    if (statusFilter === 'needs_action') {
      const now = new Date()
      result = result.filter(d =>
        ['pending', 'at_store'].includes(d.status) ||
        // Include delayed deliveries whose estimated time has passed
        (d.status === 'delayed' && d.estimated_delivery_time && new Date(d.estimated_delivery_time) <= now)
      )
      // at_store first, then delayed (overdue), then pending
      const order: Record<string, number> = { at_store: 0, delayed: 1, pending: 2 }
      result = [...result].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
    } else if (statusFilter === 'active') {
      result = result.filter(d => ['assigned', 'picked_up', 'in_transit', 'delayed'].includes(d.status))
    } else if (statusFilter === 'done') {
      result = result.filter(d => ['delivered', 'cancelled', 'failed'].includes(d.status))
    } else if (statusFilter === 'denied') {
      // Filter for deliveries that were denied by a driver — pending with denial_info
      result = result.filter(d => d.denial_info !== null && d.status === 'pending')
    } else if (statusFilter) {
      result = result.filter(d => d.status === statusFilter)
    }
    return result
  }, [deliveries, search, statusFilter])

  // Active counts
  const activeCount = deliveries.filter(d => ['assigned', 'at_store', 'picked_up', 'in_transit'].includes(d.status)).length
  const atStoreCount = deliveries.filter(d => d.status === 'at_store').length
  const awaitingPaymentCount = deliveries.filter(d =>
    d.delivery_type === 'intercity_post' && d.orders?.payment_status !== 'paid' && d.status === 'pending'
  ).length
  const nowForCount = new Date()
  const overdueDelayedCount = deliveries.filter(d =>
    d.status === 'delayed' && d.estimated_delivery_time && new Date(d.estimated_delivery_time) <= nowForCount
  ).length
  const pendingCount = deliveries.filter(d => d.status === 'pending').length + overdueDelayedCount
  const completedCount = deliveries.filter(d => d.status === 'delivered').length
  const failedCount = deliveries.filter(d =>
    d.status === 'failed' || (d.status === 'delayed' && (!d.estimated_delivery_time || new Date(d.estimated_delivery_time) > nowForCount))
  ).length
  const deniedCount = deliveries.filter(d => d.denial_info !== null && d.status === 'pending').length

  // Group at_store deliveries by driver — for bulk confirm buttons
  const atStoreByDriver = useMemo(() => {
    const map = new Map<string, { driverId: string; driverName: string; count: number }>()
    deliveries
      .filter(d => d.status === 'at_store' && d.delivery_drivers)
      .forEach(d => {
        const driverId = d.delivery_drivers!.id
        const existing = map.get(driverId)
        if (existing) existing.count++
        else map.set(driverId, { driverId, driverName: d.delivery_drivers!.name, count: 1 })
      })
    return [...map.values()]
  }, [deliveries])

  async function handleCreate() {
    if (!formAddress.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_address: formAddress.trim(),
          customer_name: formCustomerName.trim() || undefined,
          customer_phone: formCustomerPhone.trim() || undefined,
          driver_id: formDriverId || undefined,
          delivery_type: formDeliveryType,
          delivery_fee: formDeliveryFee ? Number(formDeliveryFee) : undefined,
          notes: formNotes.trim() || undefined,
        }),
      })

      if (res.ok) {
        const { delivery } = await res.json()
        setDeliveries(prev => [delivery, ...prev])
        setShowCreateForm(false)
        setFormAddress('')
        setFormCustomerName('')
        setFormCustomerPhone('')
        setFormDriverId('')
        setFormDeliveryFee('')
        setFormNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
  }

  async function handleAiAssign(deliveryId: string) {
    setAssigning(deliveryId)
    try {
      const res = await fetch('/api/deliveries/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: deliveryId }),
      })
      if (res.ok) {
        const data = await res.json()
        setDeliveries(prev => prev.map(d =>
          d.id === deliveryId
            ? {
                ...d,
                status: data.delivery?.status || d.status,
                delivery_drivers: data.delivery?.delivery_drivers || d.delivery_drivers,
                ai_assignment: data.assignment || d.ai_assignment,
              }
            : d
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'AI оноолт амжилтгүй')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setAssigning(null)
    }
  }

  async function handleConfirmHandoff(deliveryId: string) {
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/confirm-handoff`, { method: 'POST' })
      if (res.ok) {
        setDeliveries(prev => prev.map(d =>
          d.id === deliveryId ? { ...d, status: 'picked_up' as const } : d
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
  }

  async function handleBulkConfirmHandoff(driverId: string, driverName: string) {
    if (!confirm(`${driverName}-д оноогдсон бүх барааг нэгэн зэрэг өгөх үү?`)) return
    setBulkConfirming(driverId)
    try {
      const res = await fetch('/api/deliveries/bulk-confirm-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId }),
      })
      const data = await res.json()
      if (res.ok && data.confirmed > 0) {
        // Update all confirmed deliveries to picked_up in local state
        const confirmedIds = new Set(data.delivery_ids as string[])
        setDeliveries(prev => prev.map(d =>
          confirmedIds.has(d.id) ? { ...d, status: 'picked_up' as const } : d
        ))
      } else {
        alert(data.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    finally { setBulkConfirming(null) }
  }

  async function handleConfirmPayment(deliveryId: string) {
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/confirm-payment`, { method: 'POST' })
      if (res.ok) {
        setDeliveries(prev => prev.map(d =>
          d.id === deliveryId && d.orders
            ? { ...d, orders: { ...d.orders, payment_status: 'paid' } }
            : d
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
  }

  async function handleReassign(deliveryId: string) {
    setReassigningId(deliveryId)
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ denial_info: null }),
      })
      if (res.ok) {
        // Update local state — clear denial_info
        setDeliveries(prev => prev.map(d =>
          d.id === deliveryId ? { ...d, denial_info: null } : d
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch { alert('Алдаа гарлаа') }
    finally { setReassigningId(null) }
  }

  async function handleOpenBatchDispatch() {
    setBatchLoading(true)
    try {
      const res = await fetch('/api/deliveries/batch-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Алдаа гарлаа'); return }
      if (data.total === 0) { alert(data.message || 'Оноох хүргэлт байхгүй'); return }
      setBatchPreview(data as BatchPreview)
    } catch { alert('Алдаа гарлаа') }
    finally { setBatchLoading(false) }
  }

  async function handleConfirmBatchDispatch() {
    if (!batchPreview) return
    setBatchConfirming(true)
    try {
      const res = await fetch('/api/deliveries/batch-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Алдаа гарлаа'); return }

      // Refresh deliveries list after batch assign
      const updatedIds = (data.assignments as { delivery_id: string; driver_id: string }[]).map(a => a.delivery_id)
      setDeliveries(prev => prev.map(d => {
        const a = (data.assignments as { delivery_id: string; driver_id: string; driver_name: string }[]).find(x => x.delivery_id === d.id)
        if (!a) return d
        return {
          ...d,
          status: 'assigned' as const,
          delivery_drivers: { id: a.driver_id, name: a.driver_name, phone: '', vehicle_type: '' },
        }
      }))
      console.log(`Batch dispatch: ${updatedIds.length} assigned`)
      setBatchPreview(null)
    } catch { alert('Алдаа гарлаа') }
    finally { setBatchConfirming(false) }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filtered.map(d => ({
      'Дугаар': d.delivery_number,
      'Хаяг': d.delivery_address,
      'Харилцагч': d.customer_name || '',
      'Утас': d.customer_phone || '',
      'Жолооч': d.delivery_drivers?.name || '',
      'Төлөв': STATUS_CONFIG[d.status]?.label || d.status,
      'Хүргэлтийн төлбөр': d.delivery_fee != null ? d.delivery_fee : '',
      'Огноо': new Date(d.created_at).toLocaleDateString('mn-MN'),
    }))
    exportToFile(data, 'hurguelt', format, 'Хүргэлт')
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
      {/* Batch dispatch modal */}
      {batchPreview && (
        <BatchDispatchModal
          preview={batchPreview}
          onConfirm={handleConfirmBatchDispatch}
          onCancel={() => setBatchPreview(null)}
          confirming={batchConfirming}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Хүргэлт</h1>
          <p className="text-slate-400 mt-1">
            Нийт {deliveries.length} хүргэлт
            {filtered.length !== deliveries.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/orders"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Захиалга
          </Link>
          <Link
            href="/dashboard/deliveries/map"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Газрын зураг
          </Link>
          <Link
            href="/dashboard/delivery-drivers"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Жолоочууд
          </Link>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            + Хүргэлт нэмэх
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{pendingCount}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Хүргэсэн</p>
          <p className="text-2xl font-bold text-white mt-1">{completedCount}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Амжилтгүй / Хоцорсон</p>
          <p className="text-2xl font-bold text-white mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Urgent alerts */}
      {(atStoreCount > 0 || awaitingPaymentCount > 0) && (
        <div className="space-y-2 mb-4">
          {atStoreByDriver.map(({ driverId, driverName, count }) => (
            <div key={driverId} className="flex items-center justify-between px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <span>🏪</span>
                <span className="text-cyan-300 text-sm font-medium">
                  <b>{driverName}</b> дэлгүүрт ирсэн —{' '}
                  <b>{count} бараа</b> хүлээж байна
                </span>
              </div>
              <button
                onClick={() => handleBulkConfirmHandoff(driverId, driverName)}
                disabled={bulkConfirming === driverId}
                className="text-sm px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {bulkConfirming === driverId
                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>...</span></>
                  : <><span>📦</span><span>{count === 1 ? 'Бараа өгсөн' : `${count} бараа өгсөн`}</span></>
                }
              </button>
            </div>
          ))}
          {awaitingPaymentCount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <span>💳</span>
                <span className="text-orange-300 text-sm font-medium">
                  {awaitingPaymentCount} хотоор хоорондын захиалга урьдчилж төлбөр хүлээж байна
                </span>
              </div>
              <button
                onClick={() => setStatusFilter('pending')}
                className="text-xs px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-all"
              >
                Харах
              </button>
            </div>
          )}
        </div>
      )}

      {/* Workflow tabs + search */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6 space-y-3">
        {/* Tab buttons — one click to jump to the right stage */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'Бүгд', count: deliveries.length, color: 'slate' },
            {
              value: 'needs_action',
              label: '🔴 Шаардлагатай',
              count: deliveries.filter(d => ['pending', 'at_store'].includes(d.status)).length,
              color: 'red',
              urgent: deliveries.filter(d => d.status === 'at_store').length > 0,
            },
            {
              value: 'denied',
              label: '❌ Татгалзсан',
              count: deniedCount,
              color: 'orange',
              urgent: deniedCount > 0,
            },
            {
              value: 'active',
              label: '🚚 Замдаа',
              count: deliveries.filter(d => ['assigned', 'picked_up', 'in_transit', 'delayed'].includes(d.status)).length,
              color: 'blue',
            },
            {
              value: 'done',
              label: '✅ Дууссан',
              count: deliveries.filter(d => ['delivered', 'cancelled', 'failed'].includes(d.status)).length,
              color: 'green',
            },
          ].map(tab => {
            const isActive = statusFilter === tab.value
            const colorMap: Record<string, string> = {
              slate: isActive ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-700/40 text-slate-400 border-slate-600 hover:bg-slate-700',
              red: isActive ? 'bg-red-500/30 text-red-300 border-red-500/50' : `${tab.urgent ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-pulse' : 'bg-slate-700/40 text-slate-400 border-slate-600'} hover:bg-red-500/20`,
              orange: isActive ? 'bg-orange-500/30 text-orange-300 border-orange-500/50' : `${tab.urgent ? 'bg-orange-500/10 border-orange-500/40 text-orange-400' : 'bg-slate-700/40 text-slate-400 border-slate-600'} hover:bg-orange-500/20`,
              blue: isActive ? 'bg-blue-500/30 text-blue-300 border-blue-500/50' : 'bg-slate-700/40 text-slate-400 border-slate-600 hover:bg-blue-500/10',
              green: isActive ? 'bg-green-500/30 text-green-300 border-green-500/50' : 'bg-slate-700/40 text-slate-400 border-slate-600 hover:bg-green-500/10',
            }
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${colorMap[tab.color]}`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white/20' : 'bg-slate-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search + actions row */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Хүргэлтийн дугаар, харилцагч, захиалга, жолооч хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <button
            onClick={handleOpenBatchDispatch}
            disabled={batchLoading}
            className="px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {batchLoading
              ? <><span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /><span>Бэлтгэж байна...</span></>
              : <><span>🤖</span><span>Ухаалаг хуваарилах</span></>
            }
          </button>
          <button onClick={() => handleExport('xlsx')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📥</span><span>Excel</span>
          </button>
          <button onClick={() => handleExport('csv')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📄</span><span>CSV</span>
          </button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ хүргэлт</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Хүргэх хаяг *</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Баянзүрх дүүрэг, 3-р хороо..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүлээн авагч</label>
                  <input
                    type="text"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Нэр"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Утас</label>
                  <input
                    type="text"
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="99001122"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүргэлтийн төрөл</label>
                  <select
                    value={formDeliveryType}
                    onChange={(e) => setFormDeliveryType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="own_driver">Өөрийн жолооч</option>
                    <option value="external_provider">Гадны хүргэлт</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Хүргэлтийн төлбөр</label>
                  <input
                    type="number"
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="5000"
                  />
                </div>
              </div>
              {formDeliveryType === 'own_driver' && drivers.length > 0 && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Жолооч оноох</label>
                  <select
                    value={formDriverId}
                    onChange={(e) => setFormDriverId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Дараа оноох</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Нэмэлт мэдээлэл..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formAddress.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Хүргэлт үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar — shown when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 mb-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
          <span className="text-blue-300 text-sm font-medium">
            ✅ {selectedIds.size} хүргэлт сонгогдсон
          </span>
          <div className="flex flex-1 items-center gap-2 min-w-[220px]">
            <select
              value={bulkDriverId}
              onChange={e => setBulkDriverId(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">— Жолооч сонгох —</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkDriverId || bulkActionLoading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 whitespace-nowrap"
            >
              {bulkActionLoading ? '...' : `👤 Оноох`}
            </button>
          </div>
          <button
            onClick={handleBulkUnassign}
            disabled={bulkActionLoading}
            className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg transition-all disabled:opacity-40 whitespace-nowrap"
          >
            {bulkActionLoading ? '...' : '❌ Чөлөөлөх'}
          </button>
          <button onClick={clearSelection} className="text-slate-400 hover:text-white text-sm transition-all">
            Цуцлах
          </button>
        </div>
      )}

      {/* Deliveries Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-3 px-3 md:py-4 md:px-4 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                  />
                </th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүргэлт</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалга</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүлээн авагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Жолооч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((del) => {
                const sc = STATUS_CONFIG[del.status] || STATUS_CONFIG.pending
                return (
                  <tr
                    key={del.id}
                    className={`border-b border-slate-700/50 transition-all ${selectedIds.has(del.id) ? 'bg-blue-500/10' : 'hover:bg-slate-700/30'}`}
                  >
                    <td className="py-3 px-3 md:py-4 md:px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(del.id)}
                        onChange={() => toggleSelect(del.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">#{del.delivery_number}</span>
                        {del.metadata?.proof_photo_file_id && (
                          <a
                            href={`/api/telegram/driver/photo?file_id=${del.metadata.proof_photo_file_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Хүргэлтийн зураг харах"
                            className="text-green-400 hover:text-green-300 transition-all"
                          >
                            📸
                          </a>
                        )}
                      </div>
                      {/* Secondary info: phone, address, products */}
                      <div className="text-slate-400 text-xs mt-1 space-y-0.5">
                        {del.customer_phone && (
                          <p>📞 {del.customer_phone}</p>
                        )}
                        {del.delivery_address && (
                          <p title={del.delivery_address} className="truncate max-w-[180px]">📍 {del.delivery_address}</p>
                        )}
                        {del.orders?.order_items && del.orders.order_items.length > 0 && (
                          <p className="text-slate-500">
                            🛍️ {del.orders.order_items[0]?.products?.name || 'Бараа'}
                            {del.orders.order_items.length > 1 && ` +${del.orders.order_items.length - 1}`}
                          </p>
                        )}
                      </div>
                      {del.delivery_fee != null && (
                        <p className="text-slate-400 text-xs mt-0.5">{formatPrice(del.delivery_fee)}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {del.orders ? (
                        <Link href={`/dashboard/orders/${del.orders.id}`} className="text-blue-400 hover:text-blue-300 transition-all">
                          #{del.orders.order_number}
                        </Link>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white">{del.customer_name || '-'}</p>
                        {del.customer_phone && (
                          <p className="text-slate-400 text-sm">{del.customer_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {/* at_store: show "Бараа өгсөн" confirm button */}
                      {del.status === 'at_store' ? (
                        <div className="space-y-1">
                          {del.delivery_drivers && (
                            <div>
                              <p className="text-white text-sm">{del.delivery_drivers.name}</p>
                              <p className="text-slate-400 text-xs">{del.delivery_drivers.phone}</p>
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); handleConfirmHandoff(del.id) }}
                            className="block text-xs px-2 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 rounded transition-all"
                          >
                            📦 Бараа өгсөн
                          </button>
                        </div>
                      ) : del.delivery_drivers ? (
                        <div>
                          <p className="text-white text-sm">{del.delivery_drivers.name}</p>
                          <p className="text-slate-400 text-xs">{del.delivery_drivers.phone}</p>
                          {del.ai_assignment?.recommended_driver_id && (
                            <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              AI оноосон
                            </span>
                          )}
                        </div>
                      ) : del.status === 'pending' && del.denial_info ? (
                        // Denied delivery — show denial info and reassign button
                        <div className="space-y-1">
                          <div className="text-xs">
                            <p className="text-orange-400 font-medium">❌ {del.denial_info.reason_label}</p>
                            <p className="text-slate-400 mt-0.5">
                              {del.denial_info.driver_name}
                              {del.denial_info.denied_at && ` · ${new Date(del.denial_info.denied_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}`}
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); handleReassign(del.id) }}
                            disabled={reassigningId === del.id}
                            className="block text-xs px-2 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded transition-all disabled:opacity-50"
                          >
                            {reassigningId === del.id ? '...' : '🔄 Дахин хуваарилах'}
                          </button>
                        </div>
                      ) : del.status === 'pending' ? (
                        <div className="space-y-1">
                          {/* Intercity payment gate */}
                          {del.delivery_type === 'intercity_post' && del.orders?.payment_status !== 'paid' ? (
                            <button
                              onClick={(e) => { e.preventDefault(); handleConfirmPayment(del.id) }}
                              className="block text-xs px-2 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded transition-all"
                            >
                              💳 Төлбөр баталгаажуулах
                            </button>
                          ) : (
                            <>
                              {del.ai_assignment?.ranked_drivers && del.ai_assignment.ranked_drivers.length > 0 ? (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded inline-block">
                                  AI санал: {drivers.find(d => d.id === del.ai_assignment?.ranked_drivers?.[0]?.driver_id)?.name || 'Жолооч'}
                                </span>
                              ) : null}
                              <button
                                onClick={(e) => { e.preventDefault(); handleAiAssign(del.id) }}
                                disabled={assigning === del.id}
                                className="block text-xs px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-all disabled:opacity-50"
                              >
                                {assigning === del.id ? 'Оноож байна...' : 'AI оноох'}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">Оноогоогүй</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        del.delivery_type === 'own_driver'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : del.delivery_type === 'intercity_post'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {del.delivery_type === 'own_driver'
                          ? '🚗 Өөрийн'
                          : del.delivery_type === 'intercity_post'
                          ? '🚌 Хотоор хоорондын'
                          : del.provider_name || 'Гадны'}
                      </span>
                      {del.delivery_type === 'intercity_post' && del.orders?.payment_status === 'paid' && (
                        <span className="block mt-0.5 text-xs text-emerald-400">✅ Төлбөр авсан</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                      {del.status === 'failed' && (
                        <p className="text-red-400/80 text-xs mt-1">
                          {del.metadata?.wrong_item_photo_url ? '📦 Буруу бараа' :
                           del.notes === 'Гэмтсэн бараа' ? '💔 Гэмтсэн' :
                           del.notes?.includes('мөнгө') ? '💰 Мөнгө өгсөнгүй' :
                           del.failure_reason || del.notes || 'Шалтгаан тодорхойгүй'}
                        </p>
                      )}
                      {del.notes && del.status !== 'failed' && (
                        <p className="text-slate-500 text-xs mt-1 truncate max-w-[150px]" title={del.notes}>
                          💬 {del.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(del.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/dashboard/deliveries/${del.id}`}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all inline-block"
                      >
                        👁️
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : deliveries.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох хүргэлт олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚚</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Хүргэлт байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Захиалга илгээхэд хүргэлт автоматаар үүснэ эсвэл гараар нэмнэ үү
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Эхний хүргэлтээ нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
