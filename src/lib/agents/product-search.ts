/**
 * ProductAgent — Product search, discount detection, bundle queries.
 *
 * Wraps existing searchProducts with parallel search orchestration.
 */

import {
  searchProducts,
  searchOrders,
  searchAvailableTables,
  extractSearchTerms,
  checkStoreBusyMode,
  type TableMatch,
} from '@/lib/chat-ai'
import type { AgentContext, AgentProductCard, TriageResult } from './types'

export interface SearchResult {
  products: AgentProductCard[]
  orders: Array<{ id: string; order_number: string; status: string; total_amount: number }>
  tables: TableMatch[]
  busyMode: { busy_mode: boolean; estimated_wait_minutes?: number }
}

export class ProductAgent {
  readonly name = 'product-search'

  async search(ctx: AgentContext, triage: TriageResult): Promise<SearchResult> {
    const searchTerms = extractSearchTerms(ctx.normalizedMessage)
    const maxProducts = ctx.chatbotSettings.max_products ?? 5

    // Parallel search based on intent
    const [products, orders, tables, busyMode] = await Promise.all([
      triage.intent === 'product_search' || triage.intent === 'order_collection' || triage.intent === 'size_info' || triage.intent === 'shipping'
        ? searchProducts(ctx.supabase, searchTerms, ctx.storeId, { maxProducts })
        : Promise.resolve([]),
      triage.intent === 'order_status' && ctx.customerId
        ? searchOrders(ctx.supabase, ctx.storeId, ctx.customerId, ctx.message)
        : Promise.resolve([]),
      triage.intent === 'table_reservation'
        ? searchAvailableTables(ctx.supabase, ctx.storeId)
        : Promise.resolve([]),
      checkStoreBusyMode(ctx.supabase, ctx.storeId),
    ])

    return {
      products: products.map(p => ({
        name: p.name,
        base_price: p.base_price,
        description: p.description || '',
        images: p.images || [],
      })),
      orders,
      tables,
      busyMode,
    }
  }
}
