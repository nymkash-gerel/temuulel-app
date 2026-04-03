#!/usr/bin/env npx tsx
/**
 * Audit Dashboard — compare all audit reports and show progress.
 *
 * Usage: npx tsx scripts/audit-dashboard.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
}

interface AuditReport {
  date: string
  store: string
  messagesTotal: number
  avgLatency: number
  bugs: { critical: number; warning: number; info: number }
  intents: Record<string, number>
  bugDetails: { message: string; response: string; bugs: { type: string; severity: string; description: string }[] }[]
}

const reportDir = path.join(__dirname, '..', 'tests', 'simulation', 'reports')
const files = fs.readdirSync(reportDir)
  .filter(f => f.startsWith('fb-audit-') && f.endsWith('.json'))
  .sort()

if (files.length === 0) {
  console.log('No audit reports found.')
  process.exit(0)
}

const reports: { file: string; data: AuditReport }[] = files.map(f => ({
  file: f,
  data: JSON.parse(fs.readFileSync(path.join(reportDir, f), 'utf-8')),
}))

console.log(`${c.cyan}${c.bold}`)
console.log(`  ╔══════════════════════════════════════════════╗`)
console.log(`  ║   Audit Dashboard 📊                         ║`)
console.log(`  ║   ${reports.length} report(s) found                        ║`)
console.log(`  ╚══════════════════════════════════════════════╝`)
console.log(`${c.reset}`)

// Timeline table
console.log(`${c.cyan}  Date                  Msgs  Critical  Warning  Info   Latency  Score${c.reset}`)
console.log(`  ${'─'.repeat(72)}`)

for (const r of reports) {
  const d = r.data
  const total = d.bugs.critical + d.bugs.warning + d.bugs.info
  const score = Math.round((1 - (d.bugs.critical * 10 + d.bugs.warning * 2 + d.bugs.info * 0.5) / (d.messagesTotal * 10)) * 100)
  const critColor = d.bugs.critical > 0 ? c.red : c.green
  const warnColor = d.bugs.warning > 5 ? c.yellow : c.green
  const dateStr = r.file.replace('fb-audit-', '').replace('.json', '')

  console.log(`  ${dateStr.padEnd(22)} ${String(d.messagesTotal).padStart(4)}  ${critColor}${String(d.bugs.critical).padStart(8)}${c.reset}  ${warnColor}${String(d.bugs.warning).padStart(7)}${c.reset}  ${String(d.bugs.info).padStart(4)}   ${String(d.avgLatency).padStart(5)}ms  ${score >= 95 ? c.green : score >= 80 ? c.yellow : c.red}${score}%${c.reset}`)
}

// Latest report details
if (reports.length > 0) {
  const latest = reports[reports.length - 1].data

  console.log(`\n${c.cyan}  Latest Report Details:${c.reset}`)
  console.log(`  Messages: ${latest.messagesTotal}`)
  console.log(`  Avg Latency: ${latest.avgLatency}ms`)

  // Bug type breakdown
  const bugTypes: Record<string, number> = {}
  for (const bd of latest.bugDetails) {
    for (const b of bd.bugs) {
      bugTypes[`${b.severity}:${b.type}`] = (bugTypes[`${b.severity}:${b.type}`] || 0) + 1
    }
  }
  if (Object.keys(bugTypes).length > 0) {
    console.log(`\n  Bug Types:`)
    for (const [k, v] of Object.entries(bugTypes).sort((a, b) => b[1] - a[1])) {
      const [sev, type] = k.split(':')
      const color = sev === 'critical' ? c.red : sev === 'warning' ? c.yellow : c.dim
      console.log(`    ${color}${type.padEnd(25)} ${String(v).padStart(3)}${c.reset}`)
    }
  }

  // Quality score breakdown
  const critScore = latest.bugs.critical === 0 ? '✅' : `❌ ${latest.bugs.critical}`
  const warnPct = ((latest.bugs.warning / latest.messagesTotal) * 100).toFixed(1)
  const infoPct = ((latest.bugs.info / latest.messagesTotal) * 100).toFixed(1)

  console.log(`\n  Quality:`)
  console.log(`    Critical bugs:    ${critScore}`)
  console.log(`    Warning rate:     ${warnPct}% (${latest.bugs.warning}/${latest.messagesTotal})`)
  console.log(`    Info rate:        ${infoPct}% (${latest.bugs.info}/${latest.messagesTotal})`)
  console.log(`    Clean messages:   ${latest.messagesTotal - latest.bugDetails.length}/${latest.messagesTotal} (${((1 - latest.bugDetails.length / latest.messagesTotal) * 100).toFixed(1)}%)`)

  // Progress comparison
  if (reports.length >= 2) {
    const prev = reports[reports.length - 2].data
    console.log(`\n${c.cyan}  Progress (vs previous):${c.reset}`)
    const critDiff = latest.bugs.critical - prev.bugs.critical
    const warnDiff = latest.bugs.warning - prev.bugs.warning
    const infoDiff = latest.bugs.info - prev.bugs.info
    const arrow = (n: number) => n > 0 ? `${c.red}↑${n}${c.reset}` : n < 0 ? `${c.green}↓${Math.abs(n)}${c.reset}` : `${c.dim}=${c.reset}`
    console.log(`    Critical: ${prev.bugs.critical} → ${latest.bugs.critical} ${arrow(critDiff)}`)
    console.log(`    Warning:  ${prev.bugs.warning} → ${latest.bugs.warning} ${arrow(warnDiff)}`)
    console.log(`    Info:     ${prev.bugs.info} → ${latest.bugs.info} ${arrow(infoDiff)}`)
  }
}

console.log()
