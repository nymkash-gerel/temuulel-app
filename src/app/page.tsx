import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <span className="text-white font-bold text-xl">TEMUULEL</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
              >
                Бүртгүүлэх
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-8">
            <span>✨</span>
            <span>AI-ААР ТОНОГЛОГДСОН ПЛАТФОРМ</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            Цахим худалдааны<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              ухаалаг туслах
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Таны онлайн бизнесийг 24/7 ухаалаг туслахаар автоматжуулна.
            Хэрэглэгч бүрт хүрч ажиллана.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all text-lg flex items-center gap-2"
            >
              <span>🚀</span>
              <span>Үнэгүй эхлэх</span>
            </Link>
            <Link
              href="#demo"
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl transition-all text-lg flex items-center gap-2"
            >
              <span>▶️</span>
              <span>Туршиж үзэх</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">✨ Гол боломжууд</h2>
            <p className="text-slate-400">Таны бизнесийг дараагийн түвшинд гаргах</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🤖', title: 'AI Chatbot', desc: '24/7 автомат хариулагч' },
              { icon: '📦', title: 'Бараа бүртгэл', desc: 'AI-аар автомат ангилах' },
              { icon: '💬', title: 'Олон суваг', desc: 'Messenger, Instagram, WhatsApp' },
              { icon: '📊', title: 'Шууд тайлан', desc: 'Борлуулалтаа бодит цагт хянах' },
              { icon: '🛒', title: 'Орхисон сагс', desc: 'Автомат сануулга илгээх' },
              { icon: '🌐', title: '100% Монгол', desc: 'Монгол хэрэглэгчдэд зориулсан' },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-slate-800/30" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">💰 Үнийн хүснэгт</h2>
            <p className="text-slate-400">Таны бизнест тохирох план</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: '0', messages: '500', products: '20', users: '1', popular: false },
              { name: 'Basic', price: '49,000', messages: '15,000', products: '300', users: '3', popular: true },
              { name: 'Pro', price: '99,000', messages: '50,000', products: 'Unlimited', users: '10', popular: false },
              { name: 'Enterprise', price: '249,000', messages: '200,000', products: 'Unlimited', users: 'Unlimited', popular: false },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative bg-slate-800/50 border rounded-2xl p-6 ${
                  plan.popular ? 'border-blue-500' : 'border-slate-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                    ⭐ Түгээмэл
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">{plan.price}₮</span>
                  <span className="text-slate-400">/сар</span>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-slate-300 text-sm">
                    <span className="text-green-400">✓</span>
                    {plan.messages} AI мессеж
                  </li>
                  <li className="flex items-center gap-2 text-slate-300 text-sm">
                    <span className="text-green-400">✓</span>
                    {plan.products} бүтээгдэхүүн
                  </li>
                  <li className="flex items-center gap-2 text-slate-300 text-sm">
                    <span className="text-green-400">✓</span>
                    {plan.users} хэрэглэгч
                  </li>
                </ul>
                <Link
                  href="/signup"
                  className={`block w-full py-3 text-center rounded-xl font-medium transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  Эхлэх
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Өнөөдрөөс эхлээрэй
          </h2>
          <p className="text-slate-400 mb-8">
            Картын мэдээлэл шаардахгүй. Үнэгүй эхлэх.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all text-lg"
          >
            <span>🚀</span>
            <span>Үнэгүй бүртгүүлэх</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <span className="text-white font-bold">TEMUULEL</span>
            </div>
            <p className="text-slate-500 text-sm">
              © 2025 Temuulel Commerce. Бүх эрх хуулиар хамгаалагдсан.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
