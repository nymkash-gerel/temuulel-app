/**
 * SimulationBot — Main orchestrator for the simulation test system.
 *
 * Runs all personas × scenarios, validates responses, scores quality,
 * detects bugs, and generates comprehensive reports.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SimulationClient, getTestStoreId } from './chat-simulator'
import { SCENARIOS, type Scenario } from './scenarios'
import { validateIntent } from './validators/intent-checker'
import { scoreResponse } from './validators/quality-scorer'
import { detectBugs } from './diagnosis/bug-detector'
import {
  generateReport,
  saveReport,
  formatConsoleReport,
  type ScenarioResult,
  type SimulationReport,
} from './diagnosis/report-generator'
import { join } from 'path'

export class SimulationBot {
  private supabase: SupabaseClient
  private storeId: string | null = null

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /** Run all scenarios and generate a report. */
  async runAll(): Promise<SimulationReport> {
    const totalStart = performance.now()

    if (!this.storeId) {
      this.storeId = await getTestStoreId(this.supabase)
    }

    const results: ScenarioResult[] = []

    for (const scenario of SCENARIOS) {
      console.log(`  Running: ${scenario.name}...`)
      const result = await this.runScenario(scenario)
      results.push(result)
      console.log(`  ${result.passed ? 'PASS' : 'FAIL'}: ${scenario.name} (${result.duration_ms}ms, quality: ${result.qualityScore.overall}/5)`)
    }

    const totalDuration = Math.round(performance.now() - totalStart)
    return generateReport(results, totalDuration)
  }

  /** Run a single scenario. */
  async runScenario(scenario: Scenario): Promise<ScenarioResult> {
    const client = new SimulationClient(this.supabase, this.storeId!, 'Монгол Маркет')
    await client.init()

    const scenarioStart = performance.now()
    const errors: string[] = []
    let intentCorrect = 0
    let intentTotal = 0

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i]

      try {
        const result = await client.send(step.message)

        // Validate intent
        if (step.expectedIntent) {
          intentTotal++
          const iv = validateIntent(result.intent, step.expectedIntent)
          if (iv.valid) {
            intentCorrect++
          } else {
            errors.push(`Step ${i}: ${iv.reason}`)
          }
        }

        // Validate order step
        if (step.expectedOrderStep !== undefined) {
          if (result.orderStep !== step.expectedOrderStep) {
            errors.push(`Step ${i}: Expected orderStep "${step.expectedOrderStep}", got "${result.orderStep}"`)
          }
        }

        // Custom validation
        if (step.validate) {
          const err = step.validate(result, i)
          if (err) errors.push(`Step ${i}: ${err}`)
        }
      } catch (err) {
        errors.push(`Step ${i}: Exception: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const duration_ms = Math.round(performance.now() - scenarioStart)
    const metrics = client.getMetrics()

    // Score quality of last response (most representative)
    const lastMetric = metrics[metrics.length - 1]
    const qualityScore = lastMetric
      ? await scoreResponse(
          lastMetric.message,
          lastMetric.response,
          lastMetric.intent,
          { products_found: lastMetric.products_found, orderStep: lastMetric.orderStep }
        )
      : { accuracy: 0, relevance: 0, tone: 0, completeness: 0, overall: 0, issues: ['No metrics'] }

    // Detect bugs
    const bugs = detectBugs(scenario.name, metrics)

    const passed = errors.length === 0 && bugs.filter(b => b.severity === 'critical').length === 0

    return {
      name: scenario.name,
      persona: scenario.persona,
      passed,
      steps: scenario.steps.length,
      duration_ms,
      intentAccuracy: intentTotal > 0 ? intentCorrect / intentTotal : 1,
      qualityScore,
      bugs,
      errors,
    }
  }

  /** Save report to disk. */
  async saveReportToFile(report: SimulationReport): Promise<string> {
    const dir = join(__dirname, 'reports')
    return saveReport(report, dir)
  }

  /** Print report to console. */
  printReport(report: SimulationReport): void {
    console.log('\n' + formatConsoleReport(report) + '\n')
  }
}
