'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const NODES = [
  { id: 'messenger', icon: '💬', label: 'Messenger', angle: 225 },
  { id: 'instagram', icon: '📷', label: 'Instagram', angle: 315 },
  { id: 'telegram', icon: '✈️', label: 'Telegram', angle: 180 },
  { id: 'database', icon: '🗄️', label: 'Database', angle: 0 },
  { id: 'payment', icon: '💳', label: 'Төлбөр', angle: 135 },
  { id: 'delivery', icon: '🚚', label: 'Хүргэлт', angle: 45 },
] as const

const RADIUS = 220
const CENTER = 300

function getNodePosition(angle: number) {
  const rad = (angle * Math.PI) / 180
  return {
    x: CENTER + RADIUS * Math.cos(rad),
    y: CENTER + RADIUS * Math.sin(rad),
  }
}

function ConnectionLine({
  x1,
  y1,
  x2,
  y2,
  index,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  index: number
}) {
  const gradientId = `line-gradient-${index}`
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Static faint line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeOpacity={0.15}
      />
      {/* Animated dashes flowing toward center */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeDasharray="8 16"
        strokeLinecap="round"
        className="animate-dash-flow"
        style={{ animationDelay: `${index * 0.3}s` }}
      />
      {/* Animated dashes flowing away from center (response) */}
      <line
        x1={x2}
        y1={y2}
        x2={x1}
        y2={y1}
        stroke={`url(#${gradientId})`}
        strokeWidth={1.5}
        strokeDasharray="6 20"
        strokeLinecap="round"
        strokeOpacity={0.5}
        className="animate-dash-flow-reverse"
        style={{ animationDelay: `${index * 0.3 + 1}s` }}
      />
    </g>
  )
}

function DiagramSVG() {
  return (
    <div className="relative mx-auto hidden md:block" style={{ width: 600, height: 600 }}>
      {/* SVG connection lines */}
      <svg
        className="absolute inset-0"
        width={600}
        height={600}
        viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {NODES.map((node, i) => {
          const pos = getNodePosition(node.angle)
          return (
            <ConnectionLine
              key={node.id}
              x1={pos.x}
              y1={pos.y}
              x2={CENTER}
              y2={CENTER}
              index={i}
            />
          )
        })}
      </svg>

      {/* Central AI node */}
      <motion.div
        className="absolute z-10 flex items-center justify-center"
        style={{
          left: CENTER - 60,
          top: CENTER - 60,
          width: 120,
          height: 120,
        }}
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 opacity-30 blur-xl animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 opacity-15 blur-2xl scale-150 animate-pulse" />
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex flex-col items-center justify-center shadow-lg shadow-blue-500/30 border border-white/20">
          <span className="text-2xl mb-0.5">🧠</span>
          <span className="text-white font-bold text-xs tracking-wide">Temuulel AI</span>
        </div>
      </motion.div>

      {/* Outer nodes */}
      {NODES.map((node, i) => {
        const pos = getNodePosition(node.angle)
        return (
          <motion.div
            key={node.id}
            className="absolute z-10"
            style={{
              left: pos.x - 48,
              top: pos.y - 48,
              width: 96,
              height: 96,
            }}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
          >
            <div className="w-full h-full rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/10 flex flex-col items-center justify-center gap-1.5 hover:bg-white/[0.12] hover:border-white/20 hover:scale-110 transition-all duration-300 cursor-default">
              <span className="text-2xl">{node.icon}</span>
              <span className="text-white/80 text-xs font-medium">{node.label}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function MobileList() {
  return (
    <div className="flex flex-col items-center gap-3 md:hidden">
      {/* Central node */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 opacity-30 blur-xl animate-pulse" />
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex flex-col items-center justify-center shadow-lg shadow-blue-500/30 border border-white/20">
          <span className="text-2xl mb-0.5">🧠</span>
          <span className="text-white font-bold text-xs">Temuulel AI</span>
        </div>
      </motion.div>

      {/* Vertical connector */}
      <div className="w-px h-4 bg-gradient-to-b from-cyan-400 to-blue-500/30" />

      {/* Outer nodes */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-30px' }}
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="grid grid-cols-2 gap-3 w-full max-w-xs"
      >
        {NODES.map((node) => (
          <motion.div
            key={node.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
            }}
            className="relative"
          >
            {/* Connection line to center */}
            <div className="absolute -top-3 left-1/2 w-px h-3 bg-gradient-to-b from-blue-500/50 to-cyan-400/30" />
            <div className="rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/10 p-4 flex flex-col items-center gap-1.5 hover:bg-white/[0.12] transition-colors duration-300">
              <span className="text-2xl">{node.icon}</span>
              <span className="text-white/80 text-xs font-medium">{node.label}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

export default function ArchitectureDiagram() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* CSS animation for dash flow */}
      <style>{`
        @keyframes dash-flow {
          from { stroke-dashoffset: 48; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes dash-flow-reverse {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 52; }
        }
        .animate-dash-flow {
          animation: dash-flow 2s linear infinite;
        }
        .animate-dash-flow-reverse {
          animation: dash-flow-reverse 2.5s linear infinite;
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-4">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Нэг системд бүгд холбогдоно
          </h2>
          <p className="text-slate-400 text-lg">
            Temuulel AI таны бүх сувгийг нэгтгэнэ
          </p>
        </motion.div>

        {/* Desktop SVG diagram */}
        <DiagramSVG />

        {/* Mobile vertical list */}
        <MobileList />
      </div>
    </section>
  )
}
