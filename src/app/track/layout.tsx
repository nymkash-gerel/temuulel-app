import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Хүргэлт хянах — Temuulel',
  description: 'Хүргэлтийн явцыг бодит цагаар хянах',
}

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Minimal header */}
      <header className="bg-slate-800/95 border-b border-slate-700 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-sm">
            📦
          </div>
          <h1 className="text-white font-semibold text-sm">Temuulel — Хүргэлт хянах</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
