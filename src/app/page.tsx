import Link from 'next/link'
import HeroScene from '@/components/landing/HeroScene'
import AnimatedStats from '@/components/landing/AnimatedStats'
import BentoGrid from '@/components/landing/BentoGrid'
import ScrollCapabilities from '@/components/landing/ScrollCapabilities'
import BeforeAfterSlider from '@/components/landing/BeforeAfterSlider'
import ScrollStory from '@/components/landing/ScrollStory'
import ArchitectureDiagram from '@/components/landing/ArchitectureDiagram'
import FeatureCards from '@/components/landing/FeatureCards'
import AnimatedSteps from '@/components/landing/AnimatedSteps'
import LiveMessageFeed from '@/components/landing/LiveMessageFeed'
import SocialProof from '@/components/landing/SocialProof'
import DemoSection from '@/components/landing/DemoSection'
import AnimatedPricing from '@/components/landing/AnimatedPricing'
import PremiumCTA from '@/components/landing/PremiumCTA'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">TEMUULEL</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                Бүртгүүлэх
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero — Interactive neural network */}
      <HeroScene />

      {/* Stats bar */}
      <AnimatedStats />

      {/* Live scrolling message feed */}
      <LiveMessageFeed />

      {/* Social proof — client logos + stats */}
      <SocialProof />

      {/* Before/After comparison slider */}
      <BeforeAfterSlider />

      {/* Bento Grid Features */}
      <BentoGrid />

      {/* Scroll Capabilities — detailed feature showcase */}
      <ScrollCapabilities />

      {/* Feature Cards with 3D tilt */}
      <FeatureCards />

      {/* Architecture Diagram */}
      <ArchitectureDiagram />

      {/* Scroll Story — timeline flow */}
      <ScrollStory />

      {/* Steps */}
      <AnimatedSteps />

      {/* Demo */}
      <DemoSection />

      {/* Pricing */}
      <AnimatedPricing />

      {/* CTA */}
      <PremiumCTA />

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <span className="text-white font-semibold">TEMUULEL</span>
            </div>
            <p className="text-slate-500 text-sm">
              © 2026 Temuulel Commerce. Бүх эрх хуулиар хамгаалагдсан.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
