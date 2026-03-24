import { createClient } from '@/lib/supabase/server'
import { resolveStore } from '@/lib/resolve-store'
import Image from 'next/image'
import Link from 'next/link'
import DeleteProductButton from '@/components/DeleteProductButton'

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get user's store
  const store = await resolveStore(supabase, user?.id || '')

  const storeId = store?.id ?? ''

  // Get products with variants
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      product_variants(*)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  // Get subscription for limits
  const { data: subscription } = await supabase
    .from('store_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('store_id', storeId)
    .single()

  const productLimit = (subscription?.subscription_plans?.limits as Record<string, number> | undefined)?.products || 20
  const productCount = products?.length || 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Бүтээгдэхүүн</h1>
          <p className="text-slate-400 mt-1">
            {productCount}/{productLimit === -1 ? '∞' : productLimit} бүтээгдэхүүн
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/products/import"
            className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm sm:text-base"
          >
            <span>📥</span>
            <span className="hidden sm:inline">Олноор оруулах</span>
            <span className="sm:hidden">Оруулах</span>
          </Link>
          <Link
            href="/dashboard/products/new"
            className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all flex items-center gap-2 text-sm sm:text-base"
          >
            <span>➕</span>
            <span>Нэмэх</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Бүтээгдэхүүн хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
              <option value="">Бүх ангилал</option>
              <option value="clothing">Хувцас</option>
              <option value="shoes">Гутал</option>
              <option value="bags">Цүнх</option>
              <option value="accessories">Гоёл чимэглэл</option>
            </select>
            <select className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
              <option value="">Бүх төлөв</option>
              <option value="active">Идэвхтэй</option>
              <option value="draft">Ноорог</option>
              <option value="archived">Архив</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid/Table */}
      {products && products.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Бүтээгдэхүүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Ангилал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үнэ</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нөөц</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const totalStock = product.product_variants?.reduce((sum: number, v: { stock_quantity: number }) => sum + (v.stock_quantity || 0), 0) || 0
                const minPrice = product.product_variants?.length > 0
                  ? Math.min(...product.product_variants.map((v: { price: number }) => v.price))
                  : product.base_price

                return (
                  <tr key={product.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {(product.images as string[])?.[0] ? (
                            <Image src={(product.images as string[])[0]} alt={product.name} width={48} height={48} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">📦</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{product.name}</p>
                          <p className="text-slate-400 text-sm">SKU: {product.sku || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300">
                        {product.category || 'Ангилалгүй'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-white">
                      {Number(minPrice).toLocaleString()}₮
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`${totalStock > 10 ? 'text-green-400' : totalStock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {totalStock} ширхэг
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        product.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : product.status === 'draft'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {product.status === 'active' ? 'Идэвхтэй' : product.status === 'draft' ? 'Ноорог' : 'Архив'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                        >
                          ✏️
                        </Link>
                        <DeleteProductButton productId={product.id} productName={product.name} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📦</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Бүтээгдэхүүн байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Эхний бүтээгдэхүүнээ нэмж, AI chatbot-оор борлуулалтаа эхлүүлээрэй
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard/products/import"
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2"
            >
              <span>📥</span>
              <span>Excel-ээс оруулах</span>
            </Link>
            <Link
              href="/dashboard/products/new"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all flex items-center gap-2"
            >
              <span>➕</span>
              <span>Шинээр нэмэх</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
