'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface SupplierRow {
  id: string
  store_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  payment_terms: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface NewSupplier {
  name: string
  contact_name: string
  email: string
  phone: string
  payment_terms: string
}

const PAYMENT_TERMS_OPTIONS = [
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'prepaid', label: 'Prepaid' },
]

export default function SuppliersPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewSupplier>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    payment_terms: 'net_30',
  })

  const loadSuppliers = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('store_id', sid)
      .order('name', { ascending: true })

    if (data) {
      setSuppliers(data as unknown as SupplierRow[])
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        await loadSuppliers(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadSuppliers])

  const stats = useMemo(() => {
    const total = suppliers.length
    const active = suppliers.filter(s => s.is_active).length
    return { total, active }
  }, [suppliers])

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(q))
    )
  }, [suppliers, search])

  function formatPaymentTerms(terms: string) {
    const found = PAYMENT_TERMS_OPTIONS.find(o => o.value === terms)
    return found ? found.label : terms
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('suppliers')
        .insert({
          store_id: storeId,
          name: form.name,
          contact_name: form.contact_name || null,
          email: form.email || null,
          phone: form.phone || null,
          payment_terms: form.payment_terms,
        })

      if (insertError) throw insertError

      await loadSuppliers(storeId)
      setShowForm(false)
      setForm({ name: '', contact_name: '', email: '', phone: '', payment_terms: 'net_30' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="text-slate-400 mt-1">
            {suppliers.length} suppliers total
            {filtered.length !== suppliers.length && ` (${filtered.length} shown)`}
          </p>
        </div>
        <Link
          href="/dashboard/suppliers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Add Supplier
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Suppliers</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active Suppliers</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Inactive Suppliers</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total - stats.active}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Active Rate</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Add New Supplier</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Supplier Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. ABC Trading LLC"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Contact Name</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. supplier@email.com"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +976 9911 2233"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Payment Terms</label>
                <select
                  value={form.payment_terms}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                >
                  {PAYMENT_TERMS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Supplier'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Search Suppliers</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or contact..."
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
          />
        </div>
        {search && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setSearch('')}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Contact</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Email</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Phone</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Payment Terms</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((supplier) => (
                <tr key={supplier.id} onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{supplier.name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">{supplier.contact_name || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    {supplier.email ? (
                      <a href={`mailto:${supplier.email}`} className="text-pink-400 hover:text-pink-300 transition-all">
                        {supplier.email}
                      </a>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">{supplier.phone || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300">{formatPaymentTerms(supplier.payment_terms)}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      supplier.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {supplier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : suppliers.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No suppliers match your search</p>
          <button
            onClick={() => setSearch('')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128666;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Suppliers Yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Add your product suppliers to manage purchase orders and track deliveries.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Add First Supplier
          </button>
        </div>
      )}
    </div>
  )
}
