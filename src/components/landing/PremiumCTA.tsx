'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function PremiumCTA() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-32 sm:py-40">
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.12)_0%,rgba(59,130,246,0.06)_40%,transparent_70%)]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          AI бизнесээ{' '}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
            минутанд эхлүүлээрэй
          </span>
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-xl text-lg text-slate-400 sm:text-xl"
        >
          Картын мэдээлэл шаардахгүй. Үнэгүй туршилт.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10"
        >
          <Link href="/signup">
            <motion.span
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-8 py-4 text-lg font-semibold text-white shadow-[0_0_40px_rgba(59,130,246,0.3),0_0_80px_rgba(56,189,248,0.15)] transition-shadow duration-300 hover:shadow-[0_0_50px_rgba(59,130,246,0.4),0_0_100px_rgba(56,189,248,0.2)]"
            >
              Үнэгүй эхлэх
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
            </motion.span>
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex items-center justify-center gap-3"
        >
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            {[
              'bg-blue-500',
              'bg-cyan-500',
              'bg-sky-500',
              'bg-indigo-500',
              'bg-teal-500',
            ].map((color, i) => (
              <div
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-full ${color} ring-2 ring-slate-950 text-xs font-medium text-white`}
              >
                {String.fromCodePoint(0x1f464)}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-slate-300">500+</span> бизнес
            итгэл хүлээсэн
          </p>
        </motion.div>
      </div>
    </section>
  );
}
