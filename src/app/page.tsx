import Link from 'next/link'
import VercelHero from '@/components/landing/VercelHero'
import VercelFeatures from '@/components/landing/VercelFeatures'
import VercelShowcase from '@/components/landing/VercelShowcase'
import DemoSection from '@/components/landing/DemoSection'
import AnimatedPricing from '@/components/landing/AnimatedPricing'
import VercelCTA from '@/components/landing/VercelCTA'
import VercelFooter from '@/components/landing/VercelFooter'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Nav — Vercel-style minimal */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/[0.08]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 19.5h20L12 2z" fill="white" />
              </svg>
              <span className="text-[15px] font-semibold tracking-[-0.01em]">Temuulel</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-[13px] text-zinc-400 hover:text-white transition-colors">Боломжууд</Link>
              <Link href="#showcase" className="text-[13px] text-zinc-400 hover:text-white transition-colors">Платформ</Link>
              <Link href="#pricing" className="text-[13px] text-zinc-400 hover:text-white transition-colors">Үнэ</Link>
              <Link href="#demo" className="text-[13px] text-zinc-400 hover:text-white transition-colors">Туршилт</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-[13px] text-zinc-400 hover:text-white transition-colors"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/signup"
                className="h-8 px-3 text-[13px] font-medium bg-white text-black rounded-md hover:bg-zinc-200 transition-colors inline-flex items-center"
              >
                Бүртгүүлэх
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <VercelHero />

      {/* Features */}
      <VercelFeatures />

      {/* Showcase */}
      <VercelShowcase />

      {/* Demo */}
      <DemoSection />

      {/* Pricing */}
      <AnimatedPricing />

      {/* CTA */}
      <VercelCTA />

      {/* Footer */}
      <VercelFooter />
    </div>
  )
}
