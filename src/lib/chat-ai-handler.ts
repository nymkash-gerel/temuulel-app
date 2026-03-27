/**
 * Shared AI chat processing logic.
 *
 * Extracted from /api/chat/ai so the Messenger webhook can call it
 * directly with a service-role Supabase client — avoiding the HTTP
 * round-trip and cookie-based auth issues that break RLS writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCustomerProfile } from './ai/customer-profile'
import { resolve } from './resolution-engine'
import { getLatestPurchase, formatPurchaseConfirmation, getExtendedCustomerInfo, formatExtendedProfileForAI, inferPreferencesFromMessage, savePreference, logInteraction } from './ai/customer-intelligence'
import { hybridClassify, hybridClassifyAsync } from '@/lib/ai/hybrid-classifier'
import {
  extractSearchTerms,
  searchProducts,
  searchOrders,
  searchAvailableTables,
  checkStoreBusyMode,
  generateAIResponse,
  generateResponse,
  formatPrice,
  fetchRecentMessages,
  type ChatbotSettings,
  type TableMatch,
} from '@/lib/chat-ai'
import {
  readState,
  writeState,
  resolveFollowUp,
  updateState,
  type StoredProduct,
  type OrderDraft,
  type CartItem,
  type GiftCardDraft,
  getDraftItems,
  getDraftTotal,
} from '@/lib/conversation-state'
import { normalizeText } from '@/lib/chat-ai'
import {
  purchaseGiftCard,
  lookupGiftCard,
  redeemGiftCard,
  transferGiftCard,
  extractGiftCardCode,
  parseGiftCardAmount,
  formatGiftCardBalance,
  GIFT_CARD_DENOMINATIONS,
} from '@/lib/gift-card-engine'
import { dispatchNotification } from '@/lib/notifications'
import { isOpenAIConfigured } from '@/lib/ai/openai-client'
import { calculateDeliveryFee } from '@/lib/delivery-fee-calculator'
import { createQPayInvoice, checkQPayPayment, isQPayConfigured } from '@/lib/qpay'

import { SupervisorAgent } from '@/lib/agents'
import type { AgentContext } from '@/lib/agents'
import { logger } from '@/lib/logger'

const DEFAULT_DELIVERY_FEE = 5000

/**
 * Feature flag: enable Supervisor agent routing.
 * - 'off': use existing pipeline (default, safe)
 * - 'shadow': run both, log comparison, return old result
 * - 'on': fully delegate to SupervisorAgent
 *
 * Set via SUPERVISOR_MODE env var or chatbot_settings.
 */
type SupervisorMode = 'off' | 'shadow' | 'on'

function getSupervisorMode(): SupervisorMode {
  const env = process.env.SUPERVISOR_MODE
  if (env === 'on' || env === 'shadow') return env
  return 'off'
}

export interface AIProcessingContext {
  conversationId: string
  customerMessage: string
  storeId: string
  storeName: string
  customerId: string | null
  chatbotSettings: ChatbotSettings
}

export interface AIProductCard {
  name: string
  base_price: number
  description: string
  images: string[]
}

export interface AIProcessingResult {
  response: string
  intent: string
  messageId?: string
  products: AIProductCard[]
  metadata: {
    products_found: number
    orders_found: number
  }
  /** Active order draft step — used by webhook to send Quick Replies */
  orderStep?: 'variant' | 'info' | 'name' | 'address' | 'phone' | 'confirming' | null
}

/**
 * Process a customer message through the AI pipeline:
 * classify intent → search products/orders → generate response → save to DB.
 *
 * Optimized: parallel DB fetches, fire-and-forget writes where possible.
 */
