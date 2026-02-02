import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!invoice) notFound()

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true })

  const { data: payments } = await supabase
    .from('billing_payments')
    .select('id, payment_number, amount, method, status, paid_at')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: false })

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
        <div>
          <Link href="/dashboard/billing" className="text-sm text-slate-400 hover:text-slate-300">
            ← Нэхэмжлэл рүү буцах
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">{invoice.invoice_number}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[invoice.status] || ''}`}>
          {invoice.status}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Нийт дүн</p>
          <p className="text-xl font-bold text-white">{(invoice.total_amount || 0).toLocaleString()}₮</p>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Төлөгдсөн</p>
          <p className="text-xl font-bold text-green-400">{(invoice.amount_paid || 0).toLocaleString()}₮</p>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Үлдэгдэл</p>
          <p className="text-xl font-bold text-yellow-400">{(invoice.amount_due || 0).toLocaleString()}₮</p>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Огноо</p>
          <p className="text-sm text-white">{new Date(invoice.created_at).toLocaleDateString('mn-MN')}</p>
          {invoice.due_date && (
            <p className="text-xs text-slate-400 mt-1">Хугацаа: {new Date(invoice.due_date).toLocaleDateString('mn-MN')}</p>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-white border-b border-slate-700">Мөр бүртгэл</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-4 text-sm text-slate-400 font-medium">Тайлбар</th>
              <th className="text-right p-4 text-sm text-slate-400 font-medium">Тоо</th>
              <th className="text-right p-4 text-sm text-slate-400 font-medium">Нэгж үнэ</th>
              <th className="text-right p-4 text-sm text-slate-400 font-medium">Дүн</th>
            </tr>
          </thead>
          <tbody>
            {items?.map(item => (
              <tr key={item.id} className="border-b border-slate-700/50">
                <td className="p-4 text-sm text-white">{item.description}</td>
                <td className="p-4 text-right text-sm text-slate-300">{item.quantity}</td>
                <td className="p-4 text-right text-sm text-slate-300">{(item.unit_price || 0).toLocaleString()}₮</td>
                <td className="p-4 text-right text-sm text-white">{(item.line_total || 0).toLocaleString()}₮</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-600">
              <td colSpan={3} className="p-4 text-right text-sm text-slate-400 font-medium">Дүн:</td>
              <td className="p-4 text-right text-sm font-bold text-white">{(invoice.total_amount || 0).toLocaleString()}₮</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payments */}
      {payments && payments.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-white border-b border-slate-700">Төлбөрүүд</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-sm text-slate-400 font-medium">Дугаар</th>
                <th className="text-left p-4 text-sm text-slate-400 font-medium">Арга</th>
                <th className="text-right p-4 text-sm text-slate-400 font-medium">Дүн</th>
                <th className="text-left p-4 text-sm text-slate-400 font-medium">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-slate-700/50">
                  <td className="p-4 text-sm text-white">{p.payment_number}</td>
                  <td className="p-4 text-sm text-slate-300 capitalize">{p.method}</td>
                  <td className="p-4 text-right text-sm text-green-400">{(p.amount || 0).toLocaleString()}₮</td>
                  <td className="p-4 text-sm text-slate-400">{p.paid_at ? new Date(p.paid_at).toLocaleDateString('mn-MN') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white mb-2">Тэмдэглэл</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </div>
  )
}
