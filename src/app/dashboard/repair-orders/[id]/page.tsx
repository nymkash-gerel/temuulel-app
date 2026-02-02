'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { repairOrderTransitions } from '@/lib/status-machine'

interface RepairOrder {
  id: string
  order_number: string
  customer_id: string | null
  assigned_to: string | null
  device_type: string
  brand: string | null
  model: string | null
  serial_number: string | null
  issue_description: string
  diagnosis: string | null
  status: string
  priority: string
  estimated_cost: number | null
  actual_cost: number | null
  deposit_amount: number | null
  received_at: string | null
  estimated_completion: string | null
  completed_at: string | null
  delivered_at: string | null
  warranty_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string } | null
}

interface RepairPart {
  id: string
  repair_order_id: string
  name: string
  part_number: string | null
  quantity: number
  unit_cost: number
  supplier: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  received: { label: '\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0441\u0430\u043D', color: 'bg-blue-500/20 text-blue-400' },
  diagnosing: { label: '\u041E\u043D\u043E\u0448\u043B\u043E\u0436 \u0431\u0443\u0439', color: 'bg-purple-500/20 text-purple-400' },
  quoted: { label: '\u04AE\u043D\u044D \u0442\u043E\u0433\u0442\u043E\u043E\u0441\u043E\u043D', color: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: '\u0417\u04E9\u0432\u0448\u04E9\u04E9\u0440\u0441\u04E9\u043D', color: 'bg-cyan-500/20 text-cyan-400' },
  in_repair: { label: '\u0417\u0430\u0441\u0432\u0430\u0440\u043B\u0430\u0436 \u0431\u0443\u0439', color: 'bg-orange-500/20 text-orange-400' },
  completed: { label: '\u0414\u0443\u0443\u0441\u0441\u0430\u043D', color: 'bg-green-500/20 text-green-400' },
  delivered: { label: '\u0425\u04AF\u043B\u044D\u044D\u043B\u0433\u044D\u0441\u044D\u043D', color: 'bg-slate-500/20 text-slate-400' },
  cancelled: { label: '\u0426\u0443\u0446\u043B\u0430\u0433\u0434\u0441\u0430\u043D', color: 'bg-red-500/20 text-red-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: '\u0411\u0430\u0433\u0430', color: 'bg-gray-500/20 text-gray-400' },
  normal: { label: '\u0414\u0443\u043D\u0434', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: '\u04E8\u043D\u0434\u04E9\u0440', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: '\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439', color: 'bg-red-500/20 text-red-400' },
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  phone: '\u0423\u0442\u0430\u0441',
  laptop: '\u0417\u04E9\u04E9\u0432\u0440\u0438\u0439\u043D \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440',
  desktop: '\u041A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440',
  tablet: '\u0422\u0430\u0431\u043B\u0435\u0442',
  tv: '\u0422\u0435\u043B\u0435\u0432\u0438\u0437',
  appliance: '\u0413\u044D\u0440 \u0430\u0445\u0443\u0439\u043D',
  console: '\u0422\u043E\u0433\u043B\u043E\u043E\u043C\u044B\u043D \u043A\u043E\u043D\u0441\u043E\u043B',
  camera: '\u041A\u0430\u043C\u0435\u0440',
  other: '\u0411\u0443\u0441\u0430\u0434',
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Хүлээн авсан',
  diagnosing: 'Оношлож буй',
  quoted: 'Үнэ тогтоосон',
  approved: 'Зөвшөөрсөн',
  in_repair: 'Засварлаж буй',
  completed: 'Дууссан',
  delivered: 'Хүлээлгэсэн',
  cancelled: 'Цуцлагдсан',
}

const STATUS_FLOW = ['received', 'diagnosing', 'quoted', 'approved', 'in_repair', 'completed', 'delivered']

const NEXT_STATUS_LABELS: Record<string, string> = {
  received: '\u041E\u043D\u043E\u0448\u043B\u043E\u0433\u043E\u043E \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445',
  diagnosing: '\u04AE\u043D\u044D \u0442\u043E\u0433\u0442\u043E\u043E\u0445',
  quoted: '\u0417\u04E9\u0432\u0448\u04E9\u04E9\u0440\u04E9\u0445',
  approved: '\u0417\u0430\u0441\u0432\u0430\u0440 \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445',
  in_repair: '\u0414\u0443\u0443\u0441\u0433\u0430\u0445',
  completed: '\u0425\u04AF\u043B\u044D\u044D\u043B\u0433\u044D\u0445',
}

function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '\u20AE'
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RepairOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const repairId = params.id as string

