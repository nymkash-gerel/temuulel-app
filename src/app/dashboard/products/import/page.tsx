'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { readExcelFile } from '@/lib/export-utils'

interface ProductRow {
  name: string
  description?: string
  category?: string
  subcategory?: string
  sku?: string
  price: number
  stock: number
  size?: string
  color?: string
  image?: string
  facebook_post_id?: string
  instagram_post_id?: string
}

export default function ImportProductsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [storeId, setStoreId] = useState<string>('')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    const getStoreId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .single()
        if (store) setStoreId(store.id)
      }
    }
    getStoreId()
  }, [])

  const parseCSV = (text: string): ProductRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows: ProductRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const row: Record<string, string> = {}

      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })

      if (row.name) {
        rows.push({
          name: row.name,
          description: row.description || row.тайлбар || '',
          category: row.category || row.ангилал || '',
          subcategory: row.subcategory || row['дэд ангилал'] || row['дэд_ангилал'] || '',
          sku: row.sku || row.код || '',
          price: parseFloat(row.price || row.үнэ || '0') || 0,
          stock: parseInt(row.stock || row.нөөц || row.тоо || '0') || 0,
          size: row.size || row.хэмжээ || '',
          color: row.color || row.өнгө || '',
          image: row.image || row.зураг || row.image_url || '',
          facebook_post_id: row.facebook_post_id || row['facebook post id'] || '',
          instagram_post_id: row.instagram_post_id || row['instagram post id'] || '',
        })
      }
    }

    return rows
  }

  const parseExcel = async (data: ArrayBuffer): Promise<ProductRow[]> => {
    const jsonData = await readExcelFile(data)

    return jsonData.map((row) => ({
      name: String(row['name'] || row['нэр'] || row['Name'] || ''),
      description: String(row['description'] || row['тайлбар'] || ''),
      category: String(row['category'] || row['ангилал'] || ''),
      subcategory: String(row['subcategory'] || row['дэд ангилал'] || row['дэд_ангилал'] || ''),
      sku: String(row['sku'] || row['SKU'] || row['код'] || ''),
      price: parseFloat(String(row['price'] || row['үнэ'] || '0')) || 0,
      stock: parseInt(String(row['stock'] || row['нөөц'] || row['тоо'] || '0')) || 0,
      size: String(row['size'] || row['хэмжээ'] || ''),
      color: String(row['color'] || row['өнгө'] || ''),
      image: String(row['image'] || row['зураг'] || row['image_url'] || ''),
      facebook_post_id: String(row['facebook_post_id'] || row['facebook post id'] || ''),
      instagram_post_id: String(row['instagram_post_id'] || row['instagram post id'] || ''),
    })).filter(p => p.name)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError('')
    setSuccess('')

    const reader = new FileReader()
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    reader.onload = async (event) => {
      if (isExcel) {
        const data = event.target?.result as ArrayBuffer
        const parsed = await parseExcel(data)
        setProducts(parsed)
      } else {
        const text = event.target?.result as string
        const parsed = parseCSV(text)
        setProducts(parsed)
      }
    }

    if (isExcel) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  }

  const handleImport = async () => {
    if (products.length === 0) {
      setError('Оруулах бүтээгдэхүүн байхгүй')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    let successCount = 0
    let errorCount = 0
    const newProductIds: string[] = []

    for (const product of products) {
      try {
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name: product.name,
            description: product.description || null,
            category: product.category || null,
            subcategory: product.subcategory || null,
            sku: product.sku || null,
            base_price: product.price,
            images: product.image ? [product.image] : [],
            status: 'draft',
            has_variants: !!(product.size || product.color),
            facebook_post_id: product.facebook_post_id || null,
            instagram_post_id: product.instagram_post_id || null,
          })
          .select()
          .single()

        if (productError) {
          errorCount++
          continue
        }

        await supabase.from('product_variants').insert({
          product_id: newProduct.id,
          price: product.price,
          stock_quantity: product.stock,
          size: product.size || null,
          color: product.color || null,
          sku: product.sku || null,
        })

        newProductIds.push(newProduct.id)
        successCount++
      } catch {
        errorCount++
      }
    }

    // Fire-and-forget AI enrichment for all imported products
    if (newProductIds.length > 0) {
      fetch('/api/products/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: newProductIds }),
      }).catch(() => {})
    }

    setLoading(false)
    setSuccess(`${successCount} бүтээгдэхүүн амжилттай орлоо`)
    if (errorCount > 0) {
      setError(`${errorCount} бүтээгдэхүүн алдаатай`)
    }

    if (successCount > 0) {
      setTimeout(() => router.push('/dashboard/products'), 2000)
    }
  }

  const sampleCSV = `name,description,category,price,stock,size,color,facebook_post_id,instagram_post_id
Эмэгтэй цамц,Зуны цамц,clothing,25000,10,M,Цагаан,123456789_987654321,17895695668004550
Эрэгтэй өмд,Хөнгөн өмд,clothing,45000,5,L,Хар,,
Гар цүнх,Арьсан цүнх,bags,89000,3,,Бор,,`

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/products" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Олноор оруулах</h1>
          <p className="text-slate-400 mt-1">Excel/CSV файлаас бүтээгдэхүүн оруулах</p>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">{error}</div>}
      {success && <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Excel/CSV файл оруулах</h2>

          <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center mb-4">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <p className="text-white font-medium">{fileName || 'Excel/CSV файл сонгох'}</p>
              <p className="text-slate-400 text-sm mt-1">Click to upload</p>
            </label>
          </div>

          {products.length > 0 && (
            <div className="mb-4 p-4 bg-slate-700/30 rounded-xl">
              <p className="text-white">{products.length} бүтээгдэхүүн уншигдлаа</p>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={loading || products.length === 0}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loading ? 'Оруулж байна...' : `${products.length} бүтээгдэхүүн оруулах`}
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Excel/CSV формат</h2>
          <p className="text-slate-400 text-sm mb-4">Дараах багана байх ёстой:</p>
          <ul className="text-sm text-slate-300 space-y-1 mb-4">
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">name</code> - Нэр (заавал)</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">price</code> - Үнэ (заавал)</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">stock</code> - Нөөц</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">category</code> - Ангилал</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">description</code> - Тайлбар</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">size</code> - Хэмжээ</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">color</code> - Өнгө</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">facebook_post_id</code> - Facebook Post ID</li>
            <li><code className="bg-slate-700 px-2 py-0.5 rounded">instagram_post_id</code> - Instagram Post ID</li>
          </ul>

          <p className="text-slate-400 text-sm mb-2">Жишээ:</p>
          <pre className="bg-slate-900 p-4 rounded-xl text-xs text-slate-300 overflow-x-auto">{sampleCSV}</pre>

          <button
            onClick={() => {
              const blob = new Blob([sampleCSV], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'sample_products.csv'
              a.click()
            }}
            className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm"
          >
            Жишээ файл татах
          </button>
        </div>
      </div>

      {products.length > 0 && (
        <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-white font-medium">Урьдчилан харах</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Нэр</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Ангилал</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Үнэ</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Нөөц</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Хэмжээ</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Өнгө</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 10).map((p, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="py-3 px-4 text-white">{p.name}</td>
                    <td className="py-3 px-4 text-slate-300">{p.category}</td>
                    <td className="py-3 px-4 text-white">{p.price.toLocaleString()}₮</td>
                    <td className="py-3 px-4 text-slate-300">{p.stock}</td>
                    <td className="py-3 px-4 text-slate-300">{p.size || '-'}</td>
                    <td className="py-3 px-4 text-slate-300">{p.color || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