export async function processAIChat(
  supabase: SupabaseClient,
  ctx: AIProcessingContext
): Promise<AIProcessingResult> {
  const mode = getSupervisorMode()

  // ── SUPERVISOR_MODE=on → fully delegate to SupervisorAgent ──
  if (mode === 'on') {
    return processViaSupervisor(supabase, ctx)
  }

  const {
    conversationId,
    customerMessage,
    storeId,
    storeName,
    customerId,
    chatbotSettings,
  } = ctx

  // ── SUPERVISOR_MODE=shadow → run both, compare, return old ──
  if (mode === 'shadow') {
    // Dry-run: run supervisor for comparison logging only — no DB writes
    processViaSupervisorDryRun(supabase, ctx)
      .then(supervisorResult => {
        console.log('[shadow] Supervisor intent:', supervisorResult.intent, 'products:', supervisorResult.metadata.products_found)
      })
      .catch(err => {
        console.error('[shadow] Supervisor error:', err?.message || err)
      })
  }

  // --- Parallel: fetch conversation state + busy mode + customer profile ---
  const [state, busyMode, customerProfile] = await Promise.all([
    readState(supabase, conversationId),
    checkStoreBusyMode(supabase, storeId),
    customerId
      ? buildCustomerProfile(supabase, customerId, storeId).catch(err => { console.error('[customer-profile]', err); return null })
      : Promise.resolve(null),
  ])

  // ── Gift card flow intercept ────────────────────────────────────────────
  // Runs BEFORE followUp/order flow so gift card steps take priority.
  const gcResult = await handleGiftCardFlow(supabase, {
    customerMessage,
    storeId,
    customerId,
    state,
    conversationId,
  })
  if (gcResult) {
    // Save updated state and return the gift card response
    await writeState(supabase, conversationId, {
      ...state,
      last_intent: gcResult.intent,
      turn_count: state.turn_count + 1,
      gift_card_draft: gcResult.giftCardDraft,
      pending_gift_card_code: gcResult.pendingGiftCardCode,
    })
    // Save message to DB
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: gcResult.response,
      is_from_customer: false,
    })
    return {
      response: gcResult.response,
      intent: gcResult.intent,
      products: [],
      metadata: { products_found: 0, orders_found: 0 },
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  const followUp = resolveFollowUp(customerMessage, state)

  let intent: string
  let products: Awaited<ReturnType<typeof searchProducts>> = []
  let orders: Awaited<ReturnType<typeof searchOrders>> = []
  let tables: TableMatch[] = []
  let responseText: string
  // If resolveFollowUp returned null but there WAS an order draft, it means
  // the user sent an off-topic message — clear the draft so they can browse freely.
  let orderDraft: OrderDraft | null = (!followUp && state.order_draft) ? null : (state.order_draft ?? null)

  if (followUp) {
    switch (followUp.type) {
      case 'order_step_input': {
        const draft = { ...state.order_draft! }
        intent = 'order_collection'

        switch (draft.step) {
          case 'variant': {
            // Use product_id from items[0] or legacy field
            const selectingProductId = draft.items?.[0]?.product_id || draft.product_id
            const { data: variants } = await supabase
              .from('product_variants')
              .select('id, size, color, price, stock_quantity')
              .eq('product_id', selectingProductId)
              .gt('stock_quantity', 0)

            const resolvedMulti = resolveVariantsFromMessage(customerMessage, variants ?? [])
            if (resolvedMulti.length > 0) {
              // Build cart items from selected variants
              const productName = draft.items?.[0]?.product_name || draft.product_name || ''
              const basePrice = draft.items?.[0]?.unit_price || draft.unit_price || 0
              const newItems: CartItem[] = resolvedMulti.map(v => ({
                product_id: selectingProductId!,
                product_name: productName,
                variant_id: v.id,
                variant_label: [v.size, v.color].filter(Boolean).join('/'),
                unit_price: v.price ?? basePrice,
                quantity: 1,
              }))

              draft.items = newItems
              // Also set legacy fields from first item for backward compat
              draft.variant_id = newItems[0].variant_id
              draft.variant_label = newItems[0].variant_label
              draft.unit_price = newItems[0].unit_price

              // Move to name step
              draft.step = 'name'
              orderDraft = draft
              responseText = 'Нэрээ бичнэ үү:'
            } else {
              orderDraft = draft
              responseText = 'Аль хувилбарыг сонгохоо дугаараар бичнэ үү:'
            }
            break
          }

          case 'info':
          case 'name': {
            // Step: collect customer name
            // Any non-empty text that isn't a phone/address is treated as name
            const namePhone = extractPhone(customerMessage)
            const nameAddr = extractAddress(customerMessage, namePhone)
            if (!namePhone && !nameAddr && customerMessage.trim().length >= 2) {
              draft.customer_name = customerMessage.trim()
              draft.step = 'address'
              orderDraft = draft
              responseText = `${draft.customer_name}, хүргэлтийн хаягаа бичнэ үү (дүүрэг, хороо, байр):`
            } else if (nameAddr) {
              // Customer skipped name and sent address directly — accept it
              draft.address = nameAddr
              draft.step = 'phone'
              orderDraft = draft
              responseText = 'Утасны дугаараа бичнэ үү:'
            } else {
              orderDraft = draft
              responseText = 'Нэрээ бичнэ үү:'
            }
            break
          }

          case 'address': {
            // Step: collect delivery address
            const addrPhone = extractPhone(customerMessage)
            const addr = extractAddress(customerMessage, addrPhone)
            if (addr) {
              draft.address = addr
              draft.step = 'phone'
              orderDraft = draft
              responseText = 'Утасны дугаараа бичнэ үү:'
            } else {
              orderDraft = draft
              responseText = 'Хүргэлтийн хаягаа бичнэ үү (дүүрэг, хороо, байр):'
            }
            break
          }

          case 'phone': {
            // Step: collect phone number (ONLY after address)
            const phone = extractPhone(customerMessage)
            if (phone) {
              draft.phone = phone
              draft.step = 'confirming'
              orderDraft = draft
              responseText = buildOrderSummary(draft)
            } else {
              orderDraft = draft
              responseText = '8 оронтой утасны дугаараа бичнэ үү:'
            }
            break
          }

          case 'confirming': {
            // If the customer is clearly complaining mid-order, acknowledge it
            // and keep the draft alive so they can confirm/cancel later.
            const isComplaint = /yaagaad|uulaad|uurlasan|udaan|mongoo|butsaaj|munguu|гомдол|(?<![а-яөүё])муу(?![а-яөүё])|буцаа|яагаад|уурла|удаан/i.test(customerMessage)
            if (isComplaint && !isAffirmative(customerMessage) && !isNegative(customerMessage)) {
              orderDraft = draft
              intent = 'complaint'
              responseText = 'Уучлаарай, таньд тохиромжгүй байдалд хүрсэнд харамсаж байна. Захиалгаа үргэлжлүүлэх үү? (Тийм/Үгүй)'
              break
            }
            if (isAffirmative(customerMessage)) {
              const order = await createOrderFromChat(supabase, storeId, customerId, draft)
              orderDraft = null
              if (order) {
                const confirmItems = getDraftItems(draft)
                const confirmTotal = getDraftTotal(draft)
                const isIntercityOrder = order.delivery_fee === 0 && draft.address
                  ? calculateDeliveryFee(draft.address).type === 'intercity'
                  : false

                // Build items list for confirmation message
                let itemsText: string
                if (confirmItems.length > 1) {
                  itemsText = confirmItems.map(item => {
                    const label = item.variant_label ? ` (${item.variant_label})` : ''
                    return `📦 ${item.product_name}${label} x${item.quantity}`
                  }).join('\n')
                } else {
                  const item = confirmItems[0]
                  itemsText = `📦 ${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ''} x${item.quantity}`
                }

                if (isIntercityOrder) {
                  responseText = `✅ Захиалга амжилттай!\n\n📋 Захиалгын дугаар: ${order.order_number}\n${itemsText}\n💰 Бараа: ${formatPrice(confirmTotal)}\n🚌 Хүргэлт: Автобус / шуудан\n   ⚠️ Тээврийн үнэ хүлээн авахдаа төлнө\n📍 Хаяг: ${draft.address}\n📱 Утас: ${draft.phone}\n\nАсуулт байвал дэлгүүртэй холбогдоно уу. Баярлалаа! 🙏`
                } else {
                  responseText = `✅ Захиалга амжилттай!\n\n📋 Захиалгын дугаар: ${order.order_number}\n${itemsText}\n💰 Бараа: ${formatPrice(confirmTotal)}\n🚚 Хүргэлт: ${formatPrice(order.delivery_fee)}\n💰 Нийт: ${formatPrice(order.total_amount)}\n📍 Хаяг: ${draft.address}\n📱 Утас: ${draft.phone}\n\nЖолооч тантай холбогдоно. Утсаа нээлттэй байлгаарай 📞 Баярлалаа!`
                }
                intent = 'order_created'
              } else {
                responseText = '⚠️ Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.'
              }
            } else if (isNegative(customerMessage)) {
              orderDraft = null
              responseText = '❌ Захиалга цуцлагдлаа. Өөр асуух зүйл байвал бичнэ үү!'
            } else {
              // Not clear yes/no — remind them
              orderDraft = draft
              responseText = 'Захиалгаа баталгаажуулах уу? (Тийм/Үгүй)'
            }
            break
          }

          default:
            orderDraft = null
            responseText = 'Захиалгын алхам алдаатай байна. Дахин оролдоно уу.'
        }
        break
      }

      case 'order_intent': {
        const result = await startOrderDraft(supabase, followUp.product!, customerMessage, storeId, customerId)
        intent = 'order_collection'
        orderDraft = result.draft
        responseText = result.responseText
        break
      }

      case 'order_cancel': {
        orderDraft = null
        responseText = '❌ Захиалга цуцлагдлаа. Өөр асуух зүйл байвал бичнэ үү!'
        intent = 'general'
        break
      }

      case 'number_reference':
      case 'select_single': {
        const p = followUp.product!
        // Directly start order draft — no intermediate "захиалмаар байвал бичнэ үү" step
        const result = await startOrderDraft(
          supabase,
          { id: p.id, name: p.name, base_price: p.base_price },
          customerMessage, storeId, customerId,
        )
        orderDraft = result.draft
        responseText = result.responseText
        intent = 'order_collection'
        // Fetch full product data for cards
        const [detailProducts] = await Promise.all([
          searchProducts(supabase, p.name, storeId, { maxProducts: 1, originalQuery: p.name }),
        ])
        if (detailProducts.length > 0) {
          products = detailProducts
        }
        break
      }
      case 'price_question': {
        intent = 'price_info'
        const priceList = followUp.products!
          .map((p, i) => `${i + 1}. ${p.name} — ${formatPrice(p.base_price)}`)
          .join('\n')
        responseText = `Үнийн мэдээлэл:\n\n${priceList}`
        break
      }
      case 'query_refinement': {
        intent = 'product_search'
        // Parallel: search products + fetch history
        const [refProducts, refHistory] = await Promise.all([
          searchProducts(supabase, followUp.refinedQuery!, storeId, {
            maxProducts: chatbotSettings.max_products,
            originalQuery: followUp.refinedQuery!,
          }),
          isOpenAIConfigured() ? fetchRecentMessages(supabase, conversationId) : Promise.resolve(undefined),
        ])
        products = refProducts
        responseText = await generateAIResponse(
          intent, products, orders, storeName, followUp.refinedQuery!, chatbotSettings, refHistory,
          undefined, undefined, customerProfile
        )
        break
      }
      case 'size_question':
      case 'contextual_question':
      case 'prefer_llm': {
        intent = followUp.type === 'size_question' ? 'size_info'
          : followUp.type === 'contextual_question' ? 'general'
          : (await hybridClassifyAsync(customerMessage)).intent
        // Anchor to selected product for informational follow-ups (size, material, care, etc.)
        // product_search stays as a fresh search — user is explicitly looking for something new.
        const isInfoFollowUp = (intent === 'size_info' || intent === 'general') && state.last_products.length > 0
        const searchTerms = isInfoFollowUp
          ? state.last_products[0].name
          : extractSearchTerms(customerMessage)

        // Parallel: search + history fetch based on intent
        const [llmProducts, llmOrders, llmHistory] = await Promise.all([
          (intent === 'product_search' || intent === 'general' || intent === 'size_info')
            ? searchProducts(supabase, searchTerms, storeId, { maxProducts: chatbotSettings.max_products, originalQuery: customerMessage })
            : Promise.resolve([]),
          (intent === 'order_status')
            ? searchOrders(supabase, searchTerms, storeId, customerId ?? undefined)
            : Promise.resolve([]),
          isOpenAIConfigured() ? fetchRecentMessages(supabase, conversationId) : Promise.resolve(undefined),
        ])
        products = llmProducts.length > 0 ? llmProducts : products
        orders = llmOrders
        responseText = await generateAIResponse(
          intent, products, orders, storeName, customerMessage, chatbotSettings, llmHistory,
          undefined, undefined, customerProfile
        )
        break
      }
      default:
        intent = 'general'
        responseText = generateResponse(intent, products, orders, storeName, chatbotSettings)
    }
  } else {
    // Normal classification path — async with GPT fallback for low confidence
    intent = (await hybridClassifyAsync(customerMessage)).intent

    if (busyMode.busy_mode && ['product_search', 'table_reservation', 'menu_availability'].includes(intent)) {
      const waitMsg = busyMode.estimated_wait_minutes
        ? ` Хүлээлтийн хугацаа: ${busyMode.estimated_wait_minutes} минут.`
        : ''
      responseText = busyMode.busy_message
        || `⚠️ Одоогоор захиалга түр хаасан байна.${waitMsg} Тун удахгүй дахин оролдоно уу!`
      intent = 'busy_mode'
    } else {
      // Anchor to selected product for informational follow-ups (size, material, care, etc.)
      // product_search stays as a fresh search — user is explicitly looking for something new.
      const isInfoFollowUp = (intent === 'size_info' || intent === 'general') && state.last_products.length > 0
      const searchTerms = isInfoFollowUp
        ? state.last_products[0].name
        : extractSearchTerms(customerMessage)

      // Parallel: all DB fetches + history in one batch
      const [searchedProducts, searchedOrders, searchedTables, history] = await Promise.all([
        (intent === 'product_search' || intent === 'general' || intent === 'menu_availability' || intent === 'allergen_info' || intent === 'size_info')
          ? searchProducts(supabase, searchTerms, storeId, {
              maxProducts: chatbotSettings.max_products,
              originalQuery: customerMessage,
              availableOnly: intent === 'menu_availability',
            })
          : Promise.resolve([]),
        (intent === 'order_status')
          ? searchOrders(supabase, searchTerms, storeId, customerId ?? undefined)
          : Promise.resolve([]),
        (intent === 'table_reservation')
          ? searchAvailableTables(supabase, storeId)
          : Promise.resolve([] as TableMatch[]),
        isOpenAIConfigured()
          ? fetchRecentMessages(supabase, conversationId)
          : Promise.resolve(undefined),
      ])

      products = searchedProducts
      orders = searchedOrders
      tables = searchedTables

      // Fallback: if the primary search returned nothing for product-related intents,
      // try an empty-string search to show all available products.
      // This handles Latin-typed queries like "buh baraa" (→ "бух бараа" after
      // normalizeText, which misses "бүх бараа") and generic browse requests
      // like "жагсаалт", "catalog", "bara uzi".
      if (
        products.length === 0 &&
        (intent === 'product_search' || intent === 'general' || intent === 'low_confidence')
      ) {
        const browseAll = await searchProducts(supabase, '', storeId, {
          maxProducts: chatbotSettings.max_products,
        })
        if (browseAll.length > 0) {
          products = browseAll
          intent = 'product_search'
        }
      }

      // ── Customer intelligence (all non-critical, wrapped in try/catch) ──
      let latestPurchaseSummary: string | null = null
      let extendedProfile: string | null = null

      try {
        // Auto-lookup: if order_status/shipping with no specific order found, fetch customer's recent orders
        if ((intent === 'order_status' || intent === 'shipping') && orders.length === 0 && customerId) {
          const latestPurchase = await getLatestPurchase(supabase, customerId, storeId)
          if (latestPurchase) {
            orders = [{
              id: latestPurchase.order_id,
              order_number: latestPurchase.order_number,
              status: latestPurchase.status,
              total_amount: latestPurchase.total_amount,
              created_at: latestPurchase.created_at,
              tracking_number: null,
            }] as typeof orders
          }
        }

        // Auto-lookup: for return/complaint, fetch latest purchase for confirmation
        if ((intent === 'return_exchange' || intent === 'complaint') && customerId) {
          const latestPurchase = await getLatestPurchase(supabase, customerId, storeId)
          if (latestPurchase) {
            latestPurchaseSummary = formatPurchaseConfirmation(latestPurchase)
          }
          void logInteraction(supabase, customerId, storeId, {
            type: intent === 'return_exchange' ? 'return_request' : 'complaint',
            summary: customerMessage,
          }).catch(err => logger.warn("Silent catch error", err))
        }

        // Build extended profile for AI personalization
        if (customerId) {
          const extInfo = await getExtendedCustomerInfo(supabase, customerId, storeId)
          extendedProfile = formatExtendedProfileForAI(extInfo) || null

          const inferred = inferPreferencesFromMessage(customerMessage)
          if (inferred.length > 0) {
            void Promise.all(inferred.map(p =>
              savePreference(supabase, customerId, storeId, {
                type: p.type, key: p.key, value: p.value,
                confidence: 0.5, source: 'inferred',
              })
            )).catch(err => logger.warn("Silent catch error", err))
          }
        }
      } catch (err) {
        console.error('[Intelligence] Non-critical error:', err instanceof Error ? err.message : err)
        // Continue with normal response — intelligence features are optional
      }

      // Guard: standalone 8-digit number in product-search context.
      // When the bot shows products and says "Бараа дугаараа бичнэ үү (1, 2, 3...):",
      // users sometimes send their phone number thinking we asked for contact info.
      // Detect this and start the order draft with the phone pre-filled.
      const phoneIntercepted = /^\d{8}$/.test(customerMessage.trim())
        && state.last_intent === 'product_search'
        && state.last_products.length > 0

      if (phoneIntercepted) {
        const product = state.last_products[0]
        const startResult = await startOrderDraft(
          supabase, { id: product.id, name: product.name, base_price: product.base_price }, customerMessage, storeId, customerId,
        )
        startResult.draft.phone = customerMessage.trim()
        orderDraft = startResult.draft
        responseText = buildInfoRequest(orderDraft)
        intent = 'order_collection'
      } else {
        // Pre-check: "X өмд", "Y цамц" etc. where X/Y is not in any product name → staff, no LLM
        let unlistedProductDetected = false
        if (intent === 'product_search' && products.length > 0) {
          const msgNorm = normalizeText(customerMessage).toLowerCase()
          const PRODUCT_TYPES = ['цамц', 'өмд', 'гутал', 'цүнх', 'малгай', 'куртка', 'свитер', 'кофт', 'даашинз', 'костюм', 'хантааз', 'жакет', 'пальто']
          const productType = PRODUCT_TYPES.find(t => msgNorm.split(/\s+/).some(w => w === t || w.startsWith(t)))
          if (productType) {
            const words = msgNorm.split(/\s+/)
            const typeIdx = words.findIndex(w => w === productType || w.startsWith(productType))
            const modifiers = words.slice(0, typeIdx).filter(w => w.length >= 3)
            if (modifiers.length > 0) {
              const allProductNameWords = new Set(
                products.flatMap(p => normalizeText(p.name).toLowerCase().split(/\s+/).filter(w => w.length >= 3))
              )
              const modifierInCatalog = modifiers.some(m =>
                allProductNameWords.has(m) || [...allProductNameWords].some(pw => pw.includes(m) || m.includes(pw))
              )
              if (!modifierInCatalog) {
                unlistedProductDetected = true
                let notFoundMsg = 'Уучлаарай, тэр бараа одоогоор байхгүй байна 😊'
                // Show top 3 products so the customer finds something useful
                const topProducts = products.slice(0, 3)
                if (topProducts.length > 0) {
                  notFoundMsg += '\n\nМанай бараанууд:\n'
                  topProducts.forEach((p, i) => {
                    notFoundMsg += `${i + 1}. **${p.name}** — ${formatPrice(p.base_price)}\n`
                  })
                  notFoundMsg += '\nЭсвэл юу хайж байгаагаа тодруулж бичвэл туслая!'
                } else {
                  notFoundMsg += '\n\nЮу хайж байгаагаа тодруулж бичвэл тохирох бараа олоход туслая!'
                }
                responseText = notFoundMsg
                void dispatchNotification(storeId, 'new_message', {
                  message: `🔍 Chatbot: Жагсаалтад байхгүй бүтээгдэхүүн асуусан: "${customerMessage}"`,
                  conversationId,
                  storeId,
                }).catch(err => logger.warn("Silent catch error", err))
              }
            }
          }
        }

        if (!unlistedProductDetected) {
          // Bare price query: "Үнэ хэд вэ", "Хэдэн төгрөг вэ" — no specific product named.
          // If we have conversation context (last discussed product) → show that product's price.
          // If no context → ask "Ямар бараа вэ?" instead of dumping all prices.
          const BARE_PRICE_WORDS = new Set(['үнэ', 'үнэтэй', 'унэ', 'унэтэй', 'price', 'хэд', 'хэдэн'])
          const priceTermWords = extractSearchTerms(customerMessage).split(/\s+/).filter(Boolean)
          const hasPriceKeyword = /үнэ|хэд|price|how much|хэдэн/i.test(normalizeText(customerMessage))
          const isPriceOnlyQuery = intent === 'product_search'
            && hasPriceKeyword
            && (priceTermWords.length === 0 || priceTermWords.every(w => BARE_PRICE_WORDS.has(w)))

          // Discount-only query: "Хямдрал байгаа юу" → surface any set/bundle products
          // Don't show all products as if they're all discounted
          let earlyResponseSet = false
          if (intent === 'product_search') {
            const msgNormDiscount = normalizeText(customerMessage).toLowerCase()
            const DISCOUNT_WORDS = ['хямдрал байгаа', 'хямдрал бна', 'хямдарсан', 'sale байна', 'хямдрал бий', 'хямдрал вэ', 'хямдрал байна уу']
            const isDiscountOnlyQuery = DISCOUNT_WORDS.some(w => msgNormDiscount.includes(w))
              && !msgNormDiscount.includes('цамц') && !msgNormDiscount.includes('өмд')
              && !msgNormDiscount.includes('leevchik') && !msgNormDiscount.includes('skims')
            if (isDiscountOnlyQuery) {
              const setProds = await searchProducts(supabase, 'сет', storeId, { maxProducts: 3 })
              const bundles = setProds.filter(p => normalizeText(p.name).toLowerCase().includes('сет'))
              if (bundles.length > 0) {
                products = bundles  // LLM will explain set savings as value
              } else {
                // Show current product prices so customer still gets useful info
                let discountMsg = 'Одоогоор тусгай хямдрал байхгүй байна.'
                const topForDiscount = products.slice(0, 3)
                if (topForDiscount.length > 0) {
                  discountMsg += ' Манай бараанууд:\n'
                  topForDiscount.forEach((p, i) => {
                    discountMsg += `${i + 1}. **${p.name}** — ${formatPrice(p.base_price)}\n`
                  })
                  discountMsg += '\nШинэ санал гарвал мэдэгдэх болно 😊'
                } else {
                  discountMsg += ' Шинэ санал гарвал мэдэгдэх болно 😊'
                }
                responseText = discountMsg
                earlyResponseSet = true
              }
            }
          }

          // Bundle/set query: "цамц өмд хамт авах" → surface the set product explicitly
          // so LLM can compare set price vs buying separately
          if (intent === 'product_search') {
            const msgNormLower = normalizeText(customerMessage).toLowerCase()
            const hasCamts = msgNormLower.includes('цамц') || msgNormLower.includes('camts')
            const hasUmd = msgNormLower.includes('өмд') || msgNormLower.includes('umd')
            const hasBundleContext = /хамт|сет|set|нийлэ|bundle/i.test(msgNormLower) || /хямдард|хэмнэ|хямдрал/i.test(msgNormLower)
            if (hasCamts && hasUmd && hasBundleContext) {
              // Search for the set/bundle product (e.g. "Цамц + Тарпизан өмд сет")
              const bundleProducts = await searchProducts(supabase, 'сет', storeId, { maxProducts: 3 })
              const setProducts = bundleProducts.filter(p => normalizeText(p.name).toLowerCase().includes('сет'))
              if (setProducts.length > 0) {
                // Prepend set product so LLM sees it first
                products = [...setProducts, ...products.filter(p => !setProducts.some(b => b.id === p.id))].slice(0, 5)
              }
            }
          }

          if (!earlyResponseSet && isPriceOnlyQuery && state.last_products.length === 0) {
            // No context — ask which product they're interested in
            responseText = 'Ямар бараа сонирхож байна вэ? Үнэ болон дэлгэрэнгүй мэдээлэл өгье 😊'
          } else if (!earlyResponseSet && intent === 'product_search' && products.length === 0) {
            // HALLUCINATION GUARD: No products found — use template instead of LLM.
            responseText = 'Уучлаарай, тэр бараа одоогоор байхгүй байна. Юу хайж байгаагаа тодруулж бичвэл тохирох бараа олоход туслая! 😊'
            earlyResponseSet = true

            void dispatchNotification(storeId, 'new_message', {
              message: `🔍 Chatbot: Жагсаалтад байхгүй бүтээгдэхүүн асуусан: "${customerMessage}"`,
              conversationId,
              storeId,
            }).catch(err => logger.warn("Silent catch error", err))
          } else if (!earlyResponseSet && intent === 'product_search' && products.length > 0) {
            // PRODUCTS FOUND — use confidence-based template, skip GPT entirely.
            const p = products[0]
            const confidence = (p as { searchConfidence?: number }).searchConfidence ?? 1.0
            const salesScript = (p as { sales_script?: string }).sales_script

            if (confidence >= 0.85) {
              // High confidence — exact or near-exact match
              if (salesScript) {
                responseText = salesScript
              } else if (products.length === 1) {
                responseText = `Байна! Сонирхвол дугаараа бичнэ үү 😊`
              } else {
                responseText = `${products.length} бараа олдлоо! Аль нэгийг сонирхвол дугаараа бичнэ үү 😊`
              }
            } else if (confidence >= 0.6) {
              // Medium confidence — "Энэ мөн үү?"
              responseText = `Таны хайсан бараа энэ мөн үү? 👇`
            } else {
              // Low confidence — soft suggestion
              responseText = `Яг таны хайсан бараа олдсонгүй. Гэхдээ энэ бараа таалагдаж магадгүй 👇`
            }
            earlyResponseSet = true
          } else if (!earlyResponseSet) {
            if (isPriceOnlyQuery && state.last_products.length > 0) {
              // Re-fetch full product data for last discussed product (StoredProduct has no variants/desc)
              const refetched = await searchProducts(supabase, state.last_products[0].name, storeId, { maxProducts: 1 })
              if (refetched.length > 0) products = refetched
            }
        // Resolution Engine: enrich with business context (customer history, delivery status, etc.)
        let resolution = null
        try {
          resolution = await resolve(supabase, {
            intent, message: customerMessage, storeId, customerId, products,
          })
        } catch { /* non-critical — continue without resolution */ }

        responseText = await generateAIResponse(
          intent, products, orders, storeName, customerMessage, chatbotSettings, history,
          undefined,
          { availableTables: tables, busyMode },
          customerProfile,
          extendedProfile,
          latestPurchaseSummary,
          resolution,
        )

        // If the LLM said "product not in catalog, staff will check" → fire staff notification.
        if (intent === 'product_search' && (responseText.includes('байхгүй байна') || responseText.includes('олдсонгүй'))) {
          void dispatchNotification(storeId, 'new_message', {
            message: `🔍 Chatbot: Жагсаалтад байхгүй бүтээгдэхүүн асуусан: "${customerMessage}"`,
            conversationId,
            storeId,
          }).catch(err => logger.warn("Silent catch error", err))
        }
          } // end else (generateAIResponse path)
        } // end !unlistedProductDetected

        // If the message contains order intent, start order flow.
        // Skip if already classified as order_status or complaint —
        // "захиалга маань ирэхгүй" is a complaint, not a new order request.
        // Also skip if the message is a recommendation/exploration query —
        // "авмаар байна. Юу санал болгох вэ?" = browsing, not ready-to-buy.
        const RECOMMENDATION_SIGNALS = [
          'санал болг', 'юу авбал', 'юу авах вэ', 'юу захиалах вэ',
          'зөвлө', 'юу санал', 'аль нь дээр', 'юу вэ', 'юу болох',
          'бэлэг', // gift context — almost always exploring, not ready-to-buy
          // Discount/conditional questions — "авах юм бол хямдардаг уу?" = "if I buy together, is it cheaper?"
          // These contain "авах" but are NOT purchase intent — they're price inquiries
          'хямдардаг', 'хямдрах уу', 'хямдрах болов уу', 'хямдрал байна',
          'авах юм бол', // conditional "if I buy" — not definite purchase intent
        ]
        const isRecommendationQuery = RECOMMENDATION_SIGNALS.some(
          (sig) => normalizeText(customerMessage).includes(normalizeText(sig))
        )
        if (!unlistedProductDetected && !isRecommendationQuery && intent !== 'order_status' && intent !== 'complaint' && intent !== 'return_exchange' && hasOrderIntent(customerMessage)) {
          // Check if message has meaningful non-order words that identify a product.
          // If message is ONLY order words (e.g. "zahialu"), products from search are
          // likely coincidental matches (description contains "захиал*") — show catalog.
          const msgWords = normalizeText(customerMessage).trim().split(/\s+/)
          const nonOrderWords = msgWords.filter((w) =>
            !ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
            && !ORDER_EXACT_WORDS.some((ew) => w === normalizeText(ew))
          )
          const hasProductIdentifier = nonOrderWords.some((w) => w.length >= 2)

          if (products.length > 0 && hasProductIdentifier) {
            // Message has product-identifying words + products found — start order draft.
            // Pick the product whose name best matches the customer message (not blind products[0])
            // e.g. "Leevchik set авмаар байна" → Comfort Leevchik Set, not SKIMS Body Shaper
            const msgNorm = normalizeText(customerMessage).toLowerCase()
            const bestProduct = products.reduce((best, p) => {
              const nameWords = normalizeText(p.name).toLowerCase().split(/\s+/).filter(w => w.length >= 3)
              const score = nameWords.filter(w => msgNorm.includes(w)).length
              const bestWords = normalizeText(best.name).toLowerCase().split(/\s+/).filter(w => w.length >= 3)
              const bestScore = bestWords.filter(w => msgNorm.includes(w)).length
              return score > bestScore ? p : best
            }, products[0])
            const p = bestProduct
            const result = await startOrderDraft(supabase, { id: p.id, name: p.name, base_price: p.base_price }, customerMessage, storeId, customerId)
            orderDraft = result.draft
            responseText = result.responseText
            intent = 'order_collection'
          } else {
            // Pure order words only or no products — show catalog
            const allProducts = await searchProducts(supabase, '', storeId, {
              maxProducts: chatbotSettings.max_products || 5,
              originalQuery: '',
            })
            if (allProducts.length > 0) {
              products = allProducts
              intent = 'product_search'
              const productList = allProducts.map((p, i) =>
                `${i + 1}. **${p.name}** — ${formatPrice(p.base_price)}`
              ).join('\n')
              responseText = `Ямар бүтээгдэхүүн захиалмаар байна?\n\n${productList}\n\nБараа дугаараа бичнэ үү (1, 2, 3...):`
            } else {
              // No products at all — override any GPT-generated text with a definitive answer
              intent = 'product_search'
              responseText = 'Уучлаарай, одоогоор захиалах боломжтой бараа байхгүй байна. Удахгүй шинэ бараа нэмэх болно.'
            }
          }
        }
      }
    }
  }

  // Save AI response + update state + update conversation — all in parallel
  let storedProducts: StoredProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    base_price: p.base_price,
  }))

  // Preserve the selected product in state after number_reference/select_single/order_intent.
  // Without this, after selecting "2" from a list, last_products becomes [] and
  // subsequent messages like "тийм" lose all product context.
  if (followUp?.product && storedProducts.length === 0) {
    storedProducts = [followUp.product]
  }

  const nextState = updateState(state, intent, storedProducts, customerMessage)
  nextState.order_draft = orderDraft

  const [savedMessageResult] = await Promise.all([
    supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: responseText,
        is_from_customer: false,
        is_ai_response: true,
        metadata: {
          intent,
          products_found: products.length,
          orders_found: orders.length,
          follow_up: followUp?.type ?? null,
        },
      })
      .select('id, created_at')
      .single(),
    writeState(supabase, conversationId, nextState),
  ])

  return {
    response: responseText,
    intent,
    messageId: savedMessageResult.data?.id,
    products: products.map((p) => ({
      name: p.name,
      base_price: p.base_price,
      description: p.description ?? '',
      images: p.images ?? [],
    })),
    metadata: {
      products_found: products.length,
      orders_found: orders.length,
    },
    orderStep: orderDraft?.step ?? null,
  }
}

