'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Lease {
  id: string
  store_id: string
  unit_id: string | null
  tenant_name: string
  tenant_phone: string | null
  tenant_email: string | null
  lease_start: string
  lease_end: string | null
  monthly_rent: number
  deposit_amount: number | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/20 text-slate-400' },
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
  expired: { label: 'Expired', color: 'bg-yellow-500/20 text-yellow-400' },
  terminated: { label: 'Terminated', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number | null): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LeaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const leaseId = params.id as string

  const [lease, setLease] = useState<Lease | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editTenantName, setEditTenantName] = useState('')
  const [editTenantPhone, setEditTenantPhone] = useState('')
  const [editTenantEmail, setEditTenantEmail] = useState('')
  const [editLeaseStart, setEditLeaseStart] = useState('')
  const [editLeaseEnd, setEditLeaseEnd] = useState('')
  const [editMonthlyRent, setEditMonthlyRent] = useState('')
  const [editDepositAmount, setEditDepositAmount] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')

  async function loadLease() {
    try {
      const res = await fetch(`/api/leases/${leaseId}`)
      if (res.ok) {
        const data = await res.json()
        setLease(data)
      } else {
        router.push('/dashboard/leases')
        return
      }
    } catch {
      router.push('/dashboard/leases')
      return
    }
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }

      await loadLease()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId])

  function startEdit() {
    if (!lease) return
    setEditTenantName(lease.tenant_name)
    setEditTenantPhone(lease.tenant_phone || '')
    setEditTenantEmail(lease.tenant_email || '')
    setEditLeaseStart(lease.lease_start ? lease.lease_start.slice(0, 10) : '')
    setEditLeaseEnd(lease.lease_end ? lease.lease_end.slice(0, 10) : '')
    setEditMonthlyRent(String(lease.monthly_rent))
    setEditDepositAmount(lease.deposit_amount !== null ? String(lease.deposit_amount) : '')
    setEditStatus(lease.status)
    setEditNotes(lease.notes || '')
    setIsEditing(true)
  }

  async function handleSave() {
    if (!lease) return
    setSaving(true)

    try {
      const changed: Record<string, unknown> = {}

      if (editTenantName !== lease.tenant_name) changed.tenant_name = editTenantName
      if ((editTenantPhone || null) !== (lease.tenant_phone || null)) changed.tenant_phone = editTenantPhone || null
      if ((editTenantEmail || null) !== (lease.tenant_email || null)) changed.tenant_email = editTenantEmail || null

      const origStart = lease.lease_start ? lease.lease_start.slice(0, 10) : ''
      if (editLeaseStart !== origStart) changed.lease_start = editLeaseStart || null

      const origEnd = lease.lease_end ? lease.lease_end.slice(0, 10) : ''
      if (editLeaseEnd !== origEnd) changed.lease_end = editLeaseEnd || null

      if (parseFloat(editMonthlyRent) !== lease.monthly_rent) changed.monthly_rent = parseFloat(editMonthlyRent)

      const newDeposit = editDepositAmount ? parseFloat(editDepositAmount) : null
      if (newDeposit !== lease.deposit_amount) changed.deposit_amount = newDeposit

      if (editStatus !== lease.status) changed.status = editStatus
      if ((editNotes || null) !== (lease.notes || null)) changed.notes = editNotes || null

      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/leases/${lease.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (res.ok) {
        setIsEditing(false)
        await loadLease()
      } else {
        alert('Failed to save changes')
      }
    } catch {
      alert('Failed to save changes')
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

  if (!lease) return null

  const sc = STATUS_CONFIG[lease.status] || STATUS_CONFIG.active

  // Calculate lease duration
  const startDate = new Date(lease.lease_start)
  const endDate = lease.lease_end ? new Date(lease.lease_end) : null
  const now = new Date()
  const isExpired = endDate && endDate < now && lease.status === 'active'

  let durationText = 'Open-ended'
  if (endDate) {
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
    durationText = months > 0 ? `${months} month${months !== 1 ? 's' : ''}` : 'Less than 1 month'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/leases"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {lease.tenant_name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">Lease Detail</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {saving ? '...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Expired Warning */}
      {isExpired && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm font-medium">This lease has passed its end date and may need renewal or termination.</p>
        </div>
      )}

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Tenant Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Tenant Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Name</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editTenantName}
                  onChange={(e) => setEditTenantName(e.target.value)}
                  className="w-48 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-white font-medium">{lease.tenant_name}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Phone</span>
              {isEditing ? (
                <input
                  type="tel"
                  value={editTenantPhone}
                  onChange={(e) => setEditTenantPhone(e.target.value)}
                  placeholder="+976 ..."
                  className="w-48 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              ) : (
                <span className="text-white">{lease.tenant_phone || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email</span>
              {isEditing ? (
                <input
                  type="email"
                  value={editTenantEmail}
                  onChange={(e) => setEditTenantEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-48 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              ) : (
                <span className="text-white">{lease.tenant_email || '-'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Lease Dates */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Lease Period</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Start Date</span>
              {isEditing ? (
                <input
                  type="date"
                  value={editLeaseStart}
                  onChange={(e) => setEditLeaseStart(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-white">{formatDate(lease.lease_start)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">End Date</span>
              {isEditing ? (
                <input
                  type="date"
                  value={editLeaseEnd}
                  onChange={(e) => setEditLeaseEnd(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-white">{lease.lease_end ? formatDate(lease.lease_end) : 'Open-ended'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Duration</span>
              <span className="text-slate-300">{durationText}</span>
            </div>
            {lease.unit_id && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <span className="text-slate-400">Unit</span>
                <span className="text-white font-mono text-xs">{lease.unit_id.slice(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Financial</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Monthly Rent</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editMonthlyRent}
                  onChange={(e) => setEditMonthlyRent(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-36 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-white font-medium">{formatPrice(lease.monthly_rent)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Deposit Amount</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editDepositAmount}
                  onChange={(e) => setEditDepositAmount(e.target.value)}
                  placeholder="Optional"
                  min="0"
                  step="0.01"
                  className="w-36 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              ) : (
                <span className="text-white">{lease.deposit_amount !== null ? formatPrice(lease.deposit_amount) : '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Status</span>
              {isEditing ? (
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Draft &rarr; Active &rarr; Expired &rarr; Terminated
            </div>
          </div>

          {/* Monthly rent highlight */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-3xl font-bold text-white">{formatPrice(lease.monthly_rent)}</p>
            <p className="text-slate-400 text-sm mt-1">Monthly Rent</p>
          </div>
        </div>
      </div>

      {/* Notes Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <h3 className="text-white font-medium mb-4">Notes</h3>
        {isEditing ? (
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={4}
            placeholder="Add notes about this lease..."
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
          />
        ) : (
          <p className="text-slate-300 text-sm">
            {lease.notes || 'No notes'}
          </p>
        )}
      </div>

      {/* Timestamps */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-medium mb-4">Timestamps</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Created</span>
            <span className="text-slate-300">{formatDateTime(lease.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Updated</span>
            <span className="text-slate-300">{formatDateTime(lease.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
