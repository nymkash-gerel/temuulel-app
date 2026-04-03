'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { exportToFile } from '@/lib/export-utils'
import { formatPrice } from '@/lib/format'
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

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:    { label: 'Хүлээгдэж буй', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-l-yellow-500' },
  assigned:   { label: 'Оноосон',       dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-l-blue-500' },
  at_store:   { label: 'Дэлгүүрт',      dot: 'bg-cyan-400',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-l-cyan-500' },
  picked_up:  { label: 'Авсан',         dot: 'bg-indigo-400', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-l-indigo-500' },
  in_transit: { label: 'Зам дээр',      dot: 'bg-purple-400', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-l-purple-500' },
  delivered:  { label: 'Хүргэсэн',      dot: 'bg-emerald-400',bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-l-emerald-500' },
  failed:     { label: 'Амжилтгүй',     dot: 'bg-red-400',    bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-l-red-500' },
  cancelled:  { label: 'Цуцлагдсан',    dot: 'bg-slate-400',  bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-l-slate-500' },
  delayed:    { label: 'Хоцорсон',      dot: 'bg-orange-400', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-l-orange-500' },
}

interface Props {
  initialDeliveries: Delivery[]
  initialDrivers: Driver[]
}

export default function DeliveriesClient({ initialDeliveries, initialDrivers }: Props) {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries)
  const [drivers] = useState<Driver[]>(initialDrivers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

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
  const [bulkConfirming, setBulkConfirming] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDriverId, setBulkDriverId] = useState('')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [reassigningId, setReassigningId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    if (statusFilter === 'needs_action') {
      const now = new Date()
      result = result.filter(d =>
        ['pending', 'at_store'].includes(d.status) ||
        (d.status === 'delayed' && d.estimated_delivery_time && new Date(d.estimated_delivery_time) <= now)
      )
      const order: Record<string, number> = { at_store: 0, delayed: 1, pending: 2 }
      result = [...result].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
    } else if (statusFilter === 'active') {
      result = result.filter(d => ['assigned', 'picked_up', 'in_transit', 'delayed'].includes(d.status))
    } else if (statusFilter === 'done') {
      result = result.filter(d => ['delivered', 'cancelled', 'failed'].includes(d.status))
    } else if (statusFilter === 'denied') {
      result = result.filter(d => d.denial_info !== null && d.status === 'pending')
    } else if (statusFilter) {
      result = result.filter(d => d.status === statusFilter)
    }
    return result
  }, [deliveries, search, statusFilter])

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
        setFormAddress(''); setFormCustomerName(''); setFormCustomerPhone(''); setFormDriverId(''); setFormDeliveryFee(''); setFormNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch { alert('Алдаа гарлаа') }
    finally { setCreating(false) }
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
            ? { ...d, status: data.delivery?.status || d.status, delivery_drivers: data.delivery?.delivery_drivers || d.delivery_drivers, ai_assignment: data.assignment || d.ai_assignment }
            : d
        ))
      } else {
        const err = await res.json()
        alert(err.error || 'AI оноолт амжилтгүй')
      }
    } catch { alert('Алдаа гарлаа') }
    finally { setAssigning(null) }
  }

  async function handleConfirmHandoff(deliveryId: string) {
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/confirm-handoff`, { method: 'POST' })
      if (res.ok) {
        setDeliveries(prev => prev.map(d => d.id === deliveryId ? { ...d, status: 'picked_up' as const } : d))
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
        const confirmedIds = new Set(data.delivery_ids as string[])
        setDeliveries(prev => prev.map(d => confirmedIds.has(d.id) ? { ...d, status: 'picked_up' as const } : d))
      } else { alert(data.error || 'Алдаа гарлаа') }
    } catch { alert('Алдаа гарлаа') }
    finally { setBulkConfirming(null) }
  }

  async function handleConfirmPayment(deliveryId: string) {
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/confirm-payment`, { method: 'POST' })
      if (res.ok) {
        setDeliveries(prev => prev.map(d =>
          d.id === deliveryId && d.orders ? { ...d, orders: { ...d.orders, payment_status: 'paid' } } : d
        ))
      } else { const err = await res.json(); alert(err.error || 'Алдаа гарлаа') }
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
        setDeliveries(prev => prev.map(d => d.id === deliveryId ? { ...d, denial_info: null } : d))
      } else { const err = await res.json(); alert(err.error || 'Алдаа гарлаа') }
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
      setDeliveries(prev => prev.map(d => {
        const a = (data.assignments as { delivery_id: string; driver_id: string; driver_name: string }[]).find(x => x.delivery_id === d.id)
        if (!a) return d
        return { ...d, status: 'assigned' as const, delivery_drivers: { id: a.driver_id, name: a.driver_name, phone: '', vehicle_type: '' } }
      }))
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

  // Delivery row actions based on status
  function getActions(d: Delivery) {
    const actions: { label: string; onClick: () => void; color: string; loading?: boolean; disabled?: boolean }[] = []
    if (d.status === 'pending' && !d.delivery_drivers) {
      actions.push({ label: 'AI оноох', onClick: () => handleAiAssign(d.id), color: 'blue', loading: assigning === d.id, disabled: assigning === d.id })
    }
    if (d.status === 'at_store') {
      actions.push({ label: 'Бараа өгсөн', onClick: () => handleConfirmHandoff(d.id), color: 'cyan' })
    }
    if (d.orders && d.orders.payment_status !== 'paid' && d.delivery_type === 'intercity_post' && d.status === 'pending') {
      actions.push({ label: 'Төлбөр батлах', onClick: () => handleConfirmPayment(d.id), color: 'green' })
    }
    if (d.denial_info && d.status === 'pending') {
      actions.push({ label: 'Дахин оноох', onClick: () => handleReassign(d.id), color: 'orange', loading: reassigningId === d.id, disabled: reassigningId === d.id })
    }
    return actions
  }

  const totalDeliveryFee = deliveries.filter(d => d.status === 'delivered' && d.delivery_fee).reduce((sum, d) => sum + (d.delivery_fee || 0), 0)

  return (
    <div className="space-y-6">
      {batchPreview && (
        <BatchDispatchModal preview={batchPreview} onConfirm={handleConfirmBatchDispatch} onCancel={() => setBatchPreview(null)} confirming={batchConfirming} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Хүргэлт</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Нийт {deliveries.length} хүргэлт
            {filtered.length !== deliveries.length && ` · ${filtered.length} илэрц`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/orders" className="px-3.5 py-2 text-sm bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 rounded-xl transition-all">
            Захиалга
          </Link>
          <Link href="/dashboard/deliveries/map" className="px-3.5 py-2 text-sm bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 rounded-xl transition-all">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" /></svg>
              Газрын зураг
            </span>
          </Link>
          <Link href="/dashboard/delivery-drivers" className="px-3.5 py-2 text-sm bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 rounded-xl transition-all">
            Жолоочууд
          </Link>
          <button onClick={() => setShowCreateForm(true)} className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Хүргэлт нэмэх
            </span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Хүлээгдэж буй', value: pendingCount, color: 'yellow', gradient: 'from-yellow-500/20 to-yellow-600/5' },
          { label: 'Идэвхтэй', value: activeCount, color: 'blue', gradient: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Хүргэсэн', value: completedCount, color: 'emerald', gradient: 'from-emerald-500/20 to-emerald-600/5' },
          { label: 'Амжилтгүй', value: failedCount, color: 'red', gradient: 'from-red-500/20 to-red-600/5' },
          { label: 'Орлого', value: null, display: formatPrice(totalDeliveryFee), color: 'purple', gradient: 'from-purple-500/20 to-purple-600/5' },
        ].map((stat) => (
          <div key={stat.label} className={`relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4`}>
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} blur-2xl`} />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1.5 relative">
              {stat.value !== null ? stat.value : stat.display}
            </p>
          </div>
        ))}
      </div>

      {/* Urgent Alerts */}
      {(atStoreCount > 0 || awaitingPaymentCount > 0) && (
        <div className="space-y-2">
          {atStoreByDriver.map(({ driverId, driverName, count }) => (
            <div key={driverId} className="flex items-center justify-between px-4 py-3 bg-cyan-500/[0.08] border border-cyan-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0a2.999 2.999 0 00.89-1.397l1.39-4.862A1.5 1.5 0 016.735 2h10.53a1.5 1.5 0 011.456 1.09l1.39 4.862A3 3 0 0121 9.35" /></svg>
                </div>
                <span className="text-cyan-300 text-sm"><span className="font-semibold">{driverName}</span> дэлгүүрт ирсэн — <span className="font-semibold">{count} бараа</span> хүлээж байна</span>
              </div>
              <button onClick={() => handleBulkConfirmHandoff(driverId, driverName)} disabled={bulkConfirming === driverId} className="text-sm px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5">
                {bulkConfirming === driverId ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>Бараа өгсөн</span>}
              </button>
            </div>
          ))}
          {awaitingPaymentCount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-orange-500/[0.08] border border-orange-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                </div>
                <span className="text-orange-300 text-sm">{awaitingPaymentCount} хотоор хоорондын захиалга төлбөр хүлээж байна</span>
              </div>
              <button onClick={() => setStatusFilter('pending')} className="text-xs px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-all font-medium">Харах</button>
            </div>
          )}
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-col gap-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { value: '', label: 'Бүгд', count: deliveries.length },
            { value: 'needs_action', label: 'Шаардлагатай', count: deliveries.filter(d => ['pending', 'at_store'].includes(d.status)).length, dot: 'bg-red-400', pulse: deliveries.some(d => d.status === 'at_store') },
            { value: 'denied', label: 'Татгалзсан', count: deniedCount, dot: 'bg-orange-400', pulse: deniedCount > 0 },
            { value: 'active', label: 'Замдаа', count: deliveries.filter(d => ['assigned', 'picked_up', 'in_transit', 'delayed'].includes(d.status)).length, dot: 'bg-blue-400' },
            { value: 'done', label: 'Дууссан', count: deliveries.filter(d => ['delivered', 'cancelled', 'failed'].includes(d.status)).length, dot: 'bg-emerald-400' },
          ].map(tab => {
            const isActive = statusFilter === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white/[0.1] text-white border border-white/[0.15]'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {tab.dot && (
                  <span className="relative flex h-2 w-2">
                    {tab.pulse && !isActive && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tab.dot} opacity-75`} />}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${tab.dot}`} />
                  </span>
                )}
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/[0.15]' : 'bg-white/[0.06]'}`}>{tab.count}</span>
              </button>
            )
          })}
        </div>

        {/* Search + Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Дугаар, харилцагч, жолооч хайх..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleOpenBatchDispatch} disabled={batchLoading} className="px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50 font-medium">
              {batchLoading ? <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>}
              <span>Ухаалаг хуваарилах</span>
            </button>
            <div className="relative group">
              <button className="px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-400 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white/[0.06] border border-white/[0.1] rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">Excel</button>
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors">CSV</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-blue-500/[0.08] border border-blue-500/20 rounded-xl">
          <span className="text-blue-300 text-sm font-medium">{selectedIds.size} сонгогдсон</span>
          <div className="h-4 w-px bg-white/[0.1]" />
          <select value={bulkDriverId} onChange={e => setBulkDriverId(e.target.value)} className="px-3 py-1.5 bg-white/[0.06] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none">
            <option value="">Жолооч сонгох</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={handleBulkAssign} disabled={bulkActionLoading || !bulkDriverId} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-all">Оноох</button>
          <button onClick={handleBulkUnassign} disabled={bulkActionLoading} className="px-3 py-1.5 text-red-400 text-sm border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-all">Буцаах</button>
          <button onClick={clearSelection} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Шинэ хүргэлт</h2>
              <button onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Хүргэх хаяг *</label>
                <input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10" placeholder="Баянзүрх дүүрэг, 3-р хороо..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Хүлээн авагч</label>
                  <input type="text" value={formCustomerName} onChange={(e) => setFormCustomerName(e.target.value)} className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10" placeholder="Нэр" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Утас</label>
                  <input type="text" value={formCustomerPhone} onChange={(e) => setFormCustomerPhone(e.target.value)} className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10" placeholder="99001122" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Хүргэлтийн төрөл</label>
                  <select value={formDeliveryType} onChange={(e) => setFormDeliveryType(e.target.value)} className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10">
                    <option value="own_driver">Өөрийн жолооч</option>
                    <option value="external_provider">Гадны хүргэлт</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Төлбөр</label>
                  <input type="number" value={formDeliveryFee} onChange={(e) => setFormDeliveryFee(e.target.value)} className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10" placeholder="5000" />
                </div>
              </div>
              {formDeliveryType === 'own_driver' && drivers.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Жолооч</label>
                  <select value={formDriverId} onChange={(e) => setFormDriverId(e.target.value)} className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10">
                    <option value="">Дараа оноох</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Тэмдэглэл</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/[0.15] focus:ring-2 focus:ring-blue-500/10 resize-none" placeholder="Нэмэлт мэдээлэл..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateForm(false)} className="flex-1 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl transition-all text-sm">Цуцлах</button>
              <button onClick={handleCreate} disabled={creating || !formAddress.trim()} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all disabled:opacity-50 text-sm shadow-lg shadow-blue-500/20">{creating ? 'Үүсгэж байна...' : 'Үүсгэх'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Table */}
      {filtered.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[40px_minmax(100px,1fr)_minmax(80px,1fr)_minmax(140px,1.5fr)_minmax(100px,1fr)_minmax(90px,0.8fr)_minmax(60px,0.5fr)_minmax(100px,1fr)] gap-0 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center">
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded border-white/[0.15] bg-white/[0.06] text-blue-500" />
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Дугаар</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Харилцагч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Хаяг</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Жолооч</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Төлөв</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Дүн</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold text-right">Үйлдэл</p>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(d => {
              const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending
              const actions = getActions(d)
              const isExpanded = expandedId === d.id

              return (
                <div key={d.id}>
                  {/* Desktop Row */}
                  <div className={`hidden md:grid grid-cols-[40px_minmax(100px,1fr)_minmax(80px,1fr)_minmax(140px,1.5fr)_minmax(100px,1fr)_minmax(90px,0.8fr)_minmax(60px,0.5fr)_minmax(100px,1fr)] gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors group border-l-2 ${sc.border}`}>
                    <div className="flex items-center">
                      <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} className="w-3.5 h-3.5 rounded border-white/[0.15] bg-white/[0.06] text-blue-500" />
                    </div>
                    <div>
                      <Link href={`/dashboard/deliveries/${d.id}`} className="text-white text-sm font-medium hover:text-blue-400 transition-colors">
                        #{d.delivery_number}
                      </Link>
                      <p className="text-slate-600 text-[11px]">{new Date(d.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-300 text-sm truncate">{d.customer_name || '—'}</p>
                      {d.customer_phone && <p className="text-slate-600 text-[11px]">{d.customer_phone}</p>}
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="text-slate-400 text-sm truncate">{d.delivery_address}</p>
                    </div>
                    <div className="min-w-0">
                      {d.delivery_drivers ? (
                        <div>
                          <p className="text-slate-300 text-sm truncate">{d.delivery_drivers.name}</p>
                          {d.denial_info && <p className="text-orange-400/80 text-[11px] truncate">Татгалзсан: {d.denial_info.reason_label}</p>}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-sm">—</span>
                      )}
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      {d.delivery_type !== 'own_driver' && (
                        <p className="text-orange-400/60 text-[10px] mt-0.5">{d.provider_name || 'Гадны'}</p>
                      )}
                    </div>
                    <div>
                      {d.orders ? (
                        <span className="text-white text-sm font-medium">{formatPrice(d.orders.total_amount)}</span>
                      ) : <span className="text-slate-600 text-sm">—</span>}
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      {actions.length > 0 ? actions.map((action, i) => {
                        const colorClasses: Record<string, string> = {
                          blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
                          cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20',
                          green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
                          orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20',
                        }
                        return (
                          <button
                            key={i}
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all disabled:opacity-50 ${colorClasses[action.color] || colorClasses.blue}`}
                          >
                            {action.loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : action.label}
                          </button>
                        )
                      }) : (
                        d.orders && (
                          <Link href={`/dashboard/orders/${d.orders.id}`} className="text-slate-600 hover:text-slate-400 text-[11px] transition-colors opacity-0 group-hover:opacity-100">
                            #{d.orders.order_number}
                          </Link>
                        )
                      )}
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : d.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left border-l-2 ${sc.border}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(d.id) }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-white/[0.15] bg-white/[0.06] text-blue-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">#{d.delivery_number}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{d.customer_name || '—'} · {d.delivery_address}</p>
                      </div>
                      {d.orders && <span className="text-white text-sm font-medium shrink-0">{formatPrice(d.orders.total_amount)}</span>}
                      <svg className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 bg-white/[0.02]">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Харилцагч</p>
                            <p className="text-slate-300">{d.customer_name || '—'}</p>
                            {d.customer_phone && <p className="text-slate-500 text-xs">{d.customer_phone}</p>}
                          </div>
                          <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Жолооч</p>
                            <p className="text-slate-300">{d.delivery_drivers?.name || '—'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">Хаяг</p>
                            <p className="text-slate-400 text-sm">{d.delivery_address}</p>
                          </div>
                        </div>
                        {d.denial_info && (
                          <p className="text-orange-400/80 text-xs bg-orange-500/[0.08] px-3 py-1.5 rounded-lg">
                            {d.denial_info.driver_name} татгалзсан: {d.denial_info.reason_label}
                          </p>
                        )}
                        {actions.length > 0 && (
                          <div className="flex gap-2">
                            {actions.map((action, i) => {
                              const colorClasses: Record<string, string> = {
                                blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
                                cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
                                green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                                orange: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
                              }
                              return (
                                <button key={i} onClick={action.onClick} disabled={action.disabled} className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 ${colorClasses[action.color]}`}>
                                  {action.loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : action.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{new Date(d.created_at).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <Link href={`/dashboard/deliveries/${d.id}`} className="text-blue-400 hover:text-blue-300 font-medium">Дэлгэрэнгүй</Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2 md:hidden">
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded border-white/[0.15] bg-white/[0.06] text-blue-500" />
              <span className="text-slate-600 text-xs">Бүгдийг сонгох</span>
            </div>
            <span className="text-slate-600 text-xs">{filtered.length} хүргэлт</span>
          </div>
        </div>
      ) : deliveries.length > 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <p className="text-slate-500">Хайлтад тохирох хүргэлт олдсонгүй</p>
          <button onClick={() => { setSearch(''); setStatusFilter('') }} className="mt-4 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl text-sm transition-all">Шүүлтүүр цэвэрлэх</button>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Хүргэлт байхгүй</h3>
          <p className="text-slate-500 text-sm mb-6">Захиалга баталгаажуулахад автомат хүргэлт үүснэ</p>
          <button onClick={() => setShowCreateForm(true)} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400">
            Хүргэлт нэмэх
          </button>
        </div>
      )}
    </div>
  )
}
