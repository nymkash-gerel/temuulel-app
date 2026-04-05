import Link from 'next/link'

const columns = [
  {
    title: 'Бүтээгдэхүүн',
    links: [
      { label: 'AI Chatbot', href: '#features' },
      { label: 'Захиалга', href: '#features' },
      { label: 'Хүргэлт', href: '#features' },
      { label: 'Аналитик', href: '#features' },
    ],
  },
  {
    title: 'Компани',
    links: [
      { label: 'Тухай', href: '#' },
      { label: 'Холбоо барих', href: '#' },
      { label: 'Нөхцөл', href: '#' },
    ],
  },
  {
    title: 'Нөөц',
    links: [
      { label: 'Баримтжуулалт', href: '#' },
      { label: 'Үнийн хүснэгт', href: '#pricing' },
      { label: 'Туршилт', href: '#demo' },
    ],
  },
]

export default function VercelFooter() {
  return (
    <footer className="border-t border-zinc-900 bg-black">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* Logo col */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 19.5h20L12 2z" fill="white" />
              </svg>
              <span className="text-[14px] font-semibold">Temuulel</span>
            </Link>
            <p className="mt-3 text-[12px] text-zinc-600 leading-relaxed">
              AI-аар тоноглогдсон<br />
              ecommerce платформ
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col, i) => (
            <div key={i}>
              <p className="text-[12px] font-medium text-zinc-400 mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link, j) => (
                  <li key={j}>
                    <Link href={link.href} className="text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-700">
            &copy; 2026 Temuulel Commerce
          </p>
          <div className="flex items-center gap-4">
            <a href="https://facebook.com" className="text-zinc-700 hover:text-zinc-400 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            </a>
            <a href="https://instagram.com" className="text-zinc-700 hover:text-zinc-400 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
