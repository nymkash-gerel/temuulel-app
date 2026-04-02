'use client';

import { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Node positions – 8 nodes in organic circular layout (0–600 coords) */
/* ------------------------------------------------------------------ */
const NODES: { id: number; cx: number; cy: number; r: number; label?: string }[] = [
  { id: 0, cx: 300, cy: 300, r: 28, label: 'AI' }, // center
  { id: 1, cx: 300, cy: 100, r: 14 },
  { id: 2, cx: 470, cy: 160, r: 12 },
  { id: 3, cx: 510, cy: 330, r: 14 },
  { id: 4, cx: 440, cy: 480, r: 11 },
  { id: 5, cx: 300, cy: 520, r: 13 },
  { id: 6, cx: 160, cy: 460, r: 12 },
  { id: 7, cx: 100, cy: 300, r: 14 },
];

/* Connections: pairs of node indices */
const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7],
  [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 1],
  [1, 5], [2, 6], [3, 7],
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function HeroScene() {
  const containerRef = useRef<HTMLElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientY - rect.top - rect.height / 2) / rect.height;
    const y = -(e.clientX - rect.left - rect.width / 2) / rect.width;
    setRotate({ x: x * 12, y: y * 12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotate({ x: 0, y: 0 });
  }, []);

  /* Stagger helpers */
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 32 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-slate-950 py-28 md:py-36"
      style={
        {
          '--glow-blue': '#3b82f6',
          '--glow-cyan': '#06b6d4',
          '--glow-purple': '#8b5cf6',
        } as React.CSSProperties
      }
    >
      {/* ---------- Background radial glow ---------- */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)]" />
      </div>

      {/* ---------- Neural Network SVG (behind text) ---------- */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          perspective: '1200px',
        }}
      >
        <motion.div
          animate={{
            rotateX: rotate.x,
            rotateY: rotate.y,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg
              viewBox="0 0 600 600"
              className="h-[420px] w-[420px] opacity-60 sm:h-[520px] sm:w-[520px] md:h-[600px] md:w-[600px]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--glow-blue)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="var(--glow-cyan)" stopOpacity="0.2" />
                </linearGradient>
                <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--glow-cyan)" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="var(--glow-blue)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--glow-blue)" stopOpacity="0" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glow-strong">
                  <feGaussianBlur stdDeviation="12" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Edges */}
              {EDGES.map(([a, b], i) => {
                const na = NODES[a];
                const nb = NODES[b];
                return (
                  <line
                    key={`e-${i}`}
                    x1={na.cx}
                    y1={na.cy}
                    x2={nb.cx}
                    y2={nb.cy}
                    stroke="url(#edge-grad)"
                    strokeWidth={a === 0 || b === 0 ? 1.5 : 0.8}
                    strokeDasharray="6 4"
                    style={{
                      animation: `dash ${3 + (i % 4)}s linear infinite`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                );
              })}

              {/* Outer nodes */}
              {NODES.filter((n) => n.id !== 0).map((node) => (
                <g key={`n-${node.id}`} filter="url(#glow)">
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.r}
                    fill="rgba(59,130,246,0.1)"
                    stroke="var(--glow-blue)"
                    strokeWidth="1"
                    opacity="0.7"
                  />
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.r * 0.4}
                    fill="var(--glow-blue)"
                    opacity="0.5"
                  />
                </g>
              ))}

              {/* Center AI node */}
              <g filter="url(#glow-strong)">
                <circle cx={300} cy={300} r={44} fill="url(#center-glow)" opacity="0.3">
                  <animate
                    attributeName="r"
                    values="44;52;44"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.3;0.5;0.3"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={300}
                  cy={300}
                  r={28}
                  fill="rgba(6,182,212,0.15)"
                  stroke="var(--glow-cyan)"
                  strokeWidth="1.5"
                />
                <text
                  x={300}
                  y={307}
                  textAnchor="middle"
                  fill="var(--glow-cyan)"
                  fontSize="16"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                  letterSpacing="0.05em"
                >
                  AI
                </text>
              </g>
            </svg>
          </motion.div>
        </motion.div>
      </div>

      {/* ---------- Content (above network) ---------- */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto max-w-3xl px-6 text-center"
      >
        {/* Heading */}
        <motion.h1
          variants={fadeUp}
          className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          AI{' '}
          <span
            className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent"
          >
            ухаалаг
          </span>{' '}
          бизнес
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-5 max-w-xl text-base text-slate-400 sm:mt-6 sm:text-lg md:text-xl"
        >
          Messenger, Instagram дээрх бүх зүйлийг автоматжуулна
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          {/* Primary CTA */}
          <button
            className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.98]"
          >
            Үнэгүй эхлэх
            <span className="ml-2 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </button>

          {/* Ghost CTA */}
          <button
            className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-700 bg-transparent px-8 text-sm font-semibold text-slate-300 transition-all duration-300 hover:border-slate-500 hover:text-white active:scale-[0.98]"
          >
            Туршиж үзэх
          </button>
        </motion.div>
      </motion.div>

      {/* ---------- Dash animation keyframes ---------- */}
      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}</style>
    </section>
  );
}
