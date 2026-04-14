'use client'

interface OrderProgressBarProps {
  status: string
}

const STEPS = [
  { key: 'pending', label: 'Хүлээгдэж байна', icon: '⏳' },
  { key: 'confirmed', label: 'Баталгаажсан', icon: '✅' },
  { key: 'preparing', label: 'Бэлтгэж байна', icon: '📦' },
  { key: 'shipping', label: 'Хүргэж байна', icon: '🚚' },
  { key: 'delivered', label: 'Хүргэгдсэн', icon: '🎉' },
]

const CANCELLED_STATUSES = new Set(['cancelled', 'refunded', 'returned'])

export function OrderProgressBar({ status }: OrderProgressBarProps) {
  if (CANCELLED_STATUSES.has(status)) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
        <span className="text-red-400 font-medium">❌ {status === 'cancelled' ? 'Цуцалсан' : status === 'refunded' ? 'Буцаагдсан' : 'Буцаалт хийгдсэн'}</span>
      </div>
    )
  }

  const currentIdx = Math.max(0, STEPS.findIndex(s => s.key === status))
  const progressPercent = ((currentIdx + 1) / STEPS.length) * 100

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {/* Steps */}
      <div className="grid grid-cols-5 gap-1">
        {STEPS.map((step, i) => {
          const done = i <= currentIdx
          const active = i === currentIdx
          return (
            <div key={step.key} className="text-center">
              <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'
              } ${active ? 'ring-2 ring-emerald-400 animate-pulse' : ''}`}>
                {step.icon}
              </div>
              <p className={`text-[10px] mt-1 ${done ? 'text-slate-300' : 'text-slate-600'}`}>{step.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
