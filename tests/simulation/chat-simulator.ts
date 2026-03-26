/**
 * Chat simulator — sends messages through processAIChat and tracks metrics.
 * Reuses the ChatClient pattern from existing e2e tests.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { processAIChat, type AIProcessingResult, type AIProcessingContext } from '@/lib/chat-ai-handler'
import { readState } from '@/lib/conversation-state'

export interface StepMetric {
  stepIndex: number
  message: string
  intent: string
  response: string
  latency_ms: number
  products_found: number
  orders_found: number
  orderStep: string | null
}

export interface SimulationStepResult extends AIProcessingResult {
  latency_ms: number
  stepIndex: number
}

export class SimulationClient {
  private supabase: SupabaseClient
  private storeId: string
  private storeName: string
  private customerId: string | null
  private conversationId: string
  private metrics: StepMetric[] = []
  private stepCounter = 0

  constructor(supabase: SupabaseClient, storeId: string, storeName: string, customerId?: string | null) {
    this.supabase = supabase
    this.storeId = storeId
    this.storeName = storeName
    this.customerId = customerId ?? null
    this.conversationId = crypto.randomUUID()
  }

  async init(): Promise<void> {
    await this.supabase.from('conversations').upsert(
      {
        id: this.conversationId,
        store_id: this.storeId,
        customer_id: this.customerId,
        channel: 'simulation',
        status: 'active',
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  }

  async send(message: string): Promise<SimulationStepResult> {
    // Save customer message to DB first (processAIChat expects it in history)
    await this.supabase.from('messages').insert({
      conversation_id: this.conversationId,
      content: message,
      is_from_customer: true,
      is_ai_response: false,
    })

    const stepIndex = this.stepCounter++
    const start = performance.now()

    const result = await processAIChat(this.supabase, {
      conversationId: this.conversationId,
      customerMessage: message,
      storeId: this.storeId,
      storeName: this.storeName,
      customerId: this.customerId,
      chatbotSettings: {},
    })

    const latency_ms = Math.round(performance.now() - start)

    this.metrics.push({
      stepIndex,
      message,
      intent: result.intent,
      response: result.response,
      latency_ms,
      products_found: result.metadata.products_found,
      orders_found: result.metadata.orders_found,
      orderStep: result.orderStep ?? null,
    })

    return { ...result, latency_ms, stepIndex }
  }

  async getState() {
    return readState(this.supabase, this.conversationId)
  }

  async getEscalationScore(): Promise<number> {
    const { data } = await this.supabase
      .from('conversations')
      .select('escalation_score')
      .eq('id', this.conversationId)
      .single()
    return (data?.escalation_score as number) ?? 0
  }

  getMetrics(): StepMetric[] {
    return [...this.metrics]
  }

  get id(): string {
    return this.conversationId
  }
}

/** Create a Supabase client for simulation testing. */
export function createSimulationSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
  )
}

/** Get the test store ID. */
export async function getTestStoreId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('stores')
    .select('id')
    .eq('name', 'Монгол Маркет')
    .single()
  if (!data?.id) throw new Error('Test store "Монгол Маркет" not found. Run supabase db reset.')
  return data.id
}

/** Get the test customer ID. */
export async function getTestCustomerId(supabase: SupabaseClient, storeId: string): Promise<string | null> {
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .limit(1)
    .single()
  return data?.id ?? null
}
