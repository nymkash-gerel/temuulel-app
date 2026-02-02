import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MenuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!store) redirect('/login')

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name, description, is_active, sort_order')
    .eq('store_id', store.id)
    .order('sort_order', { ascending: true })

  const { data: products } = await supabase
    .from('products')
    .select('id, name, base_price, status, menu_category_id, images')
    .eq('store_id', store.id)
    .eq('status', 'active')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Меню</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/products/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
            + Бүтээгдэхүүн нэмэх
          </Link>
        </div>
      </div>

      {/* Categories */}
      {categories?.map(category => {
        const categoryProducts = products?.filter(p => p.menu_category_id === category.id) || []
        return (
          <div key={category.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{category.name}</h2>
                {category.description && <p className="text-sm text-slate-400">{category.description}</p>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${category.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {category.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
              </span>
            </div>
            <div className="divide-y divide-slate-700/50">
              {categoryProducts.map(product => (
                <Link key={product.id} href={`/dashboard/products/${product.id}`} className="flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors">
                  <span className="text-sm text-white">{product.name}</span>
                  <span className="text-sm text-slate-400">{(product.base_price || 0).toLocaleString()}₮</span>
                </Link>
              ))}
              {categoryProducts.length === 0 && (
                <p className="p-4 text-sm text-slate-500">Бүтээгдэхүүн байхгүй</p>
              )}
            </div>
          </div>
        )
      })}

      {/* Uncategorized products */}
      {(() => {
        const uncategorized = products?.filter(p => !p.menu_category_id) || []
        if (uncategorized.length === 0) return null
        return (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Ангилалгүй</h2>
            </div>
            <div className="divide-y divide-slate-700/50">
              {uncategorized.map(product => (
                <Link key={product.id} href={`/dashboard/products/${product.id}`} className="flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors">
                  <span className="text-sm text-white">{product.name}</span>
                  <span className="text-sm text-slate-400">{(product.base_price || 0).toLocaleString()}₮</span>
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

      {(!categories || categories.length === 0) && (!products || products.length === 0) && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg">Меню хоосон байна</p>
          <p className="text-sm mt-2">Бүтээгдэхүүн нэмж эхлээрэй</p>
        </div>
      )}
    </div>
  )
}
