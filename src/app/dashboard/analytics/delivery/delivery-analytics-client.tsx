'use client'

import { useEffect, useState } from 'react'
import { exportToFile } from '@/lib/export-utils'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface AnalyticsData {
  summary: {
    total: number
    delivered: number
    failed: number
    cancelled: number
    successRate: number
    avgDeliveryMinutes: number
    activeDrivers: number
  }
  statusDistribution: { status: string; count: number }[]
  dailyDeliveries: { date: string; count: number }[]
  hourlyDistribution: { hour: number; label: string; count: number }[]
  driverRankings: { name: string; deliveries: number; avgRating: number; ratingCount: number }[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  assigned: 'Оноогдсон',
  picked_up: 'Авсан',
  in_transit: 'Зам дээр',
  delivered: 'Хүргэсэн',
  failed: 'Амжилтгүй',
  cancelled: 'Цуцлагдсан',
  delayed: 'Хоцорсон',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#eab308',
  assigned: '#3b82f6',
  picked_up: '#6366f1',
  in_transit: '#a855f7',
  delivered: '#22c55e',
  failed: '#ef4444',
  cancelled: '#64748b',
  delayed: '#f97316',
}

const PERIODS = [
  { value: '7d', label: '7 хоног' },
  { value: '30d', label: '30 хоног' },
  { value: '90d', label: '90 хоног' },
]

export default function DeliveryAnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    let cancelled = false

    fetch(`/api/analytics/delivery?period=${period}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [period])

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!data) return
    const exportData = data.dailyDeliveries.map(d => ({
      'Огноо': new Date(d.date).toLocaleDateString('mn-MN'),
      'Хүргэлт тоо': d.count,
    }))
    exportToFile(exportData, 'hurguelt-tailan', format, 'Хүргэлт тайлан')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { summary, statusDistribution, dailyDeliveries, hourlyDistribution, driverRankings } = data

  const pieData = statusDistribution.map(s => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || '#64748b',
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Хүргэлтийн аналитик</h1>
          <p className="text-slate-400 mt-1">Хүргэлтийн гүйцэтгэл, жолоочийн ажиллагаа</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => handleExport('xlsx')} className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📥</span><span>Excel</span>
          </button>
          <button onClick={() => handleExport('csv')} className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-xl transition-all flex items-center gap-2 text-sm">
            <span>📄</span><span>CSV</span>
          </button>
          {/* Period Toggle */}
          <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-slate-400 text-sm">Нийт хүргэлт</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.total}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-slate-400 text-sm">Амжилтын хувь</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{summary.successRate}%</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-slate-400 text-sm">Дундаж хугацаа</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{summary.avgDeliveryMinutes} мин</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-slate-400 text-sm">Идэвхтэй жолооч</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{summary.activeDrivers}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Deliveries Chart */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Өдрийн хүргэлт</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyDeliveries}>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.split('-').slice(1).join('/')}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
                labelFormatter={(v) => new Date(v).toLocaleDateString('mn-MN')}
              />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f680" name="Хүргэлт" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Төлвийн тархалт</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Цагийн тархалт</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourlyDistribution}>
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                interval={2}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
              <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} name="Хүргэлт" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Driver Rankings */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Жолоочийн гүйцэтгэл</h3>
          {driverRankings.length > 0 ? (
            <div className="space-y-3">
              {driverRankings.map((driver, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      i === 1 ? 'bg-slate-500/20 text-slate-300' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/[0.04] text-slate-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-white text-sm font-medium">{driver.name}</p>
                      {driver.ratingCount > 0 && (
                        <p className="text-yellow-400 text-xs">
                          {'★'.repeat(Math.round(driver.avgRating))} {driver.avgRating.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-300 text-sm font-medium">{driver.deliveries} хүргэлт</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Хүргэлт байхгүй</p>
          )}
        </div>
      </div>
    </div>
  )
}
