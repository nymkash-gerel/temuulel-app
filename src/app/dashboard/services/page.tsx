'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveStoreId } from '@/lib/resolve-store'
import { formatPrice } from '@/lib/format'

interface Service {
  id: string
  name: string
  description: string | null
  category: string | null
  duration_minutes: number
  base_price: number
  status: string
  images: string[]
  created_at: string
}

export default function ServicesPage() {
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [_storeId, setStoreId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    const loadServices = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const storeId = await resolveStoreId(supabase, user.id)
      const store = storeId ? { id: storeId } : null

      if (!store) return
      setStoreId(store.id)

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setServices(data as Service[])
      }
      setLoading(false)
    }

    loadServices()
  }, [])

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.category?.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || service.status === statusFilter
    return matchesSearch && matchesStatus
  })


  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} мин`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} цаг ${mins} мин` : `${hours} цаг`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">Идэвхтэй</span>
      case 'draft':
        return <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">Ноорог</span>
      case 'archived':
        return <span className="px-2 py-1 text-xs bg-slate-500/20 text-slate-400 rounded-full">Архивлагдсан</span>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Үйлчилгээ</h1>
          <p className="text-slate-400 mt-1">Нийт {services.length} үйлчилгээ</p>
        </div>
        <Link
          href="/dashboard/services/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Үйлчилгээ нэмэх
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Хайх..."
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
        >
          <option value="all">Бүх төлөв</option>
          <option value="active">Идэвхтэй</option>
          <option value="draft">Ноорог</option>
          <option value="archived">Архивлагдсан</option>
        </select>
      </div>

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💅</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {searchTerm || statusFilter !== 'all' ? 'Илэрц олдсонгүй' : 'Үйлчилгээ байхгүй'}
          </h3>
          <p className="text-slate-400 mb-6">
            {searchTerm || statusFilter !== 'all'
              ? 'Хайлтын үр дүнд тохирох үйлчилгээ олдсонгүй.'
              : 'Эхний үйлчилгээгээ нэмж эхлээрэй.'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Link
              href="/dashboard/services/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
            >
              <span>+</span> Үйлчилгээ нэмэх
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <Link
              key={service.id}
              href={`/dashboard/services/${service.id}`}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-pink-500/50 transition-all group"
            >
              {/* Image */}
              {service.images && service.images.length > 0 ? (
                <div className="w-full h-32 rounded-xl overflow-hidden mb-4 bg-slate-700">
                  <img
                    src={service.images[0]}
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              ) : (
                <div className="w-full h-32 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center mb-4">
                  <span className="text-4xl">💅</span>
                </div>
              )}

              {/* Info */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-white group-hover:text-pink-400 transition-colors">
                  {service.name}
                </h3>
                {getStatusBadge(service.status)}
              </div>

              {service.category && (
                <p className="text-sm text-slate-400 mb-3">{service.category}</p>
              )}

              {/* Price & Duration */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                <span className="text-pink-400 font-bold">{formatPrice(service.base_price)}</span>
                <span className="text-slate-400 text-sm">{formatDuration(service.duration_minutes)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
