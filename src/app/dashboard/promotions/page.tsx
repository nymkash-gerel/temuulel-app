import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PromotionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!store) redirect('/login')

  const { data: promotions } = await supabase
    .from('promotions')
    .select('id, name, description, promo_type, discount_type, discount_value, is_active, start_date, end_date, usage_count, max_usage, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const promoTypeLabels: Record<string, string> = {
    item_discount: 'Бүтээгдэхүүний хөнгөлөлт',
    order_discount: 'Захиалгын хөнгөлөлт',
    bogo: 'Нэг авбал нэг үнэгүй',
    combo: 'Комбо',
    free_item: 'Үнэгүй бүтээгдэхүүн',
    loyalty: 'Үнэнч байдал',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Урамшуулал</h1>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-4 text-sm text-slate-400 font-medium">Нэр</th>
              <th className="text-left p-4 text-sm text-slate-400 font-medium hidden md:table-cell">Төрөл</th>
              <th className="text-left p-4 text-sm text-slate-400 font-medium">Хөнгөлөлт</th>
              <th className="text-center p-4 text-sm text-slate-400 font-medium">Статус</th>
              <th className="text-right p-4 text-sm text-slate-400 font-medium hidden md:table-cell">Ашиглалт</th>
            </tr>
          </thead>
          <tbody>
            {promotions?.map(promo => (
              <tr key={promo.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="p-4">
                  <p className="text-sm text-white font-medium">{promo.name}</p>
                  {promo.description && <p className="text-xs text-slate-400 mt-1">{promo.description}</p>}
                </td>
                <td className="p-4 text-sm text-slate-300 hidden md:table-cell">{promoTypeLabels[promo.promo_type] || promo.promo_type}</td>
                <td className="p-4 text-sm text-white">
                  {promo.discount_type === 'percent' ? `${promo.discount_value}%` : promo.discount_type === 'fixed' ? `${(promo.discount_value || 0).toLocaleString()}₮` : 'Үнэгүй'}
                </td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${promo.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-500'}`}>
                    {promo.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                  </span>
                </td>
                <td className="p-4 text-right text-sm text-slate-400 hidden md:table-cell">
                  {promo.usage_count}{promo.max_usage ? `/${promo.max_usage}` : ''}
                </td>
              </tr>
            ))}
            {(!promotions || promotions.length === 0) && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Урамшуулал байхгүй байна
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