  const [order, setOrder] = useState<RepairOrder | null>(null)
  const [parts, setParts] = useState<RepairPart[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/login'); return }

    const { data: repairData } = await supabase
      .from('repair_orders')
      .select(`
        id, order_number, customer_id, assigned_to,
        device_type, brand, model, serial_number,
        issue_description, diagnosis, status, priority,
        estimated_cost, actual_cost, deposit_amount,
        received_at, estimated_completion, completed_at,
        delivered_at, warranty_until, notes,
        created_at, updated_at,
        customers(id, name),
        staff!repair_orders_assigned_to_fkey(id, name)
      `)
      .eq('id', repairId)
      .eq('store_id', store.id)
      .single()

    if (!repairData) {
      router.push('/dashboard/repair-orders')
      return
    }

    setOrder(repairData as unknown as RepairOrder)

    const { data: partsData } = await supabase
      .from('repair_parts')
      .select('id, repair_order_id, name, part_number, quantity, unit_cost, supplier, created_at')
      .eq('repair_order_id', repairId)
      .order('created_at', { ascending: true })

    if (partsData) {
      setParts(partsData)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairId])

  async function handleStatusChange(newStatus: string) {
    if (!order) return

    const confirmMessages: Record<string, string> = {
      diagnosing: '\u041E\u043D\u043E\u0448\u043B\u043E\u0433\u043E\u043E \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445 \u04AF\u04AF?',
      quoted: '\u04AE\u043D\u044D \u0442\u043E\u0433\u0442\u043E\u043E\u0445 \u04AF\u04AF?',
      approved: '\u0417\u04E9\u0432\u0448\u04E9\u04E9\u0440\u04E9\u0445 \u04AF\u04AF?',
      in_repair: '\u0417\u0430\u0441\u0432\u0430\u0440 \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445 \u04AF\u04AF?',
      completed: '\u0414\u0443\u0443\u0441\u0433\u0430\u0445 \u04AF\u04AF?',
      delivered: '\u0425\u04AF\u043B\u044D\u044D\u043B\u0433\u044D\u0441\u044D\u043D \u0433\u044D\u0436 \u0442\u044D\u043C\u0434\u044D\u0433\u043B\u044D\u0445 \u04AF\u04AF?',
      cancelled: '\u0417\u0430\u0441\u0432\u0430\u0440\u044B\u043D \u0437\u0430\u0445\u0438\u0430\u043B\u0433\u0430 \u0446\u0443\u0446\u043B\u0430\u0445 \u04AF\u04AF?',
    }

    if (!confirm(confirmMessages[newStatus] || '\u0422\u04E9\u043B\u04E9\u0432 \u04E9\u04E9\u0440\u0447\u043B\u04E9\u0445 \u04AF\u04AF?')) return

    setActionLoading(true)

    try {
      const updatePayload: Record<string, unknown> = { status: newStatus }

      if (newStatus === 'completed' && !order.completed_at) {
        updatePayload.completed_at = new Date().toISOString()
      }
      if (newStatus === 'delivered' && !order.delivered_at) {
        updatePayload.delivered_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('repair_orders')
        .update(updatePayload)
        .eq('id', order.id)
        .select(`
          id, order_number, customer_id, assigned_to,
          device_type, brand, model, serial_number,
          issue_description, diagnosis, status, priority,
          estimated_cost, actual_cost, deposit_amount,
          received_at, estimated_completion, completed_at,
          delivered_at, warranty_until, notes,
          created_at, updated_at,
          customers(id, name),
          staff!repair_orders_assigned_to_fkey(id, name)
        `)
        .single()

      if (!error && data) {
        setOrder(data as unknown as RepairOrder)
      }
    } catch {
      // keep state unchanged
    }

    setActionLoading(false)
  }

  function getNextStatus(): string | null {
    if (!order) return null
    const idx = STATUS_FLOW.indexOf(order.status)
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null
    return STATUS_FLOW[idx + 1]
  }

  function startEdit() {
    if (!order) return
    setEditData({
      brand: order.brand || '',
      model: order.model || '',
      serial_number: order.serial_number || '',
      issue_description: order.issue_description || '',
      diagnosis: order.diagnosis || '',
      priority: order.priority || 'normal',
      estimated_cost: order.estimated_cost ?? '',
      actual_cost: order.actual_cost ?? '',
      deposit_amount: order.deposit_amount ?? '',
      estimated_completion: order.estimated_completion ? order.estimated_completion.slice(0, 10) : '',
      warranty_until: order.warranty_until ? order.warranty_until.slice(0, 10) : '',
      notes: order.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (editData.brand !== (order?.brand || '')) body.brand = editData.brand || null
      if (editData.model !== (order?.model || '')) body.model = editData.model || null
      if (editData.serial_number !== (order?.serial_number || '')) body.serial_number = editData.serial_number || null
      if (editData.issue_description !== (order?.issue_description || '')) body.issue_description = editData.issue_description
      if (editData.diagnosis !== (order?.diagnosis || '')) body.diagnosis = editData.diagnosis || null
      if (editData.priority !== order?.priority) body.priority = editData.priority
      if (editData.estimated_cost !== (order?.estimated_cost ?? '')) body.estimated_cost = editData.estimated_cost !== '' ? Number(editData.estimated_cost) : null
      if (editData.actual_cost !== (order?.actual_cost ?? '')) body.actual_cost = editData.actual_cost !== '' ? Number(editData.actual_cost) : null
      if (editData.deposit_amount !== (order?.deposit_amount ?? '')) body.deposit_amount = editData.deposit_amount !== '' ? Number(editData.deposit_amount) : null
      if (editData.estimated_completion !== (order?.estimated_completion ? order.estimated_completion.slice(0, 10) : '')) body.estimated_completion = editData.estimated_completion || null
      if (editData.warranty_until !== (order?.warranty_until ? order.warranty_until.slice(0, 10) : '')) body.warranty_until = editData.warranty_until || null
      if (editData.notes !== (order?.notes || '')) body.notes = editData.notes || null

      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/repair-orders/${repairId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Алдаа гарлаа')
          setSaving(false)
          return
        }
      }
      setIsEditing(false)
      load()
    } catch {
      alert('Алдаа гарлаа')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!order) return null

  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.received
  const pc = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal
  const nextStatus = getNextStatus()
  const isTerminal = ['delivered', 'cancelled'].includes(order.status)

  const balance = (order.actual_cost ?? order.estimated_cost ?? 0) - (order.deposit_amount ?? 0)
  const partsTotalCost = parts.reduce((sum, p) => sum + (p.quantity * p.unit_cost), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/repair-orders"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                \u0417\u0430\u0441\u0432\u0430\u0440\u044B\u043D \u0434\u044D\u043B\u0433\u044D\u0440\u044D\u043D\u0433\u04AF\u0439
              </h1>
              <span className="text-slate-400 font-mono text-lg">#{order.order_number}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pc.color}`}>
                {pc.label}
              </span>
              <span className="text-slate-500 text-sm">
                {formatDateTime(order.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusActions
            currentStatus={order.status}
            transitions={repairOrderTransitions}
            statusLabels={STATUS_LABELS}
            apiPath={`/api/repair-orders/${repairId}`}
            onSuccess={load}
          />
          {!isEditing ? (
            <button
              onClick={startEdit}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
            >
              Засах
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Status Flow Bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((step, i) => {
            const config = STATUS_CONFIG[step]
            const currentIdx = STATUS_FLOW.indexOf(order.status)
            const isPast = currentIdx >= 0 && i < currentIdx
            const isCurrent = step === order.status
            const isCompleted = isPast || (order.status === 'delivered' && i <= STATUS_FLOW.indexOf('delivered'))

            return (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex-1 py-2 text-center text-xs font-medium rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-slate-700/50 text-slate-500'
                  }`}
                >
                  {config.label}
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isCompleted ? '#22c55e' : '#475569'}
                    strokeWidth="2"
                    className="shrink-0 mx-0.5"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
        {order.status === 'cancelled' && (
          <div className="mt-3 text-center">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400">
              \u0426\u0443\u0446\u043B\u0430\u0433\u0434\u0441\u0430\u043D
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Device Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0422\u04E9\u0445\u04E9\u04E9\u0440\u04E9\u043C\u0436</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">\u0422\u04E9\u0440\u04E9\u043B</p>
                <p className="text-white text-sm mt-0.5">
                  {DEVICE_TYPE_LABELS[order.device_type] || order.device_type}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">\u0411\u0440\u044D\u043D\u0434</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.brand as string}
                    onChange={(e) => setEditData({...editData, brand: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white text-sm mt-0.5">{order.brand || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">\u0417\u0430\u0433\u0432\u0430\u0440</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.model as string}
                    onChange={(e) => setEditData({...editData, model: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white text-sm mt-0.5">{order.model || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">\u0421\u0435\u0440\u0438\u0439\u043D \u0434\u0443\u0433\u0430\u0430\u0440</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.serial_number as string}
                    onChange={(e) => setEditData({...editData, serial_number: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white text-sm font-mono mt-0.5">{order.serial_number || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Issue & Diagnosis */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0410\u0441\u0443\u0443\u0434\u043B \u0431\u0430 \u043E\u043D\u043E\u0448\u043B\u043E\u0433\u043E\u043E</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">\u0410\u0441\u0443\u0443\u0434\u043B\u044B\u043D \u0442\u0430\u0439\u043B\u0431\u0430\u0440</p>
                {isEditing ? (
                  <textarea
                    value={editData.issue_description as string}
                    onChange={(e) => setEditData({...editData, issue_description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {order.issue_description || '\u0422\u0430\u0439\u043B\u0431\u0430\u0440 \u043E\u0440\u0443\u0443\u043B\u0430\u0430\u0433\u04AF\u0439'}
                  </p>
                )}
              </div>
              <div className="pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-1">\u041E\u043D\u043E\u0448\u043B\u043E\u0433\u043E\u043E</p>
                {isEditing ? (
                  <textarea
                    value={editData.diagnosis as string}
                    onChange={(e) => setEditData({...editData, diagnosis: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {order.diagnosis || '\u041E\u043D\u043E\u0448\u043B\u043E\u0433\u043E\u043E \u0445\u0438\u0439\u0433\u044D\u044D\u0433\u04AF\u0439'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Financial Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0422\u04E9\u043B\u0431\u04E9\u0440</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">\u0423\u0440\u044C\u0434\u0447\u0438\u043B\u0441\u0430\u043D \u0437\u0430\u0440\u0434\u0430\u043B</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.estimated_cost as string}
                    onChange={(e) => setEditData({...editData, estimated_cost: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-lg text-white font-medium">{formatPrice(order.estimated_cost)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">\u0411\u043E\u0434\u0438\u0442 \u0437\u0430\u0440\u0434\u0430\u043B</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.actual_cost as string}
                    onChange={(e) => setEditData({...editData, actual_cost: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-lg text-white font-medium">{formatPrice(order.actual_cost)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">\u0423\u0440\u044C\u0434\u0447\u0438\u043B\u0433\u0430\u0430 \u0442\u04E9\u043B\u0431\u04E9\u0440</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.deposit_amount as string}
                    onChange={(e) => setEditData({...editData, deposit_amount: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-lg text-cyan-400 font-medium">{formatPrice(order.deposit_amount)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">\u04AE\u043B\u0434\u044D\u0433\u0434\u044D\u043B</p>
                <p className={`text-lg font-medium ${balance > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {formatPrice(balance)}
                </p>
              </div>
            </div>
            {partsTotalCost > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">\u0421\u044D\u043B\u0431\u044D\u0433\u0438\u0439\u043D \u043D\u0438\u0439\u0442 \u0437\u0430\u0440\u0434\u0430\u043B</span>
                  <span className="text-orange-400 font-medium">{formatPrice(partsTotalCost)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Parts Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">
              \u0421\u044D\u043B\u0431\u044D\u0433
              {parts.length > 0 && (
                <span className="ml-2 text-slate-400 text-sm font-normal">({parts.length})</span>
              )}
            </h3>
            {parts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-3 text-xs font-medium text-slate-400">\u041D\u044D\u0440</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-slate-400">\u041A\u043E\u0434</th>
                      <th className="text-center py-3 px-3 text-xs font-medium text-slate-400">\u0422\u043E\u043E</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-slate-400">\u041D\u044D\u0433\u0436 \u04AF\u043D\u044D</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-slate-400">\u041D\u0438\u0439\u0442</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-slate-400">\u041D\u0438\u0439\u043B\u04AF\u04AF\u043B\u044D\u0433\u0447</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((part) => (
                      <tr key={part.id} className="border-b border-slate-700/50">
                        <td className="py-3 px-3 text-sm text-white">{part.name}</td>
                        <td className="py-3 px-3 text-sm text-slate-400 font-mono">{part.part_number || '-'}</td>
                        <td className="py-3 px-3 text-sm text-slate-300 text-center">{part.quantity}</td>
                        <td className="py-3 px-3 text-sm text-slate-300 text-right">{formatPrice(part.unit_cost)}</td>
                        <td className="py-3 px-3 text-sm text-white text-right font-medium">
                          {formatPrice(part.quantity * part.unit_cost)}
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-400">{part.supplier || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-600">
                      <td colSpan={4} className="py-3 px-3 text-right text-sm text-slate-400 font-medium">
                        \u041D\u0438\u0439\u0442 \u0434\u04AF\u043D:
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-bold text-white">
                        {formatPrice(partsTotalCost)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">\u0421\u044D\u043B\u0431\u044D\u0433 \u0431\u04AF\u0440\u0442\u0433\u044D\u0433\u0434\u044D\u044D\u0433\u04AF\u0439</p>
            )}
          </div>

          {/* Notes */}
          {(order.notes || isEditing) && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">\u0422\u044D\u043C\u0434\u044D\u0433\u043B\u044D\u043B</h3>
              {isEditing ? (
                <textarea
                  value={editData.notes as string}
                  onChange={(e) => setEditData({...editData, notes: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{order.notes}</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0425\u0430\u0440\u0438\u043B\u0446\u0430\u0433\u0447</h3>
            {order.customers ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {order.customers.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{order.customers.name || '\u041D\u044D\u0440\u0433\u04AF\u0439'}</p>
                  </div>
                </div>
                <Link
                  href={`/dashboard/customers/${order.customers.id}`}
                  className="block w-full py-2 text-center text-sm text-blue-400 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all"
                >
                  \u0414\u044D\u043B\u0433\u044D\u0440\u044D\u043D\u0433\u04AF\u0439
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">\u0425\u0430\u0440\u0438\u043B\u0446\u0430\u0433\u0447 \u0441\u043E\u043D\u0433\u043E\u043E\u0433\u04AF\u0439</p>
            )}
          </div>

          {/* Technician Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0425\u0430\u0440\u0438\u0443\u0446\u0430\u0445 \u0442\u0435\u0445\u043D\u0438\u043A\u0447</h3>
            {order.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {order.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{order.staff.name}</p>
                  <p className="text-slate-400 text-xs">\u0422\u0435\u0445\u043D\u0438\u043A\u0447</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">\u0422\u0435\u0445\u043D\u0438\u043A\u0447 \u043E\u043D\u043E\u043E\u0433\u04AF\u0439</p>
            )}
          </div>

          {/* Timeline Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">\u0425\u0443\u0433\u0430\u0446\u0430\u0430</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0441\u0430\u043D</span>
                <span className="text-white">{formatDate(order.received_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">\u0422\u04E9\u043B\u04E9\u0432\u043B\u04E9\u0441\u04E9\u043D \u0434\u0443\u0443\u0441\u0433\u0430\u0445</span>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.estimated_completion as string}
                    onChange={(e) => setEditData({...editData, estimated_completion: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <span className="text-white">{formatDate(order.estimated_completion)}</span>
                )}
              </div>
              {order.completed_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">\u0414\u0443\u0443\u0441\u0441\u0430\u043D</span>
                  <span className="text-green-400">{formatDate(order.completed_at)}</span>
                </div>
              )}
              {order.delivered_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">\u0425\u04AF\u043B\u044D\u044D\u043B\u0433\u044D\u0441\u044D\u043D</span>
                  <span className="text-slate-300">{formatDate(order.delivered_at)}</span>
                </div>
              )}
              {(order.warranty_until || isEditing) && (
                <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-700">
                  <span className="text-slate-400">\u0411\u0430\u0442\u0430\u043B\u0433\u0430\u0430 \u0434\u0443\u0443\u0441\u0430\u0445</span>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editData.warranty_until as string}
                      onChange={(e) => setEditData({...editData, warranty_until: e.target.value})}
                      className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className={`font-medium ${
                      new Date(order.warranty_until!) > new Date()
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}>
                      {formatDate(order.warranty_until)}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-700">
                <span className="text-slate-400">\u04AE\u04AF\u0441\u0433\u044D\u0441\u044D\u043D</span>
                <span className="text-slate-300 text-xs">{formatDateTime(order.created_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">\u0428\u0438\u043D\u044D\u0447\u043B\u044D\u0433\u0434\u0441\u044D\u043D</span>
                <span className="text-slate-300 text-xs">{formatDateTime(order.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
