import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Data Handling | Temuulel',
  description: 'How Temuulel collects, processes, stores, and protects user data.',
}

export default function DataHandlingPage() {
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
              <Link href="/privacy" className="text-slate-400 hover:text-white">Privacy</Link>
              <Link href="/terms" className="text-slate-400 hover:text-white">Terms</Link>
              <Link href="/data-deletion" className="text-slate-400 hover:text-white">Data Deletion</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Data Handling</h1>
          <p className="text-slate-400">How Temuulel handles user data end-to-end</p>
          <p className="text-slate-500 text-sm mt-2">Last updated: 2026-04-17</p>
        </div>

        <div className="space-y-6 text-slate-300 text-[15px] leading-relaxed">
          <Section title="1. Purpose of data collection" icon="🎯">
            <p>
              Temuulel is a multi-tenant SaaS chatbot platform serving 24+ Mongolian
              business verticals (e-commerce, restaurants, beauty salons, clinics, hotels,
              etc.). We collect data solely to:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
              <li>Deliver automated AI responses to customer inquiries via Facebook Messenger, Instagram DM, Telegram, and web chat</li>
              <li>Process orders, payments, appointments, and deliveries</li>
              <li>Send order confirmations, receipts, and operational notifications</li>
              <li>Provide business owners with analytics, customer intelligence, and operational dashboards</li>
              <li>Detect fraud, abuse, and bot traffic</li>
            </ul>
            <p className="text-sm mt-2 text-slate-400">
              We <strong className="text-white">never sell</strong> user data and <strong className="text-white">do not use</strong>
              {' '}Meta platform data for advertising or unrelated purposes.
            </p>
          </Section>

          <Section title="2. Data we collect" icon="📥">
            <h4 className="text-white font-semibold mt-2">From end users (Messenger/IG):</h4>
            <ul className="list-disc pl-6 text-sm space-y-1">
              <li>Facebook/Instagram user ID (psid), name, profile picture URL</li>
              <li>Messages, images, voice notes sent to the business Page</li>
              <li>Delivery address and phone number (only when placing an order)</li>
              <li>Order history, payment status</li>
            </ul>
            <h4 className="text-white font-semibold mt-3">From business owners:</h4>
            <ul className="list-disc pl-6 text-sm space-y-1">
              <li>Business name, phone, address, vertical category</li>
              <li>Products, prices, inventory (uploaded by the business)</li>
              <li>Facebook Page ID and Page Access Token (provided via OAuth)</li>
              <li>QPay / Stripe credentials (encrypted at rest)</li>
              <li>Staff user accounts (email, role, permissions)</li>
            </ul>
            <h4 className="text-white font-semibold mt-3">Automatic collection:</h4>
            <ul className="list-disc pl-6 text-sm space-y-1">
              <li>IP address (for rate limiting + abuse prevention — hashed after 90 days)</li>
              <li>Browser/device info via standard HTTP headers</li>
              <li>Cookies: session token (essential), language preference (functional)</li>
            </ul>
          </Section>

          <Section title="3. Data processing & AI" icon="🤖">
            <p className="text-sm">
              Customer messages are processed through <strong className="text-white">OpenAI GPT-4o-mini</strong>
              {' '}for text responses, <strong className="text-white">GPT-4o Vision</strong> for image recognition,
              and <strong className="text-white">Whisper</strong> for voice transcription.
            </p>
            <p className="text-sm mt-2">
              Per OpenAI&apos;s API terms (<a href="https://openai.com/policies/api-data-usage-policies" className="text-blue-400 hover:underline" target="_blank" rel="noopener">api-data-usage-policies</a>),
              data sent via the API is <strong className="text-white">not used to train</strong> OpenAI models.
              Data is retained by OpenAI for 30 days max for abuse monitoring, then deleted.
            </p>
            <p className="text-sm mt-2 text-slate-400">
              Messages are <strong className="text-white">not</strong> sent to Meta, Google, or any third-party
              advertising platform.
            </p>
          </Section>

          <Section title="4. Storage & infrastructure" icon="🏗️">
            <ul className="list-disc pl-6 text-sm space-y-2">
              <li>
                <strong className="text-white">Database:</strong> Supabase (PostgreSQL), hosted in
                Singapore (AWS ap-southeast-1). TLS 1.3 in transit, AES-256 at rest.
              </li>
              <li>
                <strong className="text-white">Application servers:</strong> Vercel (global edge),
                routed via Cloudflare (Singapore CDN).
              </li>
              <li>
                <strong className="text-white">Multi-tenancy:</strong> PostgreSQL Row-Level Security (RLS)
                enforces that each business only reads/writes its own data. Every table has a
                {' '}<code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">store_id</code> column.
              </li>
              <li>
                <strong className="text-white">Backups:</strong> Daily automated backups retained 7 days.
              </li>
            </ul>
          </Section>

          <Section title="5. Third-party processors" icon="🔌">
            <table className="w-full text-sm mt-2">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2">Provider</th>
                  <th className="text-left py-2">Purpose</th>
                  <th className="text-left py-2">Region</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Supabase', 'Database, auth, storage', 'Singapore'],
                  ['Vercel', 'App hosting, CDN', 'Global edge'],
                  ['Cloudflare', 'DNS, proxy, DDoS', 'Global'],
                  ['OpenAI', 'AI processing (API)', 'USA'],
                  ['Meta (Facebook)', 'Messenger/IG channel', 'USA/EU'],
                  ['QPay', 'Payments (Mongolia)', 'Mongolia'],
                  ['Stripe', 'International payments', 'USA/EU'],
                  ['Resend', 'Transactional email', 'USA/EU'],
                  ['Upstash Redis', 'Rate limiting', 'Global'],
                  ['Sentry', 'Error monitoring (no PII)', 'USA/EU'],
                ].map(([provider, purpose, region]) => (
                  <tr key={provider} className="border-b border-slate-800">
                    <td className="py-2 font-medium text-white">{provider}</td>
                    <td className="py-2 text-slate-300">{purpose}</td>
                    <td className="py-2 text-slate-500">{region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-2">
              All processors are bound by Data Processing Agreements (DPAs) with Standard Contractual Clauses
              where applicable.
            </p>
          </Section>

          <Section title="6. Retention" icon="📆">
            <ul className="list-disc pl-6 text-sm space-y-1">
              <li><strong className="text-white">Active accounts:</strong> As long as account is active</li>
              <li><strong className="text-white">Inactive accounts:</strong> Deleted after 2 years of inactivity</li>
              <li><strong className="text-white">Chat history:</strong> 12 months, configurable per business</li>
              <li><strong className="text-white">Orders / payments:</strong> 7 years (Mongolia tax law)</li>
              <li><strong className="text-white">IP / access logs:</strong> 90 days, then hashed</li>
              <li><strong className="text-white">Analytics:</strong> 2 years, anonymized</li>
              <li><strong className="text-white">Deletion requests:</strong> Processed within 30 days</li>
            </ul>
          </Section>

          <Section title="7. Security measures" icon="🛡️">
            <ul className="list-disc pl-6 text-sm space-y-1">
              <li>TLS 1.3 for all traffic</li>
              <li>HSTS (2 year max-age, includeSubdomains, preload)</li>
              <li>Row-Level Security on every table</li>
              <li>2FA (TOTP) available for all owner accounts</li>
              <li>Session rotation every 24h</li>
              <li>Rate limiting via Upstash Redis on all public endpoints</li>
              <li>Webhook signature verification (HMAC-SHA256) on all inbound Meta webhooks</li>
              <li>Secrets stored in Vercel environment variables (encrypted)</li>
              <li>SOC 2-compliant infrastructure providers (Supabase, Vercel, Cloudflare)</li>
              <li>Regular dependency audits (npm audit weekly)</li>
              <li>Sentry error tracking scrubs PII before upload</li>
            </ul>
          </Section>

          <Section title="8. User rights" icon="⚖️">
            <p className="text-sm">Under Mongolia&apos;s Personal Data Protection Law and GDPR principles:</p>
            <ul className="list-disc pl-6 text-sm mt-2 space-y-1">
              <li><strong className="text-white">Access:</strong> Request a copy of your data</li>
              <li><strong className="text-white">Rectification:</strong> Correct inaccurate data</li>
              <li><strong className="text-white">Erasure:</strong> Request deletion (see <Link href="/data-deletion" className="text-blue-400 hover:underline">/data-deletion</Link>)</li>
              <li><strong className="text-white">Portability:</strong> Export data in machine-readable format</li>
              <li><strong className="text-white">Objection:</strong> Opt out of processing for specific purposes</li>
              <li><strong className="text-white">Restriction:</strong> Limit processing while a dispute is resolved</li>
            </ul>
            <p className="text-sm mt-2">
              Email <a href="mailto:privacy@temuulel.com" className="text-blue-400 hover:underline">privacy@temuulel.com</a>
              {' '}to exercise any right. Response within 30 days.
            </p>
          </Section>

          <Section title="9. Meta Platform Data" icon="📘">
            <p className="text-sm">
              When a business connects their Facebook Page to Temuulel via OAuth, we receive:
            </p>
            <ul className="list-disc pl-6 text-sm mt-2 space-y-1">
              <li>Page Access Token (stored encrypted)</li>
              <li>Page ID and basic metadata (name, category, picture)</li>
              <li>Incoming messages and attachments via Webhook subscriptions</li>
            </ul>
            <p className="text-sm mt-3">
              Per Meta Platform Terms, we <strong className="text-white">do not</strong>:
            </p>
            <ul className="list-disc pl-6 text-sm mt-1 space-y-1">
              <li>Sell or license Meta data to third parties</li>
              <li>Use Meta data for advertising outside Meta</li>
              <li>Transfer data to data brokers</li>
              <li>Use Meta data to evaluate or monitor third parties (e.g. for credit decisions)</li>
              <li>Retain data longer than necessary for the service</li>
            </ul>
          </Section>

          <Section title="10. Incident response" icon="🚨">
            <p className="text-sm">
              In the event of a data breach:
            </p>
            <ul className="list-disc pl-6 text-sm mt-2 space-y-1">
              <li>Affected users notified within 72 hours</li>
              <li>Relevant supervisory authorities notified per applicable law</li>
              <li>Post-incident review published within 30 days</li>
              <li>Meta Platform notified immediately if Meta platform data is involved</li>
            </ul>
          </Section>

          <Section title="11. Contact" icon="✉️">
            <p className="text-sm">
              Data Protection Officer: <a href="mailto:privacy@temuulel.com" className="text-blue-400 hover:underline">privacy@temuulel.com</a>
            </p>
            <p className="text-sm">
              Security: <a href="mailto:security@temuulel.com" className="text-blue-400 hover:underline">security@temuulel.com</a>
            </p>
            <p className="text-sm">
              Support: <a href="mailto:support@temuulel.com" className="text-blue-400 hover:underline">support@temuulel.com</a>
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <Link href="/" className="text-blue-400 hover:underline">← Home</Link>
          <span className="mx-3">•</span>
          <Link href="/privacy" className="text-blue-400 hover:underline">Privacy</Link>
          <span className="mx-3">•</span>
          <Link href="/terms" className="text-blue-400 hover:underline">Terms</Link>
          <span className="mx-3">•</span>
          <Link href="/data-deletion" className="text-blue-400 hover:underline">Data Deletion</Link>
        </div>
      </main>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
        <span>{icon}</span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  )
}
