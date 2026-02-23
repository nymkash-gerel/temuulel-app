/**
 * Shared AI chat logic — barrel re-export.
 *
 * This file previously contained all intent classification, search, and response
 * generation logic (~700 lines). It has been split into focused modules:
 *
 * - `text-normalizer.ts`    — normalizeText, neutralizeVowels
 * - `intent-classifier.ts`  — classifyIntent, classifyIntentWithConfidence
 * - `product-search.ts`     — searchProducts, searchOrders, searchAvailableTables, etc.
 * - `response-generator.ts` — generateResponse, generateAIResponse, formatPrice, etc.
 * - `chat-ai-types.ts`      — shared type definitions
 *
 * All exports are re-exported here for backwards compatibility.
 */

// Types
export type {
  ChatbotSettings,
  ProductVariantInfo,
  ProductMatch,
  TableMatch,
  OrderMatch,
  MessageHistoryEntry,
  ActiveVoucherInfo,
  RestaurantContext,
} from './chat-ai-types'

// Text normalization
export { normalizeText, neutralizeVowels } from './text-normalizer'

// Intent classification
export type { IntentResult } from './intent-classifier'
export {
  classifyIntent,
  classifyIntentWithConfidence,
  LOW_CONFIDENCE_THRESHOLD,
} from './intent-classifier'

// Product/order/table search
export {
  extractSearchTerms,
  extractLatinTerms,
  CATEGORY_MAP,
  searchProducts,
  searchAvailableTables,
  checkStoreBusyMode,
  searchOrders,
} from './product-search'
export type { SearchProductsOptions } from './product-search'

// Response generation
export {
  formatPrice,
  generateResponse,
  generateAIResponse,
  fetchRecentMessages,
  matchesHandoffKeywords,
} from './response-generator'
