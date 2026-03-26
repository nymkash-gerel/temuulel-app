/**
 * Agent module exports.
 *
 * The Supervisor pattern decomposes the monolithic processAIChat()
 * into focused, testable agents that communicate through the SupervisorAgent.
 */

export { SupervisorAgent } from './supervisor'
export { TriageAgent } from './triage'
export { GiftCardAgent } from './gift-card'
export { OrderCollectionAgent } from './order-collection'
export { ProductAgent } from './product-search'
export { ResponseAgent } from './response'
export { EscalationAgent } from './escalation'
export { CustomerIntelAgent } from './customer-intel'

export type {
  AgentContext,
  AgentResult,
  AgentProductCard,
  TriageResult,
  Agent,
} from './types'
export { emptyResult } from './types'
