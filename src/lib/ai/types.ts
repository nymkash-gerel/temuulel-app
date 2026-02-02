// ComplaintSummarizer
export interface ComplaintSummaryInput {
  complaint_text: string
}

export interface ComplaintSummaryOutput {
  summary: string
  main_issues: string[]
  sentiment: 'angry' | 'frustrated' | 'neutral'
  action_hint: string
}

// RecommendationWriter
export interface ProductForRecommendation {
  name: string
  description: string
  base_price: number
  sales_script: string | null
}

export interface RecommendationInput {
  products: ProductForRecommendation[]
  customer_query: string
}

export interface RecommendationOutput {
  message: string
}

// AnalyticsInsightGenerator
export interface AnalyticsStats {
  period: string
  revenue: number
  revenueChange: number
  orderCount: number
  avgOrderValue: number
  newCustomers: number
  totalCustomers: number
  topProducts: { name: string; quantity: number; revenue: number }[]
  aiResponseRate: number
  totalMessages: number
  pendingOrders: number
  cancelledOrders: number
}

export interface InsightOutput {
  insights: string[]
  tone: 'positive' | 'neutral' | 'warning'
}

// MessageTagger
export interface MessageTagOutput {
  sentiment: 'positive' | 'neutral' | 'negative'
  tags: string[]
}

// ComplaintClassifier
export interface ComplaintClassificationInput {
  complaint_text: string
}

export type ComplaintCategory =
  | 'food_quality'
  | 'wrong_item'
  | 'delivery_delay'
  | 'service_quality'
  | 'damaged_item'
  | 'pricing_error'
  | 'staff_behavior'
  | 'other'

export interface ComplaintClassificationOutput {
  category: ComplaintCategory
  confidence: number
  suggested_response: string
}

// ProductEnricher
export interface ProductEnrichmentInput {
  name: string
  description: string
  category: string
  base_price: number
}

export interface ProductFAQs {
  size_fit?: string
  material?: string
  care?: string
  delivery?: string
  warranty?: string
  recommended_for?: string
}

export interface ProductEnrichmentOutput {
  search_aliases: string[]
  product_faqs: ProductFAQs
}