// ---------------------------------------------------------------------------
// Supervisor delegation
// ---------------------------------------------------------------------------

/**
 * Process a message through the SupervisorAgent pipeline.
 * Used when SUPERVISOR_MODE=on or for shadow comparison.
 */
/**
 * Dry-run supervisor: runs the agent pipeline for comparison logging only.
 * Does NOT write to the messages table or persist state — safe for shadow mode.
 */
async function processViaSupervisorDryRun(
  supabase: SupabaseClient,
  ctx: AIProcessingContext
): Promise<AIProcessingResult> {
  const { conversationId, customerMessage, storeId, storeName, customerId, chatbotSettings } = ctx

  const state = await readState(supabase, conversationId)

  const agentCtx: AgentContext = {
    supabase,
    message: customerMessage,
    normalizedMessage: normalizeText(customerMessage),
    storeId,
    storeName,
    conversationId,
    customerId,
    chatbotSettings,
    state: {
      last_intent: state.last_intent ?? null,
      last_products: state.last_products ?? [],
      last_query: state.last_query ?? null,
      turn_count: state.turn_count ?? 0,
      order_draft: state.order_draft ?? null,
      gift_card_draft: state.gift_card_draft ?? null,
    },
  }

  const supervisor = new SupervisorAgent()
  const result = await supervisor.process(agentCtx)

  // No DB writes — dry-run only returns the result for comparison
  return {
    response: result.response,
    intent: result.intent,
    messageId: undefined,
    products: result.products,
    metadata: {
      products_found: result.metadata.products_found,
      orders_found: result.metadata.orders_found,
    },
    orderStep: result.orderStep ?? null,
  }
}

