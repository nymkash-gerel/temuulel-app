/**
 * Bug detector — analyzes simulation results to find system-level issues.
 */

import type { StepMetric } from '../chat-simulator'

export interface BugReport {
  severity: 'critical' | 'major' | 'minor'
  type: string
  description: string
  scenario: string
  stepIndex: number
  evidence: string
}

/**
 * Analyze a scenario's metrics for known bug patterns.
 */
export function detectBugs(scenarioName: string, metrics: StepMetric[]): BugReport[] {
  const bugs: BugReport[] = []

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i]

    // Bug: Empty/error response
    if (!m.response || m.response.length < 5) {
      bugs.push({
        severity: 'critical',
        type: 'empty_response',
        description: 'Bot returned empty or near-empty response',
        scenario: scenarioName,
        stepIndex: i,
        evidence: `Response: "${m.response}" (${m.response?.length ?? 0} chars)`,
      })
    }

    // Bug: Response contains code artifacts
    if (/undefined|null|NaN|\[object|Error:|TypeError/i.test(m.response)) {
      bugs.push({
        severity: 'critical',
        type: 'code_leak',
        description: 'Response contains code/error artifacts',
        scenario: scenarioName,
        stepIndex: i,
        evidence: `Response contains: ${m.response.match(/undefined|null|NaN|\[object|Error:|TypeError/i)?.[0]}`,
      })
    }

    // Bug: Excessive latency
    if (m.latency_ms > 15000) {
      bugs.push({
        severity: 'major',
        type: 'high_latency',
        description: `Response took ${m.latency_ms}ms (>15s threshold)`,
        scenario: scenarioName,
        stepIndex: i,
        evidence: `Latency: ${m.latency_ms}ms for message: "${m.message}"`,
      })
    }

    // Bug: Stuck in loop (same response 3+ times in a row — not just 2, since template responses can repeat)
    if (i >= 2 &&
        m.response === metrics[i - 1].response &&
        m.response === metrics[i - 2].response &&
        m.message !== metrics[i - 1].message) {
      bugs.push({
        severity: 'major',
        type: 'stuck_loop',
        description: 'Bot returned identical response 3+ times to different messages',
        scenario: scenarioName,
        stepIndex: i,
        evidence: `Same response repeated for 3 consecutive different messages`,
      })
    }

    // Bug: Order step didn't advance
    if (i > 0 && m.orderStep && m.orderStep === metrics[i - 1].orderStep &&
        m.message.length > 2 && m.intent === 'order_collection') {
      bugs.push({
        severity: 'major',
        type: 'order_stuck',
        description: `Order stuck at "${m.orderStep}" step — didn't advance`,
        scenario: scenarioName,
        stepIndex: i,
        evidence: `Step "${m.orderStep}" repeated for message: "${m.message}"`,
      })
    }

    // Bug: Products disappeared mid-conversation
    if (i > 0 && metrics[i - 1].products_found > 0 && m.products_found === 0 &&
        m.intent === 'product_search') {
      bugs.push({
        severity: 'minor',
        type: 'products_lost',
        description: 'Products found in previous step but lost in current',
        scenario: scenarioName,
        stepIndex: i,
        evidence: `Previous: ${metrics[i - 1].products_found} products, Current: 0`,
      })
    }
  }

  return bugs
}
