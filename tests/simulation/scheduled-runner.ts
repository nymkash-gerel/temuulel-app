#!/usr/bin/env npx tsx
/**
 * Scheduled simulation runner — run as standalone script.
 *
 * Usage:
 *   npx tsx tests/simulation/scheduled-runner.ts
 *
 * Cron example (daily at 9am):
 *   0 9 * * * cd /path/to/temuulel-app && npx tsx tests/simulation/scheduled-runner.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 *   TELEGRAM_BOT_TOKEN (optional, for alerts)
 *   SIMULATION_ALERT_CHAT_ID (optional, Telegram chat ID for alerts)
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { SimulationBot } from './bot'
import { createSimulationSupabase } from './chat-simulator'

const QUALITY_THRESHOLD = 3.0
const INTENT_ACCURACY_THRESHOLD = 0.75

async function sendTelegramAlert(report: { summary: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.SIMULATION_ALERT_CHAT_ID
  if (!token || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🤖 Simulation Alert:\n\n${report.summary.slice(0, 3000)}`,
        parse_mode: 'HTML',
      }),
    })
    console.log('Telegram alert sent')
  } catch (err) {
    console.error('Failed to send Telegram alert:', err)
  }
}

async function main() {
  console.log('Starting simulation test bot...\n')

  const sb = createSimulationSupabase()
  const bot = new SimulationBot(sb)

  const report = await bot.runAll()

  // Print and save
  bot.printReport(report)
  const path = await bot.saveReportToFile(report)
  console.log(`Report saved: ${path}`)

  // Alert if quality drops
  if (
    report.quality_scores.mean < QUALITY_THRESHOLD ||
    report.intent_accuracy < INTENT_ACCURACY_THRESHOLD ||
    report.bugs_detected.some(b => b.severity === 'critical')
  ) {
    console.log('\n⚠️  Quality below threshold — sending alert...')
    await sendTelegramAlert(report)
  }

  // Exit with error code if too many failures
  const passRate = report.scenarios_passed / report.scenarios_run
  if (passRate < 0.5) {
    console.error(`\n❌ Pass rate ${(passRate * 100).toFixed(0)}% is below 50% threshold`)
    process.exit(1)
  }

  console.log('\n✅ Simulation complete')
}

main().catch(err => {
  console.error('Simulation failed:', err)
  process.exit(1)
})
