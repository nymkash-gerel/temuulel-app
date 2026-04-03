'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { exportToFile } from '@/lib/export-utils'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type Period = '7d' | '30d' | '90d' | '1y'

interface OrderData {
  id: string
  total_amount: number
  status: string
  created_at: string
}

interface MessageData {
  id: string
  is_ai_response: boolean
  is_from_customer: boolean
  created_at: string
}

interface TopProduct {
  name: string
  total_sold: number
  revenue: number
}

function formatPrice(price: number) {
  if (price >= 1000000) return (price / 1000000).toFixed(1) + 'M₮'
  if (price >= 1000) return (price / 1000).toFixed(0) + 'K₮'
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

function formatFullPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

function getDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function getPeriodDays(period: Period): number {
  switch (period) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    case '1y': return 365
  }
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.name.includes('орлого') ? formatFullPrice(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

interface Props {
  storeId: string
  messagesUsed: number
  messagesLimit: number
  customerCount: number
}

export default function AnalyticsClient({ storeId, messagesUsed, messagesLimit, customerCount }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [period, setPeriod] = useState<Period>('30d')
  const [orders, setOrders] = useState<OrderData[]>([])
  const [allOrders, setAllOrders] = useState<OrderData[]>([])
  const [messages, setMessages] = useState<MessageData[]>([])
  const [newCustomerCount, setNewCustomerCount] = useState(0)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [insights, setInsights] = useState<string[] | null>(null)
  const [insightTone, setInsightTone] = useState<'positive' | 'neutral' | 'warning'>('neutral')
  const [insightLoading, setInsightLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load period-dependent data
  useEffect(() => {
    async function loadPeriodData() {
      const days = getPeriodDays(period)
      const since = getDaysAgo(days)

      const [periodOrdersRes, allOrdersRes, msgsRes, newCustRes, topItemsRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, status, created_at').eq('store_id', storeId).gte('created_at', since).order('created_at', { ascending: true }),
        supabase.from('orders').select('id, total_amount, status, created_at').eq('store_id', storeId).order('created_at', { ascending: true }),
        supabase.from('messages').select('id, is_ai_response, is_from_customer, created_at').gte('created_at', since),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', storeId).gte('created_at', since),
        supabase.from('order_items').select('quantity, unit_price, products(name), orders!inner(store_id, status, created_at)').eq('orders.store_id', storeId).neq('orders.status', 'cancelled').gte('orders.created_at', since),
      ])

      setOrders(periodOrdersRes.data || [])
      setAllOrders(allOrdersRes.data || [])
      setMessages(msgsRes.data || [])
      setNewCustomerCount(newCustRes.count || 0)

      if (topItemsRes.data) {
        const productMap = new Map<string, { total_sold: number; revenue: number }>()
        for (const item of topItemsRes.data) {
          const name = (item.products as unknown as { name: string } | null)?.name || 'Нэргүй'
          const existing = productMap.get(name) || { total_sold: 0, revenue: 0 }
          existing.total_sold += item.quantity
          existing.revenue += item.quantity * item.unit_price
          productMap.set(name, existing)
        }
        setTopProducts(Array.from(productMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.revenue - a.revenue).slice(0, 5))
      }

      setLoading(false)
    }

    loadPeriodData()
  }, [storeId, period, supabase])

  const revenueChartData = useMemo(() => {
    const days = getPeriodDays(period)
    const bucketCount = days <= 7 ? days : days <= 30 ? days : 12
    const bucketSize = Math.ceil(days / bucketCount)
    const buckets: { label: string; revenue: number; orders: number }[] = []
    for (let i = 0; i < bucketCount; i++) {
      const start = new Date(); start.setDate(start.getDate() - days + i * bucketSize)
      const end = new Date(); end.setDate(end.getDate() - days + (i + 1) * bucketSize)
      const label = `${start.getMonth() + 1}/${start.getDate()}`
      const bucketOrders = orders.filter(o => { const d = new Date(o.created_at); return d >= start && d < end && o.status !== 'cancelled' })
      buckets.push({ label, revenue: bucketOrders.reduce((s, o) => s + Number(o.total_amount), 0), orders: bucketOrders.length })
    }
    return buckets
  }, [orders, period])

  const orderStatusData = useMemo(() => {
    const statuses = [
      { key: 'pending', label: 'Хүлээгдэж буй', color: '#eab308' },
      { key: 'confirmed', label: 'Баталгаажсан', color: '#3b82f6' },
      { key: 'processing', label: 'Бэлтгэж буй', color: '#8b5cf6' },
      { key: 'shipped', label: 'Илгээсэн', color: '#06b6d4' },
      { key: 'delivered', label: 'Хүргэсэн', color: '#10b981' },
      { key: 'cancelled', label: 'Цуцлагдсан', color: '#ef4444' },
    ]
    return statuses.map(s => ({ name: s.label, value: orders.filter(o => o.status === s.key).length, color: s.color })).filter(s => s.value > 0)
  }, [orders])

  const aiStatsData = useMemo(() => {
    const total = messages.length
    const aiResponses = messages.filter(m => m.is_ai_response).length
    const customerMsgs = messages.filter(m => m.is_from_customer).length
    const responseRate = customerMsgs > 0 ? Math.round((aiResponses / customerMsgs) * 100) : 0
    return { total, aiResponses, customerMsgs, responseRate }
  }, [messages])

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders])
  const cancelledOrders = useMemo(() => orders.filter(o => o.status === 'cancelled').length, [orders])

  const fetchInsights = useCallback(async () => {
    const validOrders = orders.filter(o => o.status !== 'cancelled')
    const revenue = validOrders.reduce((s, o) => s + Number(o.total_amount), 0)
    const count = validOrders.length
    if (revenue === 0 && count === 0 && messages.length === 0) { setInsights(null); return }
    const cacheKey = `insights_${period}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { try { const parsed = JSON.parse(cached); setInsights(parsed.insights); setInsightTone(parsed.tone); return } catch { /* ignore */ } }
    setInsightLoading(true)
    try {
      const avg = count > 0 ? Math.round(revenue / count) : 0
      const customerMsgs = messages.filter(m => m.is_from_customer).length
      const aiResponses = messages.filter(m => m.is_ai_response).length
      const responseRate = customerMsgs > 0 ? Math.round((aiResponses / customerMsgs) * 100) : 0
      const days = getPeriodDays(period)
      const prevStart = new Date(getDaysAgo(days * 2)); const prevEnd = new Date(getDaysAgo(days))
      const prevRevenue = allOrders.filter(o => { const d = new Date(o.created_at); return d >= prevStart && d < prevEnd && o.status !== 'cancelled' }).reduce((s, o) => s + Number(o.total_amount), 0)
      const revChange = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : revenue > 0 ? 100 : 0
      const res = await fetch('/api/analytics/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period, revenue, revenueChange: revChange, orderCount: count, avgOrderValue: avg, newCustomers: newCustomerCount, totalCustomers: customerCount, topProducts: topProducts.map(p => ({ name: p.name, quantity: p.total_sold, revenue: p.revenue })), aiResponseRate: responseRate, totalMessages: messages.length, pendingOrders, cancelledOrders }) })
      if (!res.ok) { setInsights(null); return }
      const data = await res.json()
      if (data.insights) { setInsights(data.insights); setInsightTone(data.tone || 'neutral'); sessionStorage.setItem(cacheKey, JSON.stringify({ insights: data.insights, tone: data.tone || 'neutral' })) } else { setInsights(null) }
    } catch { setInsights(null) }
    finally { setInsightLoading(false) }
  }, [orders, allOrders, messages, period, topProducts, newCustomerCount, customerCount, pendingOrders, cancelledOrders])

  useEffect(() => { if (!loading) fetchInsights() }, [loading, fetchInsights])

  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0)
  const orderCount = orders.filter(o => o.status !== 'cancelled').length
  const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0

  const prevPeriodRevenue = useMemo(() => {
    const days = getPeriodDays(period)
    const prevStart = getDaysAgo(days * 2); const prevEnd = getDaysAgo(days)
    return allOrders.filter(o => { const d = new Date(o.created_at); return d >= new Date(prevStart) && d < new Date(prevEnd) && o.status !== 'cancelled' }).reduce((s, o) => s + Number(o.total_amount), 0)
  }, [allOrders, period])

  const revenueChange = prevPeriodRevenue > 0 ? Math.round(((totalRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100) : totalRevenue > 0 ? 100 : 0

  const handleExport = (format: 'xlsx' | 'csv') => {
    exportToFile(revenueChartData.map(d => ({ 'Огноо': d.label, 'Орлого': d.revenue, 'Захиалга тоо': d.orders })), 'tailar', format, 'Тайлан')
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-white">Тайлан</h1><p className="text-slate-400 mt-1">Борлуулалт болон AI ашиглалтын статистик</p></div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleExport('xlsx')} className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-xl transition-all flex items-center gap-2 text-sm"><span>📥</span><span>Excel</span></button>
          <button onClick={() => handleExport('csv')} className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-xl transition-all flex items-center gap-2 text-sm"><span>📄</span><span>CSV</span></button>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="px-4 py-2.5 bg-white/[0.06] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all">
            <option value="7d">Сүүлийн 7 хоног</option><option value="30d">Сүүлийн 30 хоног</option><option value="90d">Сүүлийн 90 хоног</option><option value="1y">Сүүлийн жил</option>
          </select>
        </div>
      </div>

      {(insightLoading || insights) && (
        <div className={`mb-8 rounded-2xl p-6 border ${insightTone === 'positive' ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20' : insightTone === 'warning' ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20'}`}>
          <div className="flex items-center gap-3 mb-4"><span className="text-2xl">{insightTone === 'positive' ? '✨' : insightTone === 'warning' ? '⚠️' : '💡'}</span><h3 className="text-lg font-semibold text-white">AI Дүгнэлт</h3></div>
          {insightLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-4 bg-white/[0.04] rounded-lg animate-pulse" style={{ width: `${85 - i * 10}%` }} />)}</div> : <ul className="space-y-2">{insights!.map((line, i) => <li key={i} className="flex items-start gap-2 text-slate-200 text-sm"><span className="text-slate-400 mt-0.5">•</span><span>{line}</span></li>)}</ul>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><span className="text-slate-400 text-sm">Нийт орлого</span><span className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center"><span className="text-xl">💰</span></span></div><p className="text-3xl font-bold text-white">{formatFullPrice(totalRevenue)}</p><p className={`text-sm mt-2 ${revenueChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{revenueChange >= 0 ? '+' : ''}{revenueChange}% өмнөх үеэс</p></div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><span className="text-slate-400 text-sm">Захиалга</span><span className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center"><span className="text-xl">🛒</span></span></div><p className="text-3xl font-bold text-white">{orderCount}</p><p className="text-slate-400 text-sm mt-2">Дундаж: {formatFullPrice(avgOrderValue)}</p></div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><span className="text-slate-400 text-sm">Шинэ харилцагч</span><span className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center"><span className="text-xl">👥</span></span></div><p className="text-3xl font-bold text-white">{newCustomerCount}</p><p className="text-slate-400 text-sm mt-2">Нийт: {customerCount}</p></div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><span className="text-slate-400 text-sm">AI мессеж</span><span className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center"><span className="text-xl">🤖</span></span></div><p className="text-3xl font-bold text-white">{messagesUsed}<span className="text-sm font-normal text-slate-500">/{messagesLimit}</span></p><div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${Math.min(100, (messagesUsed / messagesLimit) * 100)}%` }} /></div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><h3 className="text-lg font-semibold text-white mb-4">Орлого</h3>{revenueChartData.some(d => d.revenue > 0) ? <ResponsiveContainer width="100%" height={280}><AreaChart data={revenueChartData}><defs><linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => formatPrice(v)} /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="revenue" name="Нийт орлого" stroke="#3b82f6" fill="url(#revenueGradient)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="h-[280px] flex items-center justify-center border border-dashed border-white/[0.08] rounded-xl"><div className="text-center"><span className="text-4xl">📊</span><p className="text-slate-400 mt-2">Өгөгдөл байхгүй</p></div></div>}</div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><h3 className="text-lg font-semibold text-white mb-4">Захиалга</h3>{revenueChartData.some(d => d.orders > 0) ? <ResponsiveContainer width="100%" height={280}><BarChart data={revenueChartData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="orders" name="Захиалга" fill="#06b6d4" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="h-[280px] flex items-center justify-center border border-dashed border-white/[0.08] rounded-xl"><div className="text-center"><span className="text-4xl">📈</span><p className="text-slate-400 mt-2">Өгөгдөл байхгүй</p></div></div>}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6"><div className="flex items-center gap-3 mb-6"><span className="text-2xl">🤖</span><h3 className="text-lg font-semibold text-white">AI Chatbot Статистик</h3></div><div className="grid grid-cols-2 gap-4"><div className="bg-white/[0.03] rounded-xl p-4"><p className="text-slate-400 text-sm">Нийт мессеж</p><p className="text-2xl font-bold text-white mt-1">{aiStatsData.total}</p></div><div className="bg-white/[0.03] rounded-xl p-4"><p className="text-slate-400 text-sm">AI хариулт</p><p className="text-2xl font-bold text-white mt-1">{aiStatsData.aiResponses}</p></div><div className="bg-white/[0.03] rounded-xl p-4"><p className="text-slate-400 text-sm">Харилцагч мессеж</p><p className="text-2xl font-bold text-white mt-1">{aiStatsData.customerMsgs}</p></div><div className="bg-white/[0.03] rounded-xl p-4"><p className="text-slate-400 text-sm">Хариулт хувь</p><p className="text-2xl font-bold text-white mt-1">{aiStatsData.responseRate}%</p></div></div></div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><h3 className="text-lg font-semibold text-white mb-4">Захиалгын статус</h3>{orderStatusData.length > 0 ? <div className="flex items-center gap-6"><ResponsiveContainer width="50%" height={200}><PieChart><Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">{orderStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="space-y-2">{orderStatusData.map((entry, i) => <div key={i} className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} /><span className="text-slate-300 text-sm">{entry.name}</span><span className="text-white text-sm font-medium">{entry.value}</span></div>)}</div></div> : <div className="h-[200px] flex items-center justify-center border border-dashed border-white/[0.08] rounded-xl"><div className="text-center"><span className="text-3xl">🥧</span><p className="text-slate-400 mt-2 text-sm">Захиалга байхгүй</p></div></div>}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><h3 className="text-lg font-semibold text-white mb-4">Шилдэг бүтээгдэхүүн</h3>{topProducts.length > 0 ? <div className="space-y-3">{topProducts.map((product, i) => <div key={i} className="flex items-center gap-4 p-3 bg-slate-700/20 rounded-xl"><div className="w-8 h-8 bg-white/[0.06] rounded-lg flex items-center justify-center text-white font-bold text-sm">{i + 1}</div><div className="flex-1"><p className="text-white text-sm font-medium">{product.name}</p><p className="text-slate-400 text-xs">{product.total_sold} ширхэг зарагдсан</p></div><span className="text-white font-medium text-sm">{formatFullPrice(product.revenue)}</span></div>)}</div> : <div className="text-center py-8"><span className="text-3xl">📦</span><p className="text-slate-400 mt-2">Борлуулалт байхгүй</p><Link href="/dashboard/products/new" className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg transition-all text-sm">Бүтээгдэхүүн нэмэх</Link></div>}</div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"><h3 className="text-lg font-semibold text-white mb-4">Мессежийн статистик</h3>{messages.length > 0 ? <ResponsiveContainer width="100%" height={250}><BarChart data={[{ name: 'Харилцагч', value: aiStatsData.customerMsgs, fill: '#8b5cf6' },{ name: 'AI хариулт', value: aiStatsData.aiResponses, fill: '#06b6d4' },{ name: 'Админ', value: aiStatsData.total - aiStatsData.aiResponses - aiStatsData.customerMsgs, fill: '#3b82f6' }].filter(d => d.value > 0)} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} /><YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} width={90} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" name="Тоо" radius={[0, 4, 4, 0]}>{[{ fill: '#8b5cf6' },{ fill: '#06b6d4' },{ fill: '#3b82f6' }].map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer> : <div className="text-center py-8"><span className="text-3xl">💬</span><p className="text-slate-400 mt-2">Мессеж байхгүй</p><p className="text-slate-500 text-sm mt-1">Чатбот ажиллаж эхэлсний дараа харагдана</p></div>}</div>
      </div>
    </div>
  )
}