async function processViaSupervisor(
  supabase: SupabaseClient,
  ctx: AIProcessingContext
): Promise<AIProcessingResult> {
  const { conversationId, customerMessage, storeId, storeName, customerId, chatbotSettings } = ctx

  // Load state (same as main pipeline)
  const state = await readState(supabase, conversationId)

  // Build agent context
  const agentCtx: AgentContext = {
    supabase,
    message: customerMessage,
    normalizedMessage: normalizeText(customerMessage),
    storeId,
    storeName,
    conversationId,
    customerId,
    chatbotSettings,
    state: {
      last_intent: state.last_intent ?? null,
      last_products: state.last_products ?? [],
      last_query: state.last_query ?? null,
      turn_count: state.turn_count ?? 0,
      order_draft: state.order_draft ?? null,
      gift_card_draft: state.gift_card_draft ?? null,
    },
  }

  // Delegate to supervisor
  const supervisor = new SupervisorAgent()
  const result = await supervisor.process(agentCtx)

  // Save state + message
  const nextState = updateState(state, result.intent, state.last_products ?? [], customerMessage)
  if (result.stateUpdates?.order_draft !== undefined) {
    nextState.order_draft = result.stateUpdates.order_draft
  }

  const [savedMsg] = await Promise.all([
    supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: result.response,
        is_from_customer: false,
        is_ai_response: true,
        metadata: {
          intent: result.intent,
          products_found: result.metadata.products_found,
          orders_found: result.metadata.orders_found,
          agent: 'supervisor',
        },
      })
      .select('id, created_at')
      .single(),
    writeState(supabase, conversationId, nextState),
  ])

  return {
    response: result.response,
    intent: result.intent,
    messageId: savedMsg.data?.id,
    products: result.products,
    metadata: {
      products_found: result.metadata.products_found,
      orders_found: result.metadata.orders_found,
    },
    orderStep: result.orderStep ?? null,
  }
}

