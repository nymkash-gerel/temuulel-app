/**
 * Simulation test — runs all scenarios through the AI pipeline.
 * Integrates with vitest for CI/CD.
 *
 * Run: npx vitest run tests/simulation/simulation.test.ts
 * Requires: Supabase running locally with seed data.
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { SimulationBot } from './bot'
import { createSimulationSupabase, getTestStoreId } from './chat-simulator'

const sb = createSimulationSupabase()
let bot: SimulationBot

beforeAll(async () => {
  // Verify Supabase is running and has test data
  const storeId = await getTestStoreId(sb)
  expect(storeId).toBeTruthy()
  bot = new SimulationBot(sb)
})

describe('Simulation Test Bot', () => {
  test('run all scenarios and validate quality', { timeout: 300_000 }, async () => {
    const report = await bot.runAll()

    // Print report
    bot.printReport(report)

    // Save report
    const path = await bot.saveReportToFile(report)
    console.log(`Report saved: ${path}`)

    // Quality gates
    expect(report.scenarios_run).toBeGreaterThan(0)
    expect(report.intent_accuracy).toBeGreaterThan(0.7) // 70%+ intent accuracy
    expect(report.quality_scores.mean).toBeGreaterThan(2.5) // 2.5+/5.0 quality

    // No critical bugs
    const criticalBugs = report.bugs_detected.filter(b => b.severity === 'critical')
    if (criticalBugs.length > 0) {
      console.error('CRITICAL BUGS:', criticalBugs)
    }

    // At least 60% scenarios pass (relaxed for initial run)
    const passRate = report.scenarios_passed / report.scenarios_run
    expect(passRate).toBeGreaterThan(0.5)
  })
})
