/**
 * Comment Auto-Reply Module
 * Handles automatic replies to Facebook/Instagram post comments
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const GRAPH_API = 'https://graph.facebook.com/v18.0'

// Types
export interface FeedChangeValue {
  item: string  // 'comment' | 'reaction' | 'post' | 'status' | etc.
  verb: string  // 'add' | 'remove' | 'edit'
  comment_id?: string
  post_id?: string
  from: { id: string; name?: string }
  message?: string
  parent_id?: string  // For replies to comments (we skip these)
  created_time?: number
}

export interface CommentAutoRule {
  id: string
  store_id: string
  name: string
  enabled: boolean
  priority: number
  trigger_type: 'keyword' | 'any' | 'first_comment' | 'contains_question'
  keywords: string[] | null
  match_mode: 'any' | 'all'
  reply_comment: boolean
  reply_dm: boolean
  comment_template: string | null
  dm_template: string | null
  delay_seconds: number
  platforms: string[]
  matches_count: number
  replies_sent: number
  use_ai: boolean
  ai_context: string | null
}

interface StoreWithToken {
  id: string
  facebook_page_access_token: string
}

interface ProductInfo {
  id: string
  name: string
  base_price: number
  description: string | null
  ai_context: string | null
}

/**
 * Get Supabase admin client for server-side operations
 */
function getSupabase(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient<Database>(url, key)
}

/**
 * Handle a feed change event from Facebook webhook
 * Called when a comment is added to a post
 */
export async function handleFeedChange(
  pageId: string,
  change: FeedChangeValue,
  platform: 'facebook' | 'instagram' = 'facebook'
): Promise<void> {
  // Only process new comments (not edits, deletes, or reactions)
  if (change.item !== 'comment' || change.verb !== 'add') {
    console.log(`[Comment Auto-Reply] Skipping: item=${change.item}, verb=${change.verb}`)
    return
  }

  // Skip replies to comments - only handle top-level comments
  if (change.parent_id) {
    console.log('[Comment Auto-Reply] Skipping reply to comment')
    return
  }

  if (!change.comment_id || !change.post_id) {
    console.log('[Comment Auto-Reply] Missing comment_id or post_id')
    return
  }

  const supabase = getSupabase()

  // Find store by facebook_page_id or instagram_business_account_id
  const { data: store } = platform === 'instagram'
    ? await supabase
        .from('stores')
        .select('id, facebook_page_access_token')
        .eq('instagram_business_account_id', pageId)
        .single()
    : await supabase
        .from('stores')
        .select('id, facebook_page_access_token')
        .eq('facebook_page_id', pageId)
        .single()

  if (!store || !store.facebook_page_access_token) {
    console.log(`[Comment Auto-Reply] Store not found for pageId: ${pageId}`)
    return
  }

  console.log(`[Comment Auto-Reply] Processing comment for store: ${store.id}`)

  // Get enabled rules ordered by priority
  const { data: rules, error: rulesError } = await supabase
    .from('comment_auto_rules')
    .select('*')
    .eq('store_id', store.id)
    .eq('enabled', true)
    .order('priority', { ascending: true })

  if (rulesError) {
    console.error('[Comment Auto-Reply] Error fetching rules:', rulesError)
    return
  }

  if (!rules || rules.length === 0) {
    console.log('[Comment Auto-Reply] No enabled rules found')
    return
  }

  // Filter rules by platform
  const applicableRules = rules.filter(r =>
    r.platforms && r.platforms.includes(platform)
  )

  if (applicableRules.length === 0) {
    console.log(`[Comment Auto-Reply] No rules for platform: ${platform}`)
    return
  }

  // Find matching rule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchingRule = findMatchingRule(applicableRules as any, change)
  if (!matchingRule) {
    console.log('[Comment Auto-Reply] No matching rule found')
    return
  }

  console.log(`[Comment Auto-Reply] Matched rule: ${matchingRule.name}`)

  // Process reply (with optional delay)
  if (matchingRule.delay_seconds > 0) {
    console.log(`[Comment Auto-Reply] Delaying ${matchingRule.delay_seconds}s`)
    // For production, consider using a queue service instead of setTimeout
    setTimeout(() => {
      processCommentReply(store as StoreWithToken, matchingRule, change, platform, supabase)
    }, matchingRule.delay_seconds * 1000)
  } else {
    await processCommentReply(store as StoreWithToken, matchingRule, change, platform, supabase)
  }
}

/**
 * Find the first rule that matches the comment
 * Rules are already sorted by priority (ascending)
 */