// ---------------------------------------------------------------------------
// Order helpers
// ---------------------------------------------------------------------------

interface VariantRow {
  id: string
  size: string | null
  color: string | null
  price: number | null
  stock_quantity: number | null
}

/** Order intent — prefix stems + exact words for Mongolian verb forms */
const ORDER_WORD_STEMS = ['захиал', 'авъ', 'авь', 'авя']  // авяа/avyaa included via авя
const ORDER_EXACT_WORDS = ['авна', 'авах', 'авйа', 'ави', 'авмаар', 'авуу', 'авуй']

/**
 * Detect if the user is asking a question about a product's colors, variants,
 * availability, or specs — typically mid-order when they want more info before
 * giving their address/phone.
 */
function _isProductQuestion(msg: string): boolean {
  const n = normalizeText(msg).toLowerCase()
  const questionWords = ['ямар', 'юу', 'ямар өнгө', 'өнгө', 'хэдэн', 'яагаад', 'хэрхэн', 'байна уу', 'bn', 'bnu', 'baina uu',
    'харуул', 'үзүүл', 'харуулна уу', 'үзүүлнэ үү']  // imperative photo/info requests
  const productInfoWords = ['өнгө', 'унгу', 'хэмжээ', 'размер', 'хувилбар', 'нөөц', 'байна', 'бн', 'bn', 'ungu', 'size', 'color', 'variant', 'stock', 'ямар',
    'зураг', 'фото', 'photo', 'pic', 'зургаа', 'zurag', 'зургийг',  // photo/image
    'материал', 'чанар', 'дэлгэрэнгүй']                              // detail requests
  const hasQuestion = questionWords.some(w => n.includes(w)) || msg.includes('?')
  const hasProductTopic = productInfoWords.some(w => n.includes(w))
  return hasQuestion && hasProductTopic
}

function hasOrderIntent(msg: string): boolean {
  const words = normalizeText(msg).trim().split(/\s+/)
  // Mongolian negation suffixes: -гүй, -хгүй, -аагүй, etc. mean "did NOT"
  const NEGATION_SUFFIXES = ['гүй', 'хгүй', 'ахгүй', 'охгүй', 'ээгүй', 'оогүй', 'аагүй']
  return words.some((w) => {
    // Skip negated words: захиалаагүй = did NOT order, авахгүй = will NOT buy
    if (NEGATION_SUFFIXES.some((neg) => w.endsWith(neg))) return false
    return ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
      || ORDER_EXACT_WORDS.some((ew) => w === normalizeText(ew))
  })
}

function isAffirmative(msg: string): boolean {
  const n = normalizeText(msg).trim()
  const words = ['тийм', 'за', 'зүгээр', 'болно', 'тийм ээ', 'зөв', 'ok', 'ок', 'yes', 'tiim', 'tiim ee', 'za', 'bolno']
  // Normalize each word too — normalizeText() converts Latin→Cyrillic so
  // 'tiim' becomes 'тиим' in both the message AND the word; they must both
  // go through the same transform to be comparable.
  return words.some((w) => {
    const nw = normalizeText(w)
    return n === nw || n.startsWith(nw + ' ')
  })
}

function isNegative(msg: string): boolean {
  const n = normalizeText(msg).trim()
  const words = ['үгүй', 'болихгүй', 'цуцлах', 'цуцал', 'хүсэхгүй', 'нет', 'no', 'ugui', 'bolihgui']
  return words.some((w) => {
    const nw = normalizeText(w)
    return n === nw || n.startsWith(nw + ' ')
  })
}

function extractPhone(msg: string): string | null {
  // Match standalone 8-digit number (not adjacent to other digits).
  // Don't strip whitespace first — that merges address numbers with phone,
  // e.g. "36a 96 91250305" → "9691250305" → wrong phone "96912503".
  const standalone = msg.match(/(?<!\d)\d{8}(?!\d)/)
  if (standalone) return standalone[0]

  // Fallback: phone with spaces between groups, e.g. "9125 0305" or "91 25 03 05"
  const spaced = msg.match(/(?<!\d)(\d{2,4}[\s-]\d{2,4}[\s-]?\d{0,4})(?!\d)/)
  if (spaced) {
    const digits = spaced[1].replace(/[\s-]/g, '')
    if (digits.length === 8) return digits
  }

  return null
}

/**
 * Extract address from a message. Removes phone number if found.
 * Returns null if remaining text is too short to be an address.
 */
