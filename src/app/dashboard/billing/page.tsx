import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function BillingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/login')

  // Fetch invoice stats
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, party_type, status, total_amount, amount_paid, amount_due, due_date, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const stats = {
    total: invoices?.length || 0,
    draft: invoices?.filter(i => i.status === 'draft').length || 0,
    sent: invoices?.filter(i => i.status === 'sent').length || 0,
    paid: invoices?.filter(i => i.status === 'paid').length || 0,
    overdue: invoices?.filter(i => i.status === 'overdue').length || 0,
    totalRevenue: invoices?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0) || 0,
    totalOutstanding: invoices?.filter(i => !['paid', 'cancelled', 'refunded'].includes(i.status)).reduce((s, i) => s + (i.amount_due || 0), 0) || 0,
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/20 text-slate-400',
    sent: 'bg-blue-500/20 text-blue-400',
    paid: 'bg-green-500/20 text-green-400',
    partial: 'bg-yellow-500/20 text-yellow-400',
    overdue: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-slate-500/20 text-slate-500',
    refunded: 'bg-purple-500/20 text-purple-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Нэхэмжлэл</h1>
        <Link
          href="/dashboard/billing/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          + Шинэ нэхэмжлэл
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Нийт</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Төлөгдсөн</p>
          <p className="text-2xl font-bold text-green-400">{stats.paid}</p>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Нийт орлого</p>
          <p className="text-2xl font-bold text-white">{stats.totalRevenue.toLocaleString()}₮</p>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Үлдэгдэл</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.totalOutstanding.toLocaleString()}₮</p>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-4 text-sm text-slate-400 font-medium">Дугаар</th>
              <th className="text-left p-4 text-sm text-slate-400 font-medium hidden md:table-cell">Төрөл</th>
              <th className="text-left p-4 text-sm text-slate-400 font-medium">Статус</th>
              <th className="text-right p-4 text-sm text-slate-400 font-medium">Дүн</th>
              <th className="text-right p-4 text-sm text-slate-400 font-medium hidden md:table-cell">Үлдэгдэл</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map(invoice => (
              <tr key={invoice.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="p-4">
                  <Link href={`/dashboard/billing/${invoice.id}`} className="text-blue-400 hover:text-blue-300">
                    {invoice.invoice_number}
                  </Link>
                </td>
                <td className="p-4 text-sm text-slate-300 capitalize hidden md:table-cell">{invoice.party_type}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status] || ''}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="p-4 text-right text-sm text-white">{(invoice.total_amount || 0).toLocaleString()}₮</td>
                <td className="p-4 text-right text-sm text-slate-400 hidden md:table-cell">{(invoice.amount_due || 0).toLocaleString()}₮</td>
              </tr>
            ))}
            {(!invoices || invoices.length === 0) && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Нэхэмжлэл байхгүй байна
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
