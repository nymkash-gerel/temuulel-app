'use client'

import { useEffect, useRef, useState } from 'react'

interface LocationTrackerProps {
  driverStatus: string
}

export default function LocationTracker({ driverStatus }: LocationTrackerProps) {
  const [active, setActive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const shouldTrack = driverStatus === 'on_delivery' || driverStatus === 'active'
    if (!shouldTrack || !('geolocation' in navigator)) {
      setActive(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    async function sendLocation() {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: false,
          })
        })

        await fetch('/api/driver/location', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        })

        setActive(true)
      } catch {
        setActive(false)
      }
    }

    // Send immediately, then every 30s
    sendLocation()
    intervalRef.current = setInterval(sendLocation, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [driverStatus])

  if (!active) return null

  return (
    <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Байршил идэвхтэй" />
  )
}