// Address keywords that must be present for a message to be considered an address
const ADDRESS_KEYWORDS = [
  // ── Cyrillic ────────────────────────────────────────────────────────────
  'дүүрэг', 'хороо', 'байр', 'тоот', 'гудамж', 'хороолол', 'дэнж',
  'өргөн чөлөө', 'нутгийн', 'баянгол', 'сүхбаатар', 'чингэлтэй',
  'хан-уул', 'баянзүрх', 'сонгинохайрхан', 'налайх', 'багануур',
  'багахангай', 'орон сууц', 'гэр хороолол', 'сум', 'аймаг',
  // ── Latin transliterations (very common in Messenger / web widget) ─────
  'horoo', 'khoroo', 'bair', 'toot', 'duureg', 'gudamj', 'khoroolol',
  // District abbreviations
  'bzd',  // Баянзүрх дүүрэг
  'bbd',  // Баянгол дүүрэг
  'sbd',  // Сүхбаатар дүүрэг
  'chd',  // Чингэлтэй дүүрэг
  'sgd',  // Сонгинохайрхан дүүрэг
  'hhd',  // Хан-Уул дүүрэг
  // District names in Latin
  'bayanzurkh', 'bayangol', 'sukhbaatar', 'chingeltei',
  'songino', 'khan-uul', 'han-uul', 'nalaikha',
]

function extractAddress(msg: string, phone: string | null): string | null {
  let text = msg.trim()
  // Remove phone digits from text
  if (phone) {
    text = text.replace(new RegExp(phone.split('').join('\\s*')), '').trim()
  }
  // Remove common prefixes like "утас:", "утас нь", "дугаар:"
  text = text.replace(/утас\s*(нь|:)?\s*/gi, '').replace(/дугаар\s*:?\s*/gi, '').trim()
  // Clean up punctuation at edges
  text = text.replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim()
  // Must contain at least one address keyword AND be substantial (10+ chars)
  const lower = text.toLowerCase()
  const hasAddressKeyword = ADDRESS_KEYWORDS.some(kw => lower.includes(kw))
  return (text.length >= 10 && hasAddressKeyword) ? text : null
}

/**
 * Parse multiple number selections from a message.
 * "1 болон 5" → [1, 5], "1, 5" → [1, 5], "1-3" → [1, 2, 3], "1 5" → [1, 5]
 */
function parseMultiSelect(msg: string): number[] {
  const normalized = normalizeText(msg).trim()
  // Remove common connectors
  const cleaned = normalized.replace(/болон|ба|бас|ба\s+бас|,/gi, ' ')

  const numbers: number[] = []
  // Match ranges like "1-3"
  const rangeMatch = cleaned.match(/(\d+)\s*-\s*(\d+)/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10)
    const end = parseInt(rangeMatch[2], 10)
    if (start <= end && end - start < 20) {
      for (let i = start; i <= end; i++) numbers.push(i)
      return numbers
    }
  }

  // Match individual numbers
  const numMatches = cleaned.match(/\d+/g)
  if (numMatches) {
    for (const n of numMatches) {
      const num = parseInt(n, 10)
      if (num > 0 && num <= 100 && !numbers.includes(num)) numbers.push(num)
    }
  }
  return numbers
}

/**
 * Resolve multiple variants from message — for multi-select.
 * Returns array of matched variants (may be 0, 1, or many).
 */
function resolveVariantsFromMessage(msg: string, variants: VariantRow[]): VariantRow[] {
  if (variants.length === 0) return []

  const selections = parseMultiSelect(msg)
  if (selections.length > 1) {
    // Multi-select by number
    const results: VariantRow[] = []
    for (const num of selections) {
      const idx = num - 1
      if (idx >= 0 && idx < variants.length) results.push(variants[idx])
    }
    return results
  }

  // Fallback to single-select
  const single = resolveVariantFromMessage(msg, variants)
  return single ? [single] : []
}

function resolveVariantFromMessage(msg: string, variants: VariantRow[]): VariantRow | null {
  if (variants.length === 0) return null
  const normalized = normalizeText(msg).trim()

  // Number selection: "1", "2"
  const numMatch = normalized.match(/^(\d+)/)
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1
    if (idx >= 0 && idx < variants.length) return variants[idx]
  }

  // Size/color keyword match — prefer both matching over either alone
  const words = normalized.split(/\s+/)
  // Size must match a whole word (prevents "L" matching inside "XL" / "2XL")
  const msgMatchesSize = (v: VariantRow) => !!v.size && words.includes(normalizeText(v.size))
  const msgMatchesColor = (v: VariantRow) => !!v.color && normalized.includes(normalizeText(v.color))

  // 1. Best: variant where both size AND color appear in message
  const bothMatch = variants.find(v => msgMatchesSize(v) && msgMatchesColor(v))
  if (bothMatch) return bothMatch

  // 2. Size-only match (e.g. "L авна" when no color mentioned)
  const sizeOnly = variants.find(v => msgMatchesSize(v))
  if (sizeOnly) return sizeOnly

  // 3. Color-only match
  const colorOnly = variants.find(v => msgMatchesColor(v))
  if (colorOnly) return colorOnly

  // Fuzzy color match: "цаганас" contains "цагаан" prefix
  for (const v of variants) {
    if (v.color) {
      const normColor = normalizeText(v.color)
      // Check if any word in the message starts with the color name (3+ chars)
      if (normColor.length >= 3) {
        if (words.some((w) => w.startsWith(normColor) || normColor.startsWith(w) && w.length >= 3)) {
          return v
        }
      }
    }
  }

  return null
}

/**
 * Build a summary message showing ALL order details before confirmation.
 * Supports multi-item cart.
 */
function buildOrderSummary(draft: OrderDraft): string {
  const items = getDraftItems(draft)
  const productTotal = getDraftTotal(draft)
  const feeResult = draft.address ? calculateDeliveryFee(draft.address) : null
  const isIntercity = feeResult?.type === 'intercity'
  const deliveryFee = isIntercity ? 0 : (feeResult?.fee ?? DEFAULT_DELIVERY_FEE)
  const grandTotal = productTotal + deliveryFee

  const lines = ['📋 Захиалгын мэдээлэл:\n']

  if (items.length > 1) {
    lines.push('🛒 Сагс:')
    items.forEach((item, i) => {
      const label = item.variant_label ? ` (${item.variant_label})` : ''
      lines.push(`  ${i + 1}. ${item.product_name}${label} x${item.quantity} — ${formatPrice(item.unit_price * item.quantity)}`)
    })
    lines.push(`\n💰 Бараа: ${formatPrice(productTotal)}`)
  } else if (items.length === 1) {
    const item = items[0]
    lines.push(`📦 ${item.product_name}`)
    if (item.variant_label) lines.push(`   Хувилбар: ${item.variant_label}`)
    lines.push(`   Тоо: ${item.quantity} ширхэг`)
    lines.push(`   💰 Бараа: ${formatPrice(productTotal)}`)
  }

  if (isIntercity) {
    lines.push(`🚌 Хүргэлт: Автобус / шуудан`)
    lines.push(`   ⚠️ Тээврийн үнэ хүлээн авахдаа төлнө (жин, хэмжээнээс хамаарна)`)
    lines.push(`💰 Нийт (барааны үнэ): ${formatPrice(grandTotal)}`)
  } else {
    lines.push(`🚚 Хүргэлт: ${formatPrice(deliveryFee)}`)
    lines.push(`💰 Нийт: ${formatPrice(grandTotal)}`)
  }

  if (draft.address) lines.push(`📍 Хаяг: ${draft.address}`)
  if (draft.phone) lines.push(`📱 Утас: ${draft.phone}`)
  lines.push('\nЗахиалгаа баталгаажуулах уу? (Тийм/Үгүй)')
  return lines.join('\n')
}

/**
 * Build a message asking for missing info (address and/or phone).
 */
function buildInfoRequest(draft: OrderDraft): string {
  const items = getDraftItems(draft)
  const missing: string[] = []
  if (!draft.address) missing.push('хүргэлтийн хаяг (дүүрэг, хороо, байр, тоот)')
  if (!draft.phone) missing.push('утасны дугаар (8 оронтой)')

  let header: string
  if (items.length > 1) {
    header = `🛒 ${items.length} бараа сагсанд`
  } else {
    const item = items[0]
    header = `📦 ${item?.product_name || draft.product_name}${item?.variant_label ? ` (${item.variant_label})` : ''} — ${formatPrice(item?.unit_price || draft.unit_price || 0)}`
  }
  return `${header}\n\nЗахиалга үүсгэхийн тулд дараах мэдээлэл хэрэгтэй:\n• ${missing.join('\n• ')}\n\nБичнэ үү:`
}

/**
 * Start a new order draft for a product. Fetches variants and resolves
 * any variant/address/phone info from the customer message.
 * If customer has order history, pre-fills name/address/phone and skips to confirming.
 */
