'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface District {
  name: string
  abbr: string
  lat: number
  lng: number
  radius: number // visual size
}

const UB_DISTRICTS: District[] = [
  { name: 'Сүхбаатар',       abbr: 'СБД', lat: 47.9139, lng: 106.8994, radius: 2200 },
  { name: 'Чингэлтэй',       abbr: 'ЧД',  lat: 47.9368, lng: 106.9214, radius: 2800 },
  { name: 'Баянгол',         abbr: 'БГД', lat: 47.8923, lng: 106.8312, radius: 3200 },
  { name: 'Хан-Уул',         abbr: 'ХУД', lat: 47.8692, lng: 106.9098, radius: 3600 },
  { name: 'Баянзүрх',        abbr: 'БЗД', lat: 47.9154, lng: 106.9763, radius: 3800 },
  { name: 'Сонгинохайрхан',  abbr: 'СХД', lat: 47.9387, lng: 106.7706, radius: 4200 },
]

interface Props {
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function DeliveryZoneMap({ selected, onChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circlesRef = useRef<Map<string, any>>(new Map())

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        center: [47.9045, 106.8863],
        zoom: 11,
        zoomControl: true,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      mapInstanceRef.current = map

      // Draw district circles
      UB_DISTRICTS.forEach((district) => {
        const isSelected = selected.includes(district.name)
        const circle = L.circle([district.lat, district.lng], {
          radius: district.radius,
          color: isSelected ? '#10b981' : '#475569',
          fillColor: isSelected ? '#10b981' : '#475569',
          fillOpacity: isSelected ? 0.35 : 0.18,
          weight: isSelected ? 2 : 1.5,
          className: 'district-circle',
        }).addTo(map)

        // Tooltip label
        circle.bindTooltip(district.name, {
          permanent: true,
          direction: 'center',
          className: 'district-label',
          offset: [0, 0],
        })

        // Click handler — toggle selection
        circle.on('click', () => {
          const currentSelected: string[] = []
          circlesRef.current.forEach((c, name) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const options = (c as any).options
            if (options.fillOpacity > 0.2) currentSelected.push(name)
          })

          const idx = currentSelected.indexOf(district.name)
          let newSelected: string[]
          if (idx >= 0) {
            newSelected = currentSelected.filter((n) => n !== district.name)
            circle.setStyle({
              color: '#475569',
              fillColor: '#475569',
              fillOpacity: 0.18,
              weight: 1.5,
            })
          } else {
            newSelected = [...currentSelected, district.name]
            circle.setStyle({
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.35,
              weight: 2,
            })
          }
          onChange(newSelected)
        })

        circle.getElement()?.setAttribute('style', 'cursor: pointer')
        circlesRef.current.set(district.name, circle)
      })
    })

    // Inject tooltip CSS
    const style = document.createElement('style')
    style.textContent = `
      .district-label {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        font-size: 11px;
        font-weight: 600;
        color: #f1f5f9;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        white-space: nowrap;
      }
      .district-circle { cursor: pointer !important; }
    `
    document.head.appendChild(style)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        circlesRef.current.clear()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only

  // Sync circle styles when `selected` prop changes externally
  useEffect(() => {
    circlesRef.current.forEach((circle, name) => {
      const isSelected = selected.includes(name)
      circle.setStyle({
        color: isSelected ? '#10b981' : '#475569',
        fillColor: isSelected ? '#10b981' : '#475569',
        fillOpacity: isSelected ? 0.35 : 0.18,
        weight: isSelected ? 2 : 1.5,
      })
    })
  }, [selected])

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="w-full rounded-xl overflow-hidden border border-slate-600"
        style={{ height: 340 }}
      />
      {/* Quick-select buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(UB_DISTRICTS.map((d) => d.name))}
          className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-all"
        >
          Бүгдийг сонгох
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="px-3 py-1.5 text-xs bg-slate-700 text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-600 transition-all"
        >
          Цэвэрлэх
        </button>
        {UB_DISTRICTS.map((d) => {
          const on = selected.includes(d.name)
          return (
            <button
              key={d.name}
              type="button"
              onClick={() =>
                onChange(
                  on ? selected.filter((n) => n !== d.name) : [...selected, d.name]
                )
              }
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                on
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
              }`}
            >
              {d.abbr}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-slate-500">
        Газрын зураг дээр дүүрэгт дарж сонгох, эсвэл дээрх товчлуур ашиглана уу
      </p>
    </div>
  )
}
