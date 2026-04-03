'use client'

import { useRef, useEffect, type ReactNode } from 'react'
import VanillaTilt from 'vanilla-tilt'

/**
 * vanilla-tilt.js 3D card with glare effect.
 * 3kb library — smooth tilt + glare shine on hover.
 */
export function VanillaTiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    VanillaTilt.init(el, {
      max: 12,
      speed: 400,
      glare: true,
      'max-glare': 0.15,
      scale: 1.03,
    })

    return () => {
      (el as HTMLDivElement & { vanillaTilt?: { destroy: () => void } }).vanillaTilt?.destroy()
    }
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