async function startOrderDraft(
  supabase: SupabaseClient,
  product: StoredProduct,
  customerMessage: string,
  storeId?: string,
  customerId?: string | null,
): Promise<{ draft: OrderDraft; responseText: string }> {
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, size, color, price, stock_quantity')
    .eq('product_id', product.id)
    .gt('stock_quantity', 0)

  const inStock = variants ?? []

  let draft: OrderDraft

  if (inStock.length > 1) {
    // Try to auto-select variant(s) from message
    const preselectedMulti = resolveVariantsFromMessage(customerMessage, inStock)
    if (preselectedMulti.length > 0) {
      const items: CartItem[] = preselectedMulti.map(v => ({
        product_id: product.id,
        product_name: product.name,
        variant_id: v.id,
        variant_label: [v.size, v.color].filter(Boolean).join('/'),
        unit_price: v.price ?? product.base_price,
        quantity: 1,
      }))
      draft = {
        items,
        product_id: product.id,
        product_name: product.name,
        variant_id: items[0].variant_id,
        variant_label: items[0].variant_label,
        unit_price: items[0].unit_price,
        quantity: 1,
        step: 'name',
      }
    } else {
      draft = {
        items: [{ product_id: product.id, product_name: product.name, unit_price: product.base_price, quantity: 1 }],
        product_id: product.id,
        product_name: product.name,
        unit_price: product.base_price,
        quantity: 1,
        step: 'variant',
      }
      const variantList = inStock.map((v, i) => {
        const parts: string[] = []
        if (v.size) parts.push(v.size)
        if (v.color) parts.push(v.color)
        parts.push(formatPrice(v.price ?? product.base_price))
        return `${i + 1}. ${parts.join(' / ')}`
      }).join('\n')
      return {
        draft,
        responseText: `📦 ${product.name} захиалга\n\nАль хувилбарыг сонгох вэ?\n${variantList}\n\nОлон сонголт: "1 болон 5" гэх мэтээр бичнэ үү:`,
      }
    }
  } else {
    // 0 or 1 variant — auto-select
    const variant = inStock[0]
    const label = variant ? [variant.size, variant.color].filter(Boolean).join('/') : undefined
    const item: CartItem = {
      product_id: product.id,
      product_name: product.name,
      variant_id: variant?.id,
      variant_label: label || undefined,
      unit_price: variant?.price ?? product.base_price,
      quantity: 1,
    }
    draft = {
      items: [item],
      product_id: product.id,
      product_name: product.name,
      variant_id: variant?.id,
      variant_label: label || undefined,
      unit_price: variant?.price ?? product.base_price,
      quantity: 1,
      step: 'name',
    }
  }

  // Check customer history — if returning customer, pre-fill and skip to confirming
  if (storeId && customerId) {
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('shipping_address, notes')
      .eq('store_id', storeId)
      .eq('customer_id', customerId)
      .not('shipping_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: customer } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', customerId)
      .single()

    if (lastOrder?.shipping_address && customer?.name && customer?.phone) {
      // Returning customer — offer to use previous info
      draft.customer_name = customer.name
      draft.address = lastOrder.shipping_address
      draft.phone = customer.phone
      draft.step = 'confirming'
      const draftItems = getDraftItems(draft)
      const itemsSummary = draftItems.length > 1
        ? `🛒 ${draftItems.length} бараа — ${formatPrice(getDraftTotal(draft))}`
        : `📦 ${product.name} — ${formatPrice(draftItems[0]?.unit_price || draft.unit_price || 0)}`
      return {
        draft,
        responseText: `${itemsSummary}\n\n` +
          `Өмнөх мэдээллээр захиалах уу?\n` +
          `👤 ${customer.name}\n📍 ${lastOrder.shipping_address}\n📱 ${customer.phone}\n\n` +
          `Тийм бол "Тийм", өөрчлөх бол шинэ мэдээллээ бичнэ үү.`,
      }
    }
  }

  // New customer — start with name collection
  const startItems = getDraftItems(draft)
  const startSummary = startItems.length > 1
    ? `🛒 ${startItems.length} бараа — ${formatPrice(getDraftTotal(draft))}`
    : `📦 ${product.name} — ${formatPrice(startItems[0]?.unit_price || draft.unit_price || 0)}`
  return { draft, responseText: `${startSummary}\n\nНэрээ бичнэ үү:` }
}

async function createOrderFromChat(
  supabase: SupabaseClient,
  storeId: string,
  customerId: string | null,
  draft: OrderDraft
): Promise<{ order_number: string; total_amount: number; delivery_fee: number } | null> {
  const orderNumber = `ORD-${Date.now()}`
  const items = getDraftItems(draft)
  const productTotal = getDraftTotal(draft)

  // Calculate delivery fee from address
  const feeResult = draft.address ? calculateDeliveryFee(draft.address) : null
  const isIntercity = feeResult?.type === 'intercity'
  const deliveryFee = isIntercity ? 0 : (feeResult?.fee ?? DEFAULT_DELIVERY_FEE)
  const totalAmount = productTotal + deliveryFee

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: storeId,
      customer_id: customerId || null,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount,
      shipping_amount: deliveryFee,
      payment_status: 'pending',
      shipping_address: draft.address || null,
      order_type: 'delivery',
      notes: isIntercity
        ? `Messenger захиалга | Утас: ${draft.phone || ''} | Автобус/шуудангаар хүргэх`
        : `Messenger захиалга | Утас: ${draft.phone || ''}`,
    })
    .select('id, order_number, total_amount')
    .single()

  if (orderError || !newOrder) {
    console.error('[Order] Failed to create:', orderError)
    return null
  }

  // Create order item + delivery record in parallel
  const deliveryNumber = `DEL-${Date.now()}`

  // Use customer name from draft (collected during order flow), fallback to DB
  let customerName: string | null = draft.customer_name || null
  if (!customerName && customerId) {
    const { data: cust } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single()
    customerName = cust?.name ?? null
  }

  // Insert all cart items as order_items
  const orderItemRows = items.map(item => ({
    order_id: newOrder.id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    variant_label: item.variant_label || null,
  }))

  await Promise.all([
    supabase.from('order_items').insert(orderItemRows),
    supabase.from('deliveries').insert({
      store_id: storeId,
      order_id: newOrder.id,
      delivery_number: deliveryNumber,
      status: 'pending',
      delivery_type: isIntercity ? 'intercity_post' : 'own_driver',
      delivery_address: draft.address || 'Хаяг тодорхойгүй',
      customer_name: customerName,
      customer_phone: draft.phone || null,
      delivery_fee: deliveryFee,
    }),
  ])

  dispatchNotification(storeId, 'new_order', {
    order_id: newOrder.id,
    order_number: newOrder.order_number,
    total_amount: newOrder.total_amount,
    payment_method: null,
  })

  return { order_number: newOrder.order_number, total_amount: totalAmount, delivery_fee: deliveryFee }
}

// ---------------------------------------------------------------------------
// Gift Card Flow
// ---------------------------------------------------------------------------

interface GiftCardFlowInput {
  customerMessage: string
  storeId: string
  customerId: string | null
  state: Awaited<ReturnType<typeof readState>>
  conversationId: string
}

interface GiftCardFlowResult {
  response: string
  intent: string
  giftCardDraft: GiftCardDraft | null
  pendingGiftCardCode: string | null
}

/**
 * Handle all gift card chat flow states.
 * Returns a result if the gift card flow should intercept this message,
 * or null to let the normal pipeline handle it.
 */
