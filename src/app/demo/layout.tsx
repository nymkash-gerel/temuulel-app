import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Flow Demo — Temuulel',
  description: 'Бизнесийн автомат чат flow-ууд туршиж үзэх. Ресторан, эмнэлэг, салон, кофе шоп болон бусад салбаруудын flow загварууд.',
  openGraph: {
    title: 'Flow Demo — Temuulel',
    description: 'Бизнесийн автомат чат flow-ууд туршиж үзэх',
    type: 'website',
  },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