function findMatchingRule(
  rules: CommentAutoRule[],
  change: FeedChangeValue
): CommentAutoRule | null {
  const commentText = (change.message || '').toLowerCase()

  for (const rule of rules) {
    let matches = false

    switch (rule.trigger_type) {
      case 'any':
        // Matches any comment
        matches = true
        break

      case 'keyword':
        if (rule.keywords && rule.keywords.length > 0) {
          const normalizedKeywords = rule.keywords.map(k => k.toLowerCase().trim())
          if (rule.match_mode === 'all') {
            // All keywords must be present
            matches = normalizedKeywords.every(kw => commentText.includes(kw))
          } else {
            // Any keyword matches
            matches = normalizedKeywords.some(kw => commentText.includes(kw))
          }
        }
        break

      case 'contains_question':
        // Matches comments with question marks or question words (Mongolian)
        matches = /\?|юу|хэзээ|хаана|яаж|хэд|хэн|ямар|яагаад|хэдий/i.test(commentText)
        break

      case 'first_comment':
        // Would need to track first-time commenters
        // For now, treat as "any" - can enhance later
        matches = true
        break
    }

    if (matches) {
      return rule
    }
  }

  return null
}

/**
 * Generate AI response for a comment
 */
async function generateAIResponseForComment(
  storeId: string,
  commentText: string,
  userName: string,
  aiContext: string | null,
  product: ProductInfo | null
): Promise<{ commentReply: string; dmReply: string } | null> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Build context for AI with product info if available
    let contextPrompt = `Хэрэглэгчийн нэр: ${userName}`

    if (product) {
      const priceFormatted = new Intl.NumberFormat('mn-MN').format(product.base_price) + '₮'
      contextPrompt = `БҮТЭЭГДЭХҮҮНИЙ МЭДЭЭЛЭЛ (энэ постын бүтээгдэхүүн):
- Нэр: ${product.name}
- Үнэ: ${priceFormatted}
${product.description ? `- Тодорхойлолт: ${product.description}` : ''}
${product.ai_context ? `\nБҮТЭЭГДЭХҮҮНИЙ AI ЗААВАР:\n${product.ai_context}` : ''}

Хэрэглэгч энэ бүтээгдэхүүний постонд сэтгэгдэл бичсэн. Хариултдаа энэ бүтээгдэхүүний мэдээллийг ашигла.

Хэрэглэгчийн нэр: ${userName}`
    }

    if (aiContext) {
      contextPrompt = `${aiContext}\n\n${contextPrompt}`
    }

    // Call the chat AI API with comment context
    const aiRes = await fetch(`${appUrl}/api/chat/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: storeId,
        customer_message: commentText,
        context: `[COMMENT REPLY] ${contextPrompt}`,
        is_comment: true,
        product_id: product?.id,
      }),
    })

    if (!aiRes.ok) {
      console.error('[Comment Auto-Reply] AI API error:', await aiRes.text())
      return null
    }

    const aiData = await aiRes.json()
    const response = typeof aiData?.response === 'string' ? aiData.response : null

    if (!response) {
      return null
    }

    // For comments, keep reply concise (under 200 chars for public)
    const commentReply = response.length > 200
      ? response.substring(0, 197) + '...'
      : response

    // DM can be longer
    const dmReply = response

    return { commentReply, dmReply }
  } catch (err) {
    console.error('[Comment Auto-Reply] AI generation error:', err)
    return null
  }
}

/**
 * Look up product by Facebook/Instagram post ID
 */
async function lookupProductByPostId(
  supabase: SupabaseClient<Database>,
  storeId: string,
  postId: string,
  platform: 'facebook' | 'instagram'
): Promise<ProductInfo | null> {
  const column = platform === 'instagram' ? 'instagram_post_id' : 'facebook_post_id'

  const { data: product } = await supabase
    .from('products')
    .select('id, name, base_price, description, ai_context')
    .eq('store_id', storeId)
    .eq(column, postId)
    .single()

  if (product) {
    console.log(`[Comment Auto-Reply] Found product for post: ${product.name}`)
    return {
      id: product.id,
      name: product.name,
      base_price: product.base_price,
      description: product.description,
      ai_context: product.ai_context,
    }
  }

  return null
}

/**
 * Process the comment reply (send public reply and/or DM)
 */
async function processCommentReply(
  store: StoreWithToken,
  rule: CommentAutoRule,
  change: FeedChangeValue,
  platform: 'facebook' | 'instagram',
  supabase: SupabaseClient<Database>
): Promise<void> {
  const variables: Record<string, string> = {
    user_name: change.from.name || 'Хэрэглэгч',
    comment_text: change.message || '',
  }

  // Look up product by post ID
  let product: ProductInfo | null = null
  if (change.post_id) {
    product = await lookupProductByPostId(supabase, store.id, change.post_id, platform)
    if (product) {
      // Add product variables for templates
      variables.product_name = product.name
      variables.product_price = new Intl.NumberFormat('mn-MN').format(product.base_price) + '₮'
    }
  }

  let replyCommentId: string | null = null
  let dmSent = false
  let status: 'success' | 'failed' = 'success'
  let errorMessage: string | null = null

  try {
    // Generate AI response if enabled
    let aiResponse: { commentReply: string; dmReply: string } | null = null
    if (rule.use_ai) {
      console.log(`[Comment Auto-Reply] Generating AI response... ${product ? `(Product: ${product.name})` : '(No product context)'}`)
      aiResponse = await generateAIResponseForComment(
        store.id,
        change.message || '',
        change.from.name || 'Хэрэглэгч',
        rule.ai_context,
        product
      )
      if (aiResponse) {
        console.log(`[Comment Auto-Reply] AI response generated: ${aiResponse.commentReply.substring(0, 50)}...`)
      }
    }

    // Reply to comment publicly
    if (rule.reply_comment) {
      let replyText: string | null = null

      if (rule.use_ai && aiResponse) {
        replyText = aiResponse.commentReply
      } else if (rule.comment_template) {
        replyText = substituteVariables(rule.comment_template, variables)
      }

      if (replyText) {
        console.log(`[Comment Auto-Reply] Sending public reply: ${replyText.substring(0, 50)}...`)
        replyCommentId = await replyToComment(
          change.comment_id!,
          replyText,
          store.facebook_page_access_token
        )
        console.log(`[Comment Auto-Reply] Public reply sent: ${replyCommentId}`)
      }
    }

    // Send private DM
    if (rule.reply_dm) {
      let dmText: string | null = null

      if (rule.use_ai && aiResponse) {
        dmText = aiResponse.dmReply
      } else if (rule.dm_template) {
        dmText = substituteVariables(rule.dm_template, variables)
      }

      if (dmText) {
        console.log(`[Comment Auto-Reply] Sending DM: ${dmText.substring(0, 50)}...`)
        dmSent = await sendPrivateReply(
          change.comment_id!,
          dmText,
          store.facebook_page_access_token
        )
        console.log(`[Comment Auto-Reply] DM sent: ${dmSent}`)
      }
    }
  } catch (err) {
    status = 'failed'
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Comment Auto-Reply] Error:', errorMessage)
  }

  // Determine reply type
  let replyType: 'comment' | 'dm' | 'both' = 'comment'
  if (rule.reply_comment && rule.reply_dm) {
    replyType = 'both'
  } else if (rule.reply_dm) {
    replyType = 'dm'
  }

  // Log the reply
  const { error: logError } = await supabase.from('comment_reply_logs').insert({
    store_id: store.id,
    rule_id: rule.id,
    comment_id: change.comment_id!,
    post_id: change.post_id!,
    platform,
    commenter_id: change.from.id,
    commenter_name: change.from.name || null,
    comment_text: change.message || null,
    reply_type: replyType,
    reply_comment_id: replyCommentId,
    reply_dm_sent: dmSent,
    status,
    error_message: errorMessage,
  })

  if (logError) {
    console.error('[Comment Auto-Reply] Error logging reply:', logError)
  }

  // Update rule stats
  const incrementReplies = status === 'success' ? 1 : 0
  const { error: statsError } = await supabase
    .from('comment_auto_rules')
    .update({
      matches_count: rule.matches_count + 1,
      replies_sent: rule.replies_sent + incrementReplies,
      last_triggered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', rule.id)

  if (statsError) {
    console.error('[Comment Auto-Reply] Error updating stats:', statsError)
  }
}

/**
 * Replace {{variable}} placeholders in template
 */
function substituteVariables(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

/**
 * Reply to a comment publicly via Facebook Graph API
 */
async function replyToComment(
  commentId: string,
  message: string,
  pageToken: string
): Promise<string> {
  const res = await fetch(
    `${GRAPH_API}/${commentId}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: pageToken,
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to reply to comment: ${errText}`)
  }

  const data = await res.json()
  return data.id
}

/**
 * Send a private reply (DM) to the commenter via Messenger API
 * Uses comment_id as recipient reference
 */
async function sendPrivateReply(
  commentId: string,
  message: string,
  pageToken: string
): Promise<boolean> {
  const res = await fetch(
    `${GRAPH_API}/me/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: message },
        access_token: pageToken,
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    console.error('[Comment Auto-Reply] Private reply failed:', errText)
    // Don't throw - private reply failures shouldn't stop the flow
    return false
  }

  return true
}