async function handleGiftCardFlow(
  supabase: SupabaseClient,
  { customerMessage, storeId, customerId, state }: GiftCardFlowInput
): Promise<GiftCardFlowResult | null> {
  const normalized = normalizeText(customerMessage)

  // ── Case 1: Active gift card purchase flow ─────────────────────────────
  const draft = state.gift_card_draft
  if (draft && draft.step !== 'done') {
    return handleGiftCardPurchaseStep(supabase, {
      customerMessage,
      normalized,
      storeId,
      customerId,
      draft,
    })
  }

  // ── Case 2: Pending redemption confirmation ────────────────────────────
  const pendingCode = state.pending_gift_card_code
  if (pendingCode) {
    if (isAffirmative(customerMessage)) {
      // Customer confirmed — look up card and show info, mark as pending apply
      const card = await lookupGiftCard(supabase, { code: pendingCode, storeId })
      if (!card || card.status !== 'active') {
        return {
          response: '⚠️ Бэлгийн карт олдсонгүй эсвэл хүчингүй байна.',
          intent: 'gift_card_redeem',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
      return {
        response: `💳 **${pendingCode}**\nҮлдэгдэл: **${formatGiftCardBalance(card.current_balance)}**\n\nЭнэ захиалгаас хасах уу? Захиалгын дугаараа бичнэ үү, эсвэл "Үгүй" гэж бичнэ үү.`,
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: pendingCode,
      }
    } else if (isNegative(customerMessage)) {
      return {
        response: 'За, бэлгийн карт ашиглахгүй боллоо. Өөр тусалж чадах зүйл байна уу?',
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
    }
    // Check if they provided an order number to apply against
    const orderMatch = customerMessage.match(/ORD-\d+/i)
    if (orderMatch) {
      const orderNumber = orderMatch[0].toUpperCase()
      // Look up order
      const { data: order } = await supabase
        .from('orders')
        .select('id, total_amount, status')
        .eq('order_number', orderNumber)
        .eq('store_id', storeId)
        .single()
      if (order) {
        const card = await lookupGiftCard(supabase, { code: pendingCode, storeId })
        if (card && card.status === 'active' && card.current_balance > 0) {
          const applyAmount = Math.min(card.current_balance, order.total_amount)
          const result = await redeemGiftCard(supabase, {
            code: pendingCode,
            storeId,
            amount: applyAmount,
            orderId: order.id,
            customerId,
          })
          if (result.success) {
            return {
              response: `✅ **${formatGiftCardBalance(applyAmount)}** захиалгаас хасагдлаа!\n\nБэлгийн картын үлдэгдэл: ${formatGiftCardBalance(result.remaining)}\n\nБаярлалаа!`,
              intent: 'gift_card_redeem',
              giftCardDraft: null,
              pendingGiftCardCode: null,
            }
          }
        }
        return {
          response: `⚠️ Бэлгийн карт ашиглахад алдаа гарлаа. Менежертэй холбогдоно уу.`,
          intent: 'gift_card_redeem',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
    }
    // Still waiting — don't intercept, let normal flow handle
    return null
  }

  // ── Case 3: Message contains a GIFT-XXXX-XXXX code ────────────────────
  const codeInMessage = extractGiftCardCode(customerMessage)
  if (codeInMessage) {
    const card = await lookupGiftCard(supabase, { code: codeInMessage, storeId })
    if (!card) {
      return {
        response: `⚠️ **${codeInMessage}** код олдсонгүй. Кодоо дахин шалгана уу.`,
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
    }
    if (card.status !== 'active') {
      const msg = card.status === 'redeemed'
        ? `💳 **${codeInMessage}** — дууссан (үлдэгдэл 0₮).`
        : `💳 **${codeInMessage}** — хүчингүй карт.`
      return {
        response: msg,
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
    }
    return {
      response: `💳 Бэлгийн карт олдлоо!\n\n**Код:** ${codeInMessage}\n**Үлдэгдэл:** ${formatGiftCardBalance(card.current_balance)}\n\nЭнэ захиалгаас хасах уу? (Тийм / Үгүй)`,
      intent: 'gift_card_redeem',
      giftCardDraft: null,
      pendingGiftCardCode: codeInMessage,
    }
  }

  // ── Case 4: Gift card purchase intent ─────────────────────────────────
  if (hybridClassify(customerMessage).intent === 'gift_card_purchase') {
    const denomList = GIFT_CARD_DENOMINATIONS
      .map((d) => `💳 ${formatGiftCardBalance(d)}`)
      .join('\n')
    return {
      response: `🎁 Бэлгийн карт авмаар байна уу?\n\nДараах дүнгүүдээс сонгоно уу:\n\n${denomList}\n\nДүнгээ бичнэ үү:`,
      intent: 'gift_card_purchase',
      giftCardDraft: { step: 'select_amount' },
      pendingGiftCardCode: null,
    }
  }

  // Not a gift card message
  return null
}

/**
 * Handle individual steps of the gift card purchase flow.
 */
async function handleGiftCardPurchaseStep(
  supabase: SupabaseClient,
  {
    customerMessage,
    storeId,
    customerId,
    draft,
  }: {
    customerMessage: string
    normalized: string
    storeId: string
    customerId: string | null
    draft: GiftCardDraft
  }
): Promise<GiftCardFlowResult> {
  switch (draft.step) {
    case 'select_amount': {
      const amount = parseGiftCardAmount(customerMessage)
      if (!amount) {
        const denomList = GIFT_CARD_DENOMINATIONS
          .map((d) => `💳 ${formatGiftCardBalance(d)}`)
          .join('\n')
        return {
          response: `Уучлаарай, дүнг танихгүй байна. Дараахаас сонгоно уу:\n\n${denomList}`,
          intent: 'gift_card_purchase',
          giftCardDraft: draft,
          pendingGiftCardCode: null,
        }
      }

      // ── Real QPay invoice ─────────────────────────────────────────────
      if (isQPayConfigured()) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.mn'
          const gcOrderNumber = `GC-${Date.now()}`
          const invoice = await createQPayInvoice({
            orderNumber: gcOrderNumber,
            amount,
            description: `Бэлгийн карт - ${formatGiftCardBalance(amount)}`,
            callbackUrl: `${baseUrl}/api/payments/callback?type=gift_card`,
          })
          return {
            response:
              `💳 **${formatGiftCardBalance(amount)}** бэлгийн карт\n\n` +
              `📱 **QPay-аар төлнө үү:**\n🔗 ${invoice.qPay_shortUrl}\n\n` +
              `Төлсний дараа "Төлсөн" гэж бичнэ үү.`,
            intent: 'gift_card_purchase',
            giftCardDraft: {
              ...draft,
              step: 'confirm',
              amount,
              invoiceId: invoice.invoice_id,
              shortUrl: invoice.qPay_shortUrl,
            },
            pendingGiftCardCode: null,
          }
        } catch (qpayErr) {
          console.error('[GiftCard] QPay invoice creation failed:', qpayErr)
          // Fall through to mock/manual mode below
        }
      }

      // ── Fallback: QPay not configured or invoice creation failed ─────
      return {
        response:
          `💳 **${formatGiftCardBalance(amount)}** бэлгийн карт\n\n` +
          `💳 Төлбөр хийхийн тулд дэлгүүртэй шууд холбогдоно уу.\n\n` +
          `Баталгаажуулах уу? (Тийм / Үгүй)`,
        intent: 'gift_card_purchase',
        giftCardDraft: { ...draft, step: 'confirm', amount },
        pendingGiftCardCode: null,
      }
    }

    case 'confirm': {
      if (isNegative(customerMessage)) {
        return {
          response: '❌ Бэлгийн карт авахаас татгалзлаа. Өөр тусалж чадах зүйл байна уу?',
          intent: 'gift_card_purchase',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
      if (!isAffirmative(customerMessage)) {
        // If QPay invoice exists, remind to pay
        const payReminder = draft.shortUrl
          ? `\n\n💳 Төлөх линк: ${draft.shortUrl}`
          : ''
        return {
          response: `Бэлгийн картыг баталгаажуулах уу? (Тийм / Үгүй)${payReminder}`,
          intent: 'gift_card_purchase',
          giftCardDraft: draft,
          pendingGiftCardCode: null,
        }
      }

      // ── QPay payment verification ─────────────────────────────────────
      if (draft.invoiceId) {
        try {
          const checkResult = await checkQPayPayment(draft.invoiceId)
          const isPaid =
            checkResult.count > 0 &&
            checkResult.paid_amount >= (draft.amount ?? 0)

          if (!isPaid) {
            return {
              response:
                `⏳ QPay-д төлбөр баталгаажаагүй байна.\n\n` +
                `🔗 ${draft.shortUrl}\n\n` +
                `Төлсний дараа "Төлсөн" гэж дахин бичнэ үү.`,
              intent: 'gift_card_purchase',
              giftCardDraft: draft,
              pendingGiftCardCode: null,
            }
          }
          // Payment confirmed — fall through to create gift card
        } catch (qpayErr) {
          console.error('[GiftCard] QPay payment check failed:', qpayErr)
          // Graceful degradation: if check fails, proceed to create card
          // (avoids blocking customer due to QPay API outage)
        }
      }

      // ── Create the gift card ──────────────────────────────────────────
      try {
        const { code } = await purchaseGiftCard(supabase, {
          storeId,
          customerId,
          amount: draft.amount!,
          purchasedVia: 'chat',
        })
        return {
          response: `✅ Бэлгийн карт үүслээ!\n\n🎁 **Код:** \`${code}\`\n💰 **Дүн:** ${formatGiftCardBalance(draft.amount!)}\n📅 **Хүчинтэй:** 1 жил\n\nХэнд нэгэнд илгээх үү? Утасны дугаар эсвэл нэр бичнэ үү.\n_(Илгээхгүй бол "Үгүй" гэж бичнэ үү)_`,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'send_to', code },
          pendingGiftCardCode: null,
        }
      } catch (err) {
        console.error('[GiftCard] Purchase failed:', err)
        return {
          response: '⚠️ Бэлгийн карт үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.',
          intent: 'gift_card_purchase',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
    }

    case 'send_to': {
      if (isNegative(customerMessage)) {
        return {
          response: `✅ Бэлгийн карт таны гарт байна!\n\n🎁 **Код:** \`${draft.code}\`\n\nДараа хэрэглэх үед кодоо бичвэл хэрэглэж болно. Баярлалаа!`,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'done' },
          pendingGiftCardCode: null,
        }
      }

      // Extract phone number or name from message
      const phone = customerMessage.match(/\d{8,}/)?.[0]
      const recipientContact = phone ?? customerMessage.trim()

      // Transfer the card
      try {
        await transferGiftCard(supabase, {
          code: draft.code!,
          storeId,
          fromCustomerId: customerId,
          recipientContact,
        })
        return {
          response: `✅ Бэлгийн карт **${recipientContact}**-д илгээлээ!\n\n🎁 **Код:** \`${draft.code}\`\n\nТэд кодыг ашиглан дэлгүүрт захиалга хийж болно. Баярлалаа!`,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'done', recipientContact },
          pendingGiftCardCode: null,
        }
      } catch (err) {
        console.error('[GiftCard] Transfer failed:', err)
        return {
          response: `⚠️ Дамжуулахад алдаа гарлаа. Бэлгийн карт таны гарт байна: \`${draft.code}\``,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'done' },
          pendingGiftCardCode: null,
        }
      }
    }

    default:
      return {
        response: 'Бэлгийн картын алхам алдаатай. Дахин оролдоно уу.',
        intent: 'gift_card_purchase',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
  }
}
