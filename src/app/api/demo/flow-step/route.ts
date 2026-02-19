import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  isValidBusinessType,
  startDemoFlow,
  executeDemoFlowStep,
} from '@/lib/demo-flow-executor'
import type { FlowState } from '@/lib/flow-types'

/**
 * POST /api/demo/flow-step
 *
 * Public endpoint for the interactive flow demo.
 * No auth required — uses mock data, no database writes.
 *
 * Body:
 *   business_type: string — one of the 8 template types
 *   message: string — user's message (empty to start)
 *   flow_state: FlowState | null — null to start a new flow
 *
 * Response:
 *   messages: FlowMessage[]
 *   flow_state: FlowState | null — null when flow is complete
 *   completed: boolean
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: { business_type?: string; message?: string; flow_state?: FlowState | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { business_type, message = '', flow_state } = body

  if (!business_type || typeof business_type !== 'string' || !isValidBusinessType(business_type)) {
    return NextResponse.json({ error: 'Invalid business_type' }, { status: 400 })
  }

  if (typeof message !== 'string' || message.length > 500) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }

  try {
    let result
    if (!flow_state) {
      result = await startDemoFlow(business_type)
    } else {
      result = await executeDemoFlowStep(flow_state, message, business_type)
    }

    return NextResponse.json({
      messages: result.messages,
      flow_state: result.newState,
      completed: result.completed,
    })
  } catch (err) {
    console.error('[demo/flow-step] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
