'use client'

export interface KpiCard {
  label: string
  value: string | number
  color?: string // tailwind bg class for the card, e.g. 'bg-blue-500/10 border-blue-500/20 text-blue-400'
  icon?: string
}

interface KpiCardsProps {
  cards: KpiCard[]
}

const DEFAULT_COLORS = [
  'bg-blue-500/10 border-blue-500/20',
  'bg-green-500/10 border-green-500/20',
  'bg-purple-500/10 border-purple-500/20',
  'bg-orange-500/10 border-orange-500/20',
  'bg-cyan-500/10 border-cyan-500/20',
  'bg-pink-500/10 border-pink-500/20',
]

const DEFAULT_TEXT_COLORS = [
  'text-blue-400',
  'text-green-400',
  'text-purple-400',
  'text-orange-400',
  'text-cyan-400',
  'text-pink-400',
]

export default function KpiCards({ cards }: KpiCardsProps) {
  if (cards.length === 0) return null

  const cols = cards.length <= 3 ? `grid-cols-${cards.length}` : cards.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'

  return (
    <div className={`grid ${cols} gap-4 mb-6`}>
      {cards.map((card, idx) => {
        const bgColor = card.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
        const textColor = DEFAULT_TEXT_COLORS[idx % DEFAULT_TEXT_COLORS.length]

        return (
          <div
            key={card.label}
            className={`${bgColor} border rounded-xl p-4 text-center`}
          >
            {card.icon && <span className="text-2xl mb-1 block">{card.icon}</span>}
            <p className={`text-2xl font-bold ${card.color ? '' : textColor}`}>{card.value}</p>
            <p className="text-sm text-slate-400 mt-1">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
