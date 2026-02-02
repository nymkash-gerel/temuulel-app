import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="text-8xl font-bold text-slate-700 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Хуудас олдсонгүй</h1>
        <p className="text-slate-400 mb-6">
          Таны хайсан хуудас олдсонгүй. Хаяг зөв эсэхийг шалгана уу.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Нүүр хуудас
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Хянах самбар
          </Link>
        </div>
      </div>
    </div>
  )
}
