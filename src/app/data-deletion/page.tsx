import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Өгөгдөл устгах хүсэлт | Data Deletion | Temuulel',
  description: 'Temuulel платформоос өөрийн мэдээллийг устгах хүсэлт илгээх заавар.',
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <span className="text-white font-bold text-xl">TEMUULEL</span>
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">Нууцлал</Link>
              <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">Нөхцөл</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12 text-center">
          <div className="text-6xl mb-4">🗑️</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Өгөгдөл устгах хүсэлт
          </h1>
          <p className="text-slate-400 text-lg">Data Deletion Request</p>
          <p className="text-slate-500 text-sm mt-2">
            Сүүлд шинэчилсэн / Last updated: 2026-04-17
          </p>
        </div>

        <div className="space-y-8">
          {/* For end users */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              🧑 Жирийн хэрэглэгч (Facebook/Instagram-аар чатласан)
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Хэрэв та Temuulel-ийн үйлчлэгч бизнестэй Facebook Messenger эсвэл
                Instagram DM-ээр чатласан бол, таны мессеж, утас, нэр зэрэг
                мэдээллийг устгахыг хүсэж болно.
              </p>

              <h3 className="text-white font-medium mt-4">2 арга:</h3>

              <div className="bg-slate-900/50 rounded-xl p-4 mt-2">
                <h4 className="text-white font-medium mb-2">📧 Арга 1: Имэйлээр</h4>
                <p className="text-sm">
                  <a href="mailto:privacy@temuulel.com" className="text-blue-400 hover:underline">privacy@temuulel.com</a>
                  {' '}хаяг руу дараах мэдээллийг илгээнэ үү:
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>Таны Facebook/Instagram нэр</li>
                  <li>Харилцсан бизнесийн нэр (жишээ: &quot;Монгол Маркет&quot;)</li>
                  <li>Утасны дугаар (хэрэв өгсөн бол)</li>
                  <li>Гарчиг: <strong className="text-white">&quot;Data Deletion Request&quot;</strong></li>
                </ul>
                <p className="text-sm mt-2">
                  Бид <strong className="text-white">30 хоногийн дотор</strong> таны мэдээллийг устгаж,
                  баталгаажуулсан имэйл илгээнэ.
                </p>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4 mt-3">
                <h4 className="text-white font-medium mb-2">💬 Арга 2: Харилцсан бизнестээ шууд бичих</h4>
                <p className="text-sm">
                  Таны мэдээллийг хариуцаж буй бизнест (дэлгүүр/ресторан гэх мэт)
                  шууд бичиж &quot;Миний мэдээллийг устгана уу&quot; гэж хүсэж болно.
                  Тэд өөрсдийн dashboard-аас устгана.
                </p>
              </div>
            </div>
          </section>

          {/* For business owners */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              🏪 Бизнес эзэмшигч (Temuulel dashboard хэрэглэгч)
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Өөрийн Temuulel дансыг бүрэн устгах бол:
              </p>

              <div className="bg-slate-900/50 rounded-xl p-4 mt-2">
                <h4 className="text-white font-medium mb-2">
                  🔧 Dashboard-аас шууд устгах
                </h4>
                <ol className="list-decimal list-inside text-sm space-y-2">
                  <li>
                    <Link href="/dashboard/settings" className="text-blue-400 hover:underline">
                      Dashboard → Settings
                    </Link>{' '}
                    руу нэвтэр
                  </li>
                  <li>Доод талд &quot;Дансыг устгах&quot; / &quot;Delete Account&quot; хэсгийг ол</li>
                  <li>&quot;TEMUULEL DELETE&quot; гэж бичиж баталгаажуул</li>
                  <li>
                    <strong className="text-red-400">
                      Анхаар: Энэ нь дэлгүүр, бүтээгдэхүүн, захиалга, чатын түүх бүгдийг
                      бүрмөсөн устгана.
                    </strong>
                  </li>
                </ol>
                <p className="text-sm mt-3">
                  Устгалт <strong className="text-white">24 цагийн дотор</strong> гүйцэтгэгдэнэ.
                  Санхүүгийн бүртгэл (захиалгын quarterly report-д нөлөөлдөг) нь Монгол Улсын
                  татварын хуулийн дагуу <strong className="text-white">3-7 жил хадгалагдана</strong>,
                  гэхдээ анонимчилагдсан хэлбэрт.
                </p>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4 mt-3">
                <h4 className="text-white font-medium mb-2">📧 Эсвэл имэйлээр</h4>
                <p className="text-sm">
                  <a href="mailto:support@temuulel.com" className="text-blue-400 hover:underline">support@temuulel.com</a>
                  {' '}рүү дансныхаа имэйлээс &quot;Delete My Account&quot; гарчигтай хүсэлт илгээнэ үү.
                </p>
              </div>
            </div>
          </section>

          {/* For Facebook users */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              📘 Facebook Login хэрэглэгч
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Хэрэв та Facebook-ээр Temuulel-д нэвтэрсэн бол:
              </p>
              <ol className="list-decimal list-inside text-sm space-y-1">
                <li>
                  Facebook-д очиж{' '}
                  <strong className="text-white">Settings → Apps and Websites → Active</strong>{' '}
                  хэсгийг нээ
                </li>
                <li>
                  &quot;Temuulel&quot; app-г ол → <strong className="text-white">Remove</strong> дар
                </li>
                <li>
                  Facebook автоматаар манай систем руу <em>deletion callback</em> явуулж,
                  таны бүх мэдээлэл устана
                </li>
              </ol>
              <p className="text-sm mt-3">
                Callback URL-ийг бид өөрийн webhook дээр боловсруулж, 30 хоногийн дотор устгаж,
                баталгаажуулах код ба URL буцаана.
              </p>
            </div>
          </section>

          {/* Callback URL for Facebook */}
          <section className="bg-gradient-to-br from-blue-600/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              🔗 Facebook/Meta-д зориулсан: Data Deletion Callback URL
            </h2>
            <div className="text-slate-300 space-y-2 text-sm">
              <p>
                Facebook App Review-д шаардагдах Data Deletion Callback URL:
              </p>
              <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs md:text-sm break-all text-emerald-400">
                {`${(process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.com').replace(/\/$/, '')}/api/data-deletion`}
              </div>
              <p className="text-slate-400 mt-3">
                Хэрэглэгч Facebook-ийн App Settings-ээс манай app-ыг устгахад энэ endpoint-руу
                signed request ирнэ. Бид confirmation code ба status URL буцаана.
              </p>
            </div>
          </section>

          {/* Data types */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              📋 Юу устгагдах вэ?
            </h2>
            <ul className="text-slate-300 text-sm space-y-1 list-disc list-inside">
              <li>Хэрэглэгчийн нэр, утас, имэйл, хаяг</li>
              <li>Facebook/Instagram profile ID ба тэдгээрээс авсан нэр/зураг</li>
              <li>Чатын түүх (бүх мессеж, зураг, дуу бичлэг)</li>
              <li>Захиалгын түүх (санхүүгийн тайлангийн шаардлагаас бусад)</li>
              <li>AI бэлтгэлд ашиглагдсан хувийн өгөгдөл</li>
              <li>Web Push subscription, device ID-ууд</li>
              <li>Analytics-д байсан бүх event</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-4">Холбоо барих</h2>
            <p className="text-slate-300 text-sm mb-4">
              Асуулт эсвэл тусламж шаардлагатай бол:
            </p>
            <a
              href="mailto:privacy@temuulel.com"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all"
            >
              privacy@temuulel.com
            </a>
            <p className="text-slate-500 text-xs mt-3">Хариу хүлээх хугацаа: 3 ажлын өдөр</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← Нүүр хуудас руу буцах
          </Link>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-blue-400 hover:underline text-sm">Нууцлал</Link>
            <Link href="/terms" className="text-blue-400 hover:underline text-sm">Үйлчилгээний нөхцөл</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
