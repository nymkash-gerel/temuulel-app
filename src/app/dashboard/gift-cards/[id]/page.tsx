'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface GiftCardCustomer {
  id: string
  name: string | null
  phone: string | null
}

interface GiftCard {
  id: string
  store_id: string
  code: string
  initial_balance: number
  current_balance: number
  customer_id: string | null
  status: string
  expires_at: string | null
  created_at: string
  updated_at: string
  customers: GiftCardCustomer | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
  redeemed: { label: 'Redeemed', color: 'bg-blue-500/20 text-blue-400' },
  expired: { label: 'Expired', color: 'bg-slate-500/20 text-slate-400' },
  disabled: { label: 'Disabled', color: 'bg-red-500/20 text-red-400' },
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

export default function GiftCardDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const cardId = params.id as string

  const [card, setCard] = useState<GiftCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editStatus, setEditStatus] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editNotes, setEditNotes] = useState('')

  async function loadCard() {
    try {
      const res = await fetch(`/api/gift-cards/${cardId}`)
      if (res.ok) {
        const data = await res.json()
        setCard(data)
      } else {
        router.push('/dashboard/gift-cards')
        return
      }
    } catch {
      router.push('/dashboard/gift-cards')
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

      await loadCard()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  function startEdit() {
    if (!card) return
    setEditStatus(card.status)
    setEditExpiresAt(card.expires_at ? card.expires_at.slice(0, 10) : '')
    setEditNotes('')
    setIsEditing(true)
  }

  async function handleSave() {
    if (!card) return
    setSaving(true)

    try {
      const changed: Record<string, unknown> = {}

      if (editStatus !== card.status) changed.status = editStatus

      const origExpires = card.expires_at ? card.expires_at.slice(0, 10) : ''
      if (editExpiresAt !== origExpires) {
        changed.expires_at = editExpiresAt || null
      }

      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/gift-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (res.ok) {
        setIsEditing(false)
        await loadCard()
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

  if (!card) return null

  const sc = STATUS_CONFIG[card.status] || STATUS_CONFIG.active
  const usedAmount = card.initial_balance - card.current_balance
  const usedPercent = card.initial_balance > 0
    ? Math.round((usedAmount / card.initial_balance) * 100)
    : 0
  const remainingPercent = 100 - usedPercent
  const isExpired = card.expires_at && new Date(card.expires_at) < new Date()

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/gift-cards"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white font-mono">
                {card.code}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">Gift Card Detail</p>
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

      {/* Balance Visual Display */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <h3 className="text-white font-medium mb-4">Balance</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-slate-700/30 rounded-xl">
            <p className="text-2xl font-bold text-white">{formatPrice(card.initial_balance)}</p>
            <p className="text-slate-400 text-sm mt-1">Original Balance</p>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-xl">
            <p className="text-2xl font-bold text-yellow-400">{formatPrice(usedAmount)}</p>
            <p className="text-slate-400 text-sm mt-1">Used</p>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-xl">
            <p className={`text-2xl font-bold ${card.current_balance > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPrice(card.current_balance)}
            </p>
            <p className="text-slate-400 text-sm mt-1">Current Balance</p>
          </div>
        </div>
        {/* Visual bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>0%</span>
            <span>{remainingPercent}% remaining</span>
            <span>100%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                remainingPercent > 50 ? 'bg-green-500' : remainingPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${remainingPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Card Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Card Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Code</span>
              <span className="text-white font-mono font-medium">{card.code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Status</span>
              {isEditing ? (
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="redeemed">Redeemed</option>
                  <option value="expired">Expired</option>
                  <option value="disabled">Disabled</option>
                </select>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Active &rarr; Redeemed &rarr; Expired &rarr; Disabled
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Customer</h3>
          {card.customers ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {card.customers.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{card.customers.name || 'Unknown'}</p>
                {card.customers.phone && (
                  <p className="text-slate-400 text-sm">{card.customers.phone}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No customer assigned</p>
          )}
        </div>

        {/* Expiry Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Expiry</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Expires</span>
              {isEditing ? (
                <input
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-white">
                  {card.expires_at ? formatDate(card.expires_at) : 'No expiry'}
                </span>
              )}
            </div>
            {isExpired && card.status !== 'expired' && (
              <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs font-medium">This card has passed its expiry date</p>
              </div>
            )}
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
            placeholder="Add notes..."
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
          />
        ) : (
          <p className="text-slate-300 text-sm">No notes</p>
        )}
      </div>

      {/* Timestamps */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-medium mb-4">Timestamps</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Created</span>
            <span className="text-slate-300">{formatDateTime(card.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Updated</span>
            <span className="text-slate-300">{formatDateTime(card.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
