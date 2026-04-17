import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ code?: string }>
}

export default async function DeletionStatusPage({ searchParams }: PageProps) {
  const { code } = await searchParams

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-3">
          Өгөгдөл устгах хүсэлт хүлээн авлаа
        </h1>
        <p className="text-slate-400 mb-6">
          Таны хүсэлтийг амжилттай хүлээн авлаа. 30 хоногийн дотор бүх
          мэдээлэл бүрмөсөн устгагдана.
        </p>

        {code && (
          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-500 mb-1">Баталгаажуулах код:</p>
            <p className="font-mono text-sm text-emerald-400 break-all">{code}</p>
          </div>
        )}

        <p className="text-xs text-slate-500 mb-6">
          Асуулт гарвал{' '}
          <a href="mailto:privacy@temuulel.com" className="text-blue-400 hover:underline">
            privacy@temuulel.com
          </a>{' '}
          хаягаар энэ кодыг дурдан холбогдоно уу.
        </p>

        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
        >
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  )
}
