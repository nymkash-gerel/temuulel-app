/**
 * Shared types for the chat AI system.
 */

export interface ChatbotSettings {
  welcome_message?: string
  away_message?: string
  tone?: string
  language?: string
  show_prices?: boolean
  max_products?: number
  auto_handoff?: boolean
  handoff_keywords?: string
  escalation_enabled?: boolean
  escalation_threshold?: number
  escalation_message?: string
  return_policy?: string
}

export interface ProductVariantInfo {
  size: string | null
  color: string | null
  price: number
  stock_quantity: number
}

export interface ProductMatch {
  id: string
  name: string
  description: string
  category: string
  base_price: number
  images: string[]
  sales_script: string | null
  product_faqs?: Record<string, string> | null
  ai_context?: string | null
  variants?: ProductVariantInfo[]
  // Restaurant features
  available_today?: boolean
  sold_out?: boolean
  allergens?: string[]
  spicy_level?: number
  is_vegan?: boolean
  is_halal?: boolean
  is_gluten_free?: boolean
  dietary_tags?: string[]
}

export interface TableMatch {
  id: string
  table_name: string
  capacity: number
  status: string
  location: string | null
}

export interface OrderMatch {
  id: string
  order_number: string
  status: string
  total_amount: number
  tracking_number: string | null
  created_at: string
}

export interface MessageHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

export interface ActiveVoucherInfo {
  voucher_code: string
  compensation_type: string
  compensation_value: number
  valid_until: string
}

export interface RestaurantContext {
  availableTables?: TableMatch[]
  busyMode?: {
    busy_mode: boolean
    busy_message?: string | null
    estimated_wait_minutes?: number | null
  }
}
