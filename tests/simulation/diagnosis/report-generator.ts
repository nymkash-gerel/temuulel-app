/**
 * Report generator — creates JSON reports and console summaries.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { BugReport } from './bug-detector'
import type { QualityScore } from '../validators/quality-scorer'

export interface ScenarioResult {
  name: string
  persona: string
  passed: boolean
  steps: number
  duration_ms: number
  intentAccuracy: number
  qualityScore: QualityScore
  bugs: BugReport[]
  errors: string[]
}

export interface SimulationReport {
  timestamp: string
  duration_ms: number
  scenarios_run: number
  scenarios_passed: number
  scenarios_failed: number
  quality_scores: { mean: number; min: number; max: number }
  intent_accuracy: number
  bugs_detected: BugReport[]
  scenario_results: ScenarioResult[]
  summary: string
}

export function generateReport(
  results: ScenarioResult[],
  totalDuration: number,
): SimulationReport {
  const passed = results.filter(r => r.passed).length
  const failed = results.length - passed
  const allBugs = results.flatMap(r => r.bugs)
  const qualityScores = results.map(r => r.qualityScore.overall)
  const intentAccuracies = results.map(r => r.intentAccuracy)

  const report: SimulationReport = {
    timestamp: new Date().toISOString(),
    duration_ms: totalDuration,
    scenarios_run: results.length,
    scenarios_passed: passed,
    scenarios_failed: failed,
    quality_scores: {
      mean: +(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length).toFixed(2),
      min: Math.min(...qualityScores),
      max: Math.max(...qualityScores),
    },
    intent_accuracy: +(intentAccuracies.reduce((a, b) => a + b, 0) / intentAccuracies.length).toFixed(3),
    bugs_detected: allBugs,
    scenario_results: results,
    summary: '',
  }

  report.summary = buildSummary(report)
  return report
}

function buildSummary(r: SimulationReport): string {
  const lines = [
    `=== SIMULATION REPORT ===`,
    `Time: ${r.timestamp}`,
    `Duration: ${(r.duration_ms / 1000).toFixed(1)}s`,
    ``,
    `Scenarios: ${r.scenarios_passed}/${r.scenarios_run} passed (${r.scenarios_failed} failed)`,
    `Intent Accuracy: ${(r.intent_accuracy * 100).toFixed(1)}%`,
    `Quality Score: ${r.quality_scores.mean}/5.0 (min: ${r.quality_scores.min}, max: ${r.quality_scores.max})`,
    `Bugs Detected: ${r.bugs_detected.length}`,
  ]

  if (r.bugs_detected.length > 0) {
    lines.push('', '--- BUGS ---')
    for (const bug of r.bugs_detected) {
      lines.push(`  [${bug.severity.toUpperCase()}] ${bug.type} in "${bug.scenario}" step ${bug.stepIndex}: ${bug.description}`)
    }
  }

  const failed = r.scenario_results.filter(s => !s.passed)
  if (failed.length > 0) {
    lines.push('', '--- FAILED SCENARIOS ---')
    for (const s of failed) {
      lines.push(`  ${s.name}: ${s.errors.join('; ')}`)
    }
  }

  return lines.join('\n')
}

export function saveReport(report: SimulationReport, dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const date = new Date().toISOString().split('T')[0]
  const path = join(dir, `${date}.json`)
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n')

  // Also save latest
  const latestPath = join(dir, 'latest.json')
  writeFileSync(latestPath, JSON.stringify(report, null, 2) + '\n')

  return path
}

export function formatConsoleReport(report: SimulationReport): string {
  return report.summary
}
