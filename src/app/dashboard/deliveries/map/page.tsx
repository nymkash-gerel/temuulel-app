'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then(m => m.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then(m => m.Popup),
  { ssr: false }
)

interface DriverLocation {
  id: string
  name: string
  phone: string
  vehicle_type: string | null
  status: string
  current_location: { lat: number; lng: number; updated_at?: string } | null
  active_deliveries: number
}

const VEHICLE_ICONS: Record<string, string> = {
  motorcycle: '🏍️',
  car: '🚗',
  bicycle: '🚲',
  on_foot: '🚶',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400',
  on_delivery: 'text-blue-400',
  offline: 'text-slate-500',
}

// Ulaanbaatar center
const UB_CENTER: [number, number] = [47.9184, 106.9177]

export default function DeliveryMapPage() {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<DriverLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState('')
  const leafletLoaded = useRef(false)
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
    if (!leafletLoaded.current) {
      leafletLoaded.current = true
      import('leaflet').then(leaflet => {
        // Fix default marker icons
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (leaflet.Icon.Default.prototype as any)._getIconUrl
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })
        setL(leaflet)
      })
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) return
      setStoreId(store.id)

      await fetchDrivers(store.id)
      setLoading(false)
    }
    load()
  }, [supabase])

  async function fetchDrivers(sid: string) {
    const { data: driverRows } = await supabase
      .from('delivery_drivers')
      .select('id, name, phone, vehicle_type, status, current_location')
      .eq('store_id', sid)
      .in('status', ['active', 'on_delivery'])

    if (!driverRows) return

    const enriched = await Promise.all(
      driverRows.map(async (d) => {
        const { count } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', d.id)
          .in('status', ['assigned', 'picked_up', 'in_transit'])

        return {
          id: d.id,
          name: d.name,
          phone: d.phone,
          vehicle_type: d.vehicle_type,
          status: d.status,
          current_location: d.current_location as DriverLocation['current_location'],
          active_deliveries: count || 0,
        }
      })
    )

    setDrivers(enriched)
  }

  // Supabase Realtime subscription for driver location updates
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel('driver-locations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_drivers',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>
          setDrivers(prev =>
            prev.map(d =>
              d.id === updated.id
                ? {
                    ...d,
                    current_location: updated.current_location as DriverLocation['current_location'],
                    status: (updated.status as string) || d.status,
                  }
                : d
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId, supabase])

  const driversWithLocation = drivers.filter(d => d.current_location?.lat && d.current_location?.lng)
  const driversWithoutLocation = drivers.filter(d => !d.current_location?.lat || !d.current_location?.lng)

  if (loading || !L) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Жолоочийн газрын зураг</h1>
          <p className="text-slate-400 mt-1">
            {driversWithLocation.length} жолооч байршилтай — {driversWithoutLocation.length} байршилгүй
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => storeId && fetchDrivers(storeId)}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Шинэчлэх
          </button>
          <Link
            href="/dashboard/deliveries"
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
          >
            Хүргэлт рүү буцах
          </Link>
        </div>
      </div>

      {/* Map */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden" style={{ height: '500px' }}>
        <MapContainer
          center={UB_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {driversWithLocation.map(driver => {
            const loc = driver.current_location!
            const icon = L.divIcon({
              className: 'driver-marker',
              html: `<div style="background:#1e293b;border:2px solid ${driver.status === 'on_delivery' ? '#3b82f6' : '#22c55e'};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${VEHICLE_ICONS[driver.vehicle_type || ''] || '🚗'}</div>`,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            })

            return (
              <Marker key={driver.id} position={[loc.lat, loc.lng]} icon={icon}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{driver.name}</p>
                    <p>{driver.phone}</p>
                    <p>Идэвхтэй хүргэлт: {driver.active_deliveries}</p>
                    {loc.updated_at && (
                      <p className="text-xs text-gray-500">
                        Сүүлд: {new Date(loc.updated_at).toLocaleTimeString('mn-MN')}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* Driver List */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map(driver => (
          <div key={driver.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{VEHICLE_ICONS[driver.vehicle_type || ''] || '🚗'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{driver.name}</p>
                <p className="text-slate-400 text-sm">{driver.phone}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-medium ${STATUS_COLORS[driver.status] || 'text-slate-400'}`}>
                  {driver.status === 'on_delivery' ? 'Хүргэлт дээр' : driver.status === 'active' ? 'Идэвхтэй' : 'Офлайн'}
                </p>
                <p className="text-slate-400 text-xs">{driver.active_deliveries} хүргэлт</p>
              </div>
            </div>
            {driver.current_location ? (
              <p className="text-slate-500 text-xs mt-2">
                📍 {driver.current_location.lat.toFixed(4)}, {driver.current_location.lng.toFixed(4)}
                {driver.current_location.updated_at && (
                  <> — {new Date(driver.current_location.updated_at).toLocaleTimeString('mn-MN')}</>
                )}
              </p>
            ) : (
              <p className="text-slate-500 text-xs mt-2">📍 Байршил тодорхойгүй</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
