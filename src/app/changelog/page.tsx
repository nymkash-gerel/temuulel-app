import Link from 'next/link'

const RELEASES = [
  {
    version: 'v2.4.0',
    date: '2026-04-16',
    highlights: [
      '🎁 Referral program — найз урихад 1 сар үнэгүй',
      '📱 QR code generator — dashboard settings',
      '⌨️ Cmd+K quick search',
      '❓ Help center page',
    ],
  },
  {
    version: 'v2.3.0',
    date: '2026-04-15',
    highlights: [
      '🔒 2FA (TOTP) with Google Authenticator + backup codes',
      '🧪 A/B Testing framework',
      '🎓 AI Fine-tuning export (JSONL)',
      '📉 Churn prediction',
      '💳 Stripe subscription integration',
      '🎨 White-label branding (custom domain, colors)',
    ],
  },
  {
    version: 'v2.2.0',
    date: '2026-04-14',
    highlights: [
      '⚡ Bundle size optimization (-50% initial JS)',
      '💾 Whisper + AI response caching (Redis)',
      '🔒 Webhook dedup with message ID',
      '📊 OpenAI cost tracking per store',
      '📉 Churn prediction + sentiment trend',
    ],
  },
  {
    version: 'v2.1.0',
    date: '2026-04-14',
    highlights: [
      '🖼️ Image recognition (GPT-4o Vision) — зураг илгээхэд бүтээгдэхүүн санал болгоно',
      '🎤 Voice transcription (Whisper) — дуу мессеж таньж хариулдаг',
      '🧠 Self-learning AI — хариулаагүй асуултыг автомат бүртгэж, Knowledge Base-д нэмнэ',
      '📢 Broadcast campaigns (Messenger + Email)',
      '👤 Operator handoff with 30min auto-return',
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-04-13',
    highlights: [
      '💬 Comment auto-reply for Facebook/Instagram posts',
      '🛍️ Cross-sell after order confirmation',
      '📄 Catalog pagination (Дараах/Өмнөх товч)',
      '📊 Analytics dashboard with AI quality trend',
      '💰 Message pack upsell (500-5000 messages)',
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">📝 Changelog</h1>
          <p className="text-slate-400">Шинэ feature болон сайжруулалтын түүх</p>
        </div>

        <div className="space-y-8">
          {RELEASES.map(r => (
            <div key={r.version} className="relative pl-8 border-l-2 border-slate-700">
              <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-slate-950" />
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold">{r.version}</h2>
                <span className="text-sm text-slate-500">{r.date}</span>
              </div>
              <ul className="space-y-2">
                {r.highlights.map((h, i) => (
                  <li key={i} className="text-slate-300">{h}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm">
          <Link href="/dashboard" className="text-blue-400 hover:underline">← Dashboard-руу буцах</Link>
        </div>
      </div>
    </div>
  )
}
