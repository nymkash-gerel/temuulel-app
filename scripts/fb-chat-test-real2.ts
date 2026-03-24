#!/usr/bin/env npx tsx
/**
 * FB Chat Test Real2 - Tests the Temuulel AI chatbot with real customer messages
 * and validates human-quality response assertions per category.
 *
 * Two layers of checking:
 *   1. Functional pass/fail (intent correctness, non-empty reply)
 *   2. Quality warnings (does the response feel human? specific? empathetic?)
 *
 * Usage:  npx tsx scripts/fb-chat-test-real2.ts
 */

import { randomUUID } from "crypto";

const ENDPOINT = "https://temuulel-app.vercel.app/api/chat/widget";
const STORE_ID = "236636f3-0a44-4f04-aba1-312e00d03166";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  base_price: number;
  variants?: { size?: string; color?: string; price?: number; stock_quantity?: number }[];
}

interface TestMessage {
  msg: string;
  tag: string;
  expectedIntent?: string;
  notes?: string;
}

interface TestResult {
  msg: string;
  tag: string;
  expectedIntent?: string;
  reply: string;
  rawReply: string;
  status: number;
  error?: string;
  conversationId: string;
  durationMs: number;
  qualityIssues: string[];
}

// ─── Test Messages ────────────────────────────────────────────────────────────

const testMessages: TestMessage[] = [
  // ── Greeting ──────────────────────────────────────────────────────────────
  { msg: "Сайн байна уу", tag: "greeting", expectedIntent: "greeting", notes: "hello" },
  { msg: "Сайн уу", tag: "greeting", expectedIntent: "greeting", notes: "hi" },
  { msg: "sn bnuu", tag: "greeting", expectedIntent: "greeting", notes: "latin hi" },

  // ── Product Search ────────────────────────────────────────────────────────
  { msg: "Загварууд", tag: "product-search", expectedIntent: "product_search", notes: "show styles" },
  { msg: "Bara uzi", tag: "product-search", expectedIntent: "product_search", notes: "Latin: show products" },
  { msg: "бараа харуулна уу", tag: "product-search", expectedIntent: "product_search", notes: "show me products" },
  { msg: "Ямар бараа байна", tag: "product-search", expectedIntent: "product_search", notes: "what products do you have" },
  { msg: "юу байна", tag: "product-search", expectedIntent: "product_search", notes: "what do you have" },
  { msg: "Кашемир цамц байна уу", tag: "product-search", expectedIntent: "product_search", notes: "do you have cashmere shirt" },
  { msg: "цүнх байна уу", tag: "product-search", expectedIntent: "product_search", notes: "do you have bags" },
  { msg: "Ухаалаг цаг", tag: "product-search", expectedIntent: "product_search", notes: "smart watch" },
  { msg: "Bluetooth чихэвч", tag: "product-search", expectedIntent: "product_search", notes: "bluetooth earphones" },

  // ── Size Questions ────────────────────────────────────────────────────────
  { msg: "62 кг жинтэй хүнд таарах сайз", tag: "size-question", expectedIntent: "size_inquiry", notes: "size for 62kg person" },
  { msg: "Yamar sz we", tag: "size-question", expectedIntent: "size_inquiry", notes: "what size?" },
  { msg: "XS bgaa yuu", tag: "size-question", expectedIntent: "size_inquiry", notes: "do you have XS?" },
  { msg: "170 см 55 кг хүнд ямар размер тохирох вэ", tag: "size-question", expectedIntent: "size_inquiry", notes: "size for 170cm 55kg" },

  // ── Color Questions ───────────────────────────────────────────────────────
  { msg: "Ямар өнгө байна", tag: "color-question", expectedIntent: "product_search", notes: "what colors available" },
  { msg: "хар өнгө байна уу", tag: "color-question", expectedIntent: "product_search", notes: "do you have black" },
  { msg: "Цагаан өнгөтэй юу", tag: "color-question", expectedIntent: "product_search", notes: "is there white" },

  // ── Shipping / Delivery ───────────────────────────────────────────────────
  { msg: "Хүргэлт үнэ хэд вэ", tag: "shipping", expectedIntent: "delivery_inquiry", notes: "delivery cost" },
  { msg: "нөөдөр хүргэж өгч болох уу", tag: "shipping", expectedIntent: "delivery_inquiry", notes: "can you deliver today" },
  { msg: "Хөдөө орон нутагруу явуулхуу", tag: "shipping", expectedIntent: "delivery_inquiry", notes: "can you ship to countryside" },
  { msg: "Хэдэн цагийн дотор хүргэх вэ", tag: "shipping", expectedIntent: "delivery_inquiry", notes: "how many hours to deliver" },

  // ── Price / Discount ──────────────────────────────────────────────────────
  { msg: "Une", tag: "price", expectedIntent: "product_search", notes: "price?" },
  { msg: "Umd in hed ve", tag: "price", expectedIntent: "product_search", notes: "how much are pants" },
  { msg: "Хямдрал байна уу", tag: "discount", expectedIntent: "product_search", notes: "any discounts" },
  { msg: "1иг авбал 1 үнэгүй юу", tag: "discount", expectedIntent: "product_search", notes: "buy 1 get 1 free?" },

  // ── Complaints ────────────────────────────────────────────────────────────
  { msg: "Zahialga ireegui", tag: "complaint", expectedIntent: "complaint", notes: "Latin: order didn't arrive" },
  { msg: "Хүргэлтийн жолооч холбоо барьсангүй ээ", tag: "complaint-delivery", expectedIntent: "complaint", notes: "delivery driver not reachable" },
  { msg: "Yupkni sz XL zahisan L sz irsen bn", tag: "complaint-wrong-size", expectedIntent: "complaint", notes: "ordered XL got L" },
  { msg: "Гэтэл ийм өнгө ирсэн", tag: "complaint-wrong-color", expectedIntent: "complaint", notes: "wrong color arrived" },
  { msg: "Муу чанартай бараа байна", tag: "complaint-quality", expectedIntent: "complaint", notes: "poor quality product" },

  // ── Order Intent ──────────────────────────────────────────────────────────
  { msg: "Кашемир цамц авмаар байна", tag: "order-intent", expectedIntent: "order", notes: "I want to buy cashmere shirt" },
  { msg: "Захиалъя", tag: "order-intent", expectedIntent: "order", notes: "I want to order" },
  { msg: "Awi", tag: "order-intent", expectedIntent: "order", notes: "Latin: I'll buy" },

  // ── Address ───────────────────────────────────────────────────────────────
  { msg: "Bzd 8r xoroo shine amgalan xotxon 519 bair", tag: "address", expectedIntent: "shipping", notes: "customer address in Latin" },
  { msg: "Баянзүрх дүүрэг 10-р хороо 45 байр 12 тоот", tag: "address", expectedIntent: "shipping", notes: "customer address in Cyrillic" },

  // ── Pickup ────────────────────────────────────────────────────────────────
  { msg: "Очиж авч болох уу", tag: "pickup", expectedIntent: "delivery_inquiry", notes: "can I pick up" },
  { msg: "Дэлгүүрийн хаяг хаана байдаг вэ", tag: "pickup", expectedIntent: "delivery_inquiry", notes: "where is the store" },

  // ── Payment ───────────────────────────────────────────────────────────────
  { msg: "Хэрхэн төлөх вэ", tag: "payment", expectedIntent: "payment_inquiry", notes: "how to pay" },
  { msg: "qpay-р төлж болох уу", tag: "payment", expectedIntent: "payment_inquiry", notes: "can I pay with qpay" },

  // ── Confirm (order confirmation step) ─────────────────────────────────────
  { msg: "Тийм, захиалъя", tag: "confirm-order", expectedIntent: "order", notes: "yes, place order" },

  // ── Order follow-up (same conversation) ───────────────────────────────────
  { msg: "M size", tag: "order-followup", expectedIntent: "order", notes: "follow up with size M" },
];

// Order follow-up uses the same conversation as the ORDER test
const orderFollowUp: TestMessage = {
  msg: "M size",
  tag: "order-followup",
  expectedIntent: "order",
  notes: "follow up with size M (same conversation)",
};

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

async function sendMessage(
  conversationId: string,
  message: string
): Promise<{ reply: string; status: number; durationMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        customer_message: message,
        store_id: STORE_ID,
        channel: "web",
      }),
    });
    const durationMs = Date.now() - start;
    const data = await res.json();
    const reply =
      data.reply ||
      data.response ||
      data.message ||
      data.text ||
      JSON.stringify(data);
    return { reply, status: res.status, durationMs };
  } catch (err: any) {
    return {
      reply: "",
      status: 0,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Functional Analysis (pass/fail) ──────────────────────────────────────────

function analyzeIssues(
  msg: string,
  tag: string,
  reply: string,
  notes?: string
): string[] {
  const issues: string[] = [];
  const replyLower = reply.toLowerCase();

  if (!reply || reply.trim() === "") {
    issues.push("EMPTY REPLY");
    return issues;
  }

  // Check for error responses
  if (
    reply.includes("error") ||
    reply.includes("Error") ||
    reply.includes("алдаа")
  ) {
    issues.push("Possible error in reply");
  }

  // Product browse / search
  if (tag.startsWith("product")) {
    const hasProductName =
      reply.includes("₮") ||
      reply.includes("төгрөг") ||
      replyLower.includes("бараа") ||
      reply.match(/\d{4,}/) !== null;

    if (!hasProductName) {
      issues.push("No products shown in browse response");
    }
  }

  // Size queries
  if (tag.startsWith("size")) {
    const hasSizeInfo =
      reply.includes("XS") ||
      reply.includes("S") ||
      reply.includes("M") ||
      reply.includes("L") ||
      reply.includes("XL") ||
      reply.includes("XXL") ||
      reply.includes("сайз") ||
      reply.includes("хэмжээ") ||
      reply.includes("кг") ||
      reply.includes("см");

    if (!hasSizeInfo) {
      issues.push("No size info provided");
    }
  }

  // Delivery / shipping
  if (tag === "shipping" || tag.startsWith("delivery")) {
    const hasDeliveryInfo =
      reply.includes("₮") ||
      reply.includes("төгрөг") ||
      reply.includes("хүргэлт") ||
      reply.includes("delivery") ||
      replyLower.includes("төлбөр") ||
      reply.includes("үнэ") ||
      reply.includes("цаг");

    if (!hasDeliveryInfo) {
      issues.push("No delivery info/pricing provided");
    }
  }

  // Complaints
  if (tag.startsWith("complaint")) {
    const hasEmpathy =
      reply.includes("уучлаарай") ||
      reply.includes("уучлал") ||
      reply.includes("харамсалтай") ||
      reply.includes("харамсаж") ||
      reply.includes("sorry") ||
      reply.includes("таагүй") ||
      reply.includes("ойлгож байна") ||
      reply.includes("шийдвэрлэ");

    if (!hasEmpathy) {
      issues.push("Missing empathy in complaint response");
    }
  }

  // Payment
  if (tag === "payment") {
    const hasPaymentInfo =
      reply.includes("QPay") ||
      reply.includes("qpay") ||
      reply.includes("Qpay") ||
      reply.includes("банк") ||
      reply.includes("карт") ||
      reply.includes("бэлэн") ||
      reply.includes("төлбөр") ||
      reply.includes("payment");

    if (!hasPaymentInfo) {
      issues.push("No payment method info provided");
    }
  }

  // Greeting
  if (tag === "greeting") {
    const hasGreeting =
      reply.includes("сайн") ||
      reply.includes("Сайн") ||
      reply.includes("тавтай морил") ||
      reply.includes("Тавтай морил") ||
      reply.includes("туслах") ||
      replyLower.includes("welcome");

    if (!hasGreeting) {
      issues.push("Missing greeting/welcome in response");
    }
  }

  return issues;
}

// ─── Quality Check (warnings, not failures) ───────────────────────────────────

function checkResponseQuality(tag: string, response: string, products: Product[]): string[] {
  const issues: string[] = [];
  const responseLower = response.toLowerCase();

  // ── Greeting quality ─────────────────────────────────────────────────────
  if (tag.includes("greeting")) {
    const hasStoreName = response.includes("Монгол Маркет") || response.includes("GOOD TRADE");
    const hasHelpOffer = responseLower.includes("туслах") || responseLower.includes("юугаар");
    const hasWelcome = responseLower.includes("тавтай морил") || responseLower.includes("тавтай");

    if (!hasStoreName && !hasHelpOffer && !hasWelcome) {
      issues.push("Greeting missing store name or helpful offer (юугаар туслах / тавтай морил)");
    }

    // Check it's not JUST "Сайн байна уу" with nothing else
    const stripped = response.replace(/[!.,?]/g, "").trim();
    if (stripped === "Сайн байна уу" || stripped === "Сайн уу") {
      issues.push("Greeting is bare echo — should include store name or offer to help");
    }
  }

  // ── Product search quality ───────────────────────────────────────────────
  if (tag.includes("product") || tag.includes("search")) {
    const hasPriceWithSymbol = !!response.match(/\d[\d,]*₮/) || !!response.match(/\d[\d,]*\s*төгрөг/);
    const hasPriceShorthand = !!response.match(/\d+к/i) || !!response.match(/\d+k/i);

    if (!hasPriceWithSymbol && !hasPriceShorthand) {
      issues.push("Product response missing exact price with ₮ symbol");
    }

    // Check it's not a lazy "тиймээ, бий" with no details
    const strippedLen = response.replace(/\s+/g, " ").trim().length;
    if (strippedLen < 30 && !response.match(/\d/)) {
      issues.push("Product response too short — just confirmation with no details");
    }
  }

  // ── Size question quality ────────────────────────────────────────────────
  if (tag.includes("size")) {
    // Should NOT say "go check the size chart yourself"
    if (response.includes("хүснэгтийг харна уу") || response.includes("хүснэгтээс")) {
      issues.push("Size response says 'go check chart yourself' — should give specific recommendation");
    }

    // Should contain a recommendation word or specific size
    const hasRecommendation =
      response.includes("тохирно") ||
      response.includes("тохиромжтой") ||
      response.includes("таарна") ||
      !!response.match(/\b[SMLX]{1,3}L?\b/) ||
      !!response.match(/\d+\s*кг/);

    if (!hasRecommendation) {
      issues.push("Size response missing specific recommendation (тохирно/тохиромжтой or size letter)");
    }
  }

  // ── Color question quality ───────────────────────────────────────────────
  if (tag.includes("color")) {
    // If we have product data, check for hallucinated colors
    if (products.length > 0) {
      const knownColors: string[] = [];
      for (const p of products) {
        if (p.variants) {
          for (const v of p.variants) {
            if (v.color) knownColors.push(v.color.toLowerCase());
          }
        }
      }

      if (knownColors.length > 0) {
        // Check for common Mongolian color words that might be hallucinated
        const colorWords: Record<string, string> = {
          "улаан": "red",
          "ногоон": "green",
          "цэнхэр": "blue",
          "шар": "yellow",
          "ягаан": "pink",
          "нил ягаан": "purple",
          "хар": "black",
          "цагаан": "white",
          "бор": "brown",
          "саарал": "gray",
        };

        for (const [mnColor, _enColor] of Object.entries(colorWords)) {
          if (response.includes(mnColor) && !knownColors.some((c) => c.includes(mnColor))) {
            issues.push(`Color response may hallucinate "${mnColor}" — not found in product variants`);
          }
        }
      }
    }
  }

  // ── Order intent quality ─────────────────────────────────────────────────
  if (tag.includes("order") || tag.includes("confirm")) {
    const asksForAddress = response.includes("хаяг") || response.includes("байршил");
    const asksForPhone = response.includes("утас") || response.includes("дугаар");
    const confirmsDetails =
      response.includes("баталгаажуулах") ||
      response.includes("захиалга") ||
      response.includes("зөв үү");

    // For confirm-order, should confirm details
    if (tag.includes("confirm")) {
      if (!confirmsDetails && !response.match(/\d[\d,]*₮/)) {
        issues.push("Order confirmation missing order details or price summary");
      }
    }

    // For initial order intent, should ask for info or show order flow
    if (tag === "order-intent") {
      const isGenericQuestion = response.includes("юу авах вэ") && !response.includes("₮");
      if (isGenericQuestion) {
        issues.push("Order response asks generic 'юу авах вэ?' when customer already stated what they want");
      }
    }
  }

  // ── Complaint quality ────────────────────────────────────────────────────
  if (tag.includes("complaint")) {
    const hasEmpathy =
      response.includes("харамсаж") ||
      response.includes("уучлаарай") ||
      response.includes("шалга") ||
      response.includes("тусал") ||
      response.includes("шийдвэрлэ") ||
      response.includes("уучлал");

    if (!hasEmpathy) {
      issues.push("Complaint response missing empathy word (харамсаж/уучлаарай/шалгая/тусалъя)");
    }

    // Delivery complaints should NOT get generic "мэдээлэл олдсонгүй"
    if (tag.includes("delivery") && response.includes("мэдээлэл олдсонгүй")) {
      issues.push("Delivery complaint got generic 'мэдээлэл олдсонгүй' — should acknowledge and investigate");
    }
  }

  // ── Shipping quality ─────────────────────────────────────────────────────
  if (tag === "shipping" || tag.includes("delivery")) {
    const hasDeliveryTime =
      !!response.match(/\d+\s*цаг/) ||
      response.includes("цагийн дотор") ||
      !!response.match(/\d+\s*өдөр/) ||
      response.includes("өдрийн дотор") ||
      response.includes("24 цаг");

    const hasDeliveryFee = !!response.match(/\d[\d,]*₮/) || !!response.match(/\d[\d,]*\s*төгрөг/);

    if (!hasDeliveryTime && !hasDeliveryFee) {
      issues.push("Shipping response missing delivery fee (₮) or time estimate (цаг/өдөр)");
    }

    // Should not be just "хүргэлт хийнэ" with no specifics
    const stripped = response.replace(/[!.,?]/g, "").trim();
    if (stripped === "Хүргэлт хийнэ" || stripped === "хүргэлт хийнэ") {
      issues.push("Shipping response is bare 'хүргэлт хийнэ' with no delivery fee or time");
    }
  }

  // ── Price / discount quality ─────────────────────────────────────────────
  if (tag === "price" || tag.includes("price") || tag === "discount" || tag.includes("discount")) {
    if (!response.match(/\d/)) {
      issues.push("Price/discount response contains no numbers at all");
    }

    // Should not be just "манай бараанууд" with no actual price
    if (response.includes("манай бараа") && !response.match(/\d/)) {
      issues.push("Price response says 'манай бараанууд' but shows no actual price");
    }
  }

  // ── Pickup quality ───────────────────────────────────────────────────────
  if (tag === "pickup" || tag.includes("pickup")) {
    const hasLocation =
      response.includes("хаяг") ||
      response.includes("байршил") ||
      response.includes("дүүрэг") ||
      response.includes("хороо");

    const hasHours = !!response.match(/\d+:\d+/) || response.includes("цаг") || response.includes("нээлттэй");
    const hasPickupConfirm = response.includes("очиж авах боломжтой") || response.includes("очиж авч болно");

    if (!hasLocation && !hasHours && !hasPickupConfirm) {
      issues.push("Pickup response missing store location, hours, or 'очиж авах боломжтой'");
    }

    // Should not be just "болно" with no details
    const stripped = response.replace(/[!.,?]/g, "").trim();
    if (stripped === "Болно" || stripped === "болно") {
      issues.push("Pickup response is bare 'болно' with no location or hours");
    }
  }

  // ── Address quality ──────────────────────────────────────────────────────
  if (tag === "address") {
    const confirmsAddress =
      response.includes("хаяг") ||
      response.includes("хүргэ") ||
      response.includes("баталгаажуул") ||
      response.includes("зөв үү") ||
      response.includes("дүүрэг") ||
      response.includes("хороо");

    if (!confirmsAddress) {
      issues.push("Address response does not confirm address or show delivery info — may have ignored it");
    }
  }

  return issues;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const results: TestResult[] = [];
  const allIssues: {
    msg: string;
    tag: string;
    issues: string[];
    reply: string;
  }[] = [];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let qualityWarnings = 0;
  const qualityIssueCounts: Record<string, number> = {};

  // We don't have live product data, so pass empty array.
  // In a real setup, you'd fetch products from the store's DB.
  const products: Product[] = [];

  console.log("=".repeat(80));
  console.log("  FB CHAT TEST REAL2 — Functional + Quality Assertions");
  console.log("=".repeat(80));
  console.log(`  Endpoint: ${ENDPOINT}`);
  console.log(`  Store ID: ${STORE_ID}`);
  console.log(`  Total messages: ${testMessages.length + 1}`);
  console.log("=".repeat(80));

  // Track the order conversation ID for follow-up
  let orderConversationId = "";

  for (let i = 0; i < testMessages.length; i++) {
    const testMsg = testMessages[i];
    const conversationId = randomUUID();

    // For the order-intent message, save the conversation ID for follow-up
    if (testMsg.tag === "order-intent" && !orderConversationId) {
      orderConversationId = conversationId;
    }

    totalTests++;

    const { reply, status, durationMs, error } = await sendMessage(
      conversationId,
      testMsg.msg
    );

    // Layer 1: Functional pass/fail
    const issues = error
      ? ["REQUEST FAILED: " + error]
      : analyzeIssues(testMsg.msg, testMsg.tag, reply, testMsg.notes);

    const passed = issues.length === 0 && status === 200;
    if (passed) {
      passedTests++;
    } else {
      failedTests++;
    }

    // Layer 2: Quality warnings
    const qualityIssues = error
      ? []
      : checkResponseQuality(testMsg.tag, reply, products);

    if (qualityIssues.length > 0) {
      qualityWarnings++;
      for (const qi of qualityIssues) {
        qualityIssueCounts[qi] = (qualityIssueCounts[qi] || 0) + 1;
      }
    }

    const result: TestResult = {
      msg: testMsg.msg,
      tag: testMsg.tag,
      expectedIntent: testMsg.expectedIntent,
      reply: reply.substring(0, 300),
      rawReply: reply,
      status,
      error,
      conversationId,
      durationMs,
      qualityIssues,
    };

    results.push(result);

    if (issues.length > 0) {
      allIssues.push({
        msg: testMsg.msg,
        tag: testMsg.tag,
        issues,
        reply: reply.substring(0, 200),
      });
    }

    // Print result
    const statusIcon = passed ? "PASS" : "FAIL";
    console.log(
      `\n  ${String(i + 1).padStart(2, "0")}. [${statusIcon}] "${testMsg.msg}"  [${testMsg.tag}]`
    );
    if (testMsg.notes) console.log(`      // ${testMsg.notes}`);
    console.log(
      `      HTTP ${status} | ${durationMs}ms`
    );
    console.log(
      `      Reply: ${reply.substring(0, 150)}${reply.length > 150 ? "..." : ""}`
    );

    if (issues.length > 0) {
      for (const issue of issues) {
        console.log(`      FAIL: ${issue}`);
      }
    }

    if (qualityIssues.length > 0) {
      for (const qi of qualityIssues) {
        console.log(`      WARNING: ${qi}`);
      }
    }

    console.log("  " + "-".repeat(76));

    // Rate limit
    await sleep(1200);
  }

  // ── Order Follow-up (same conversation) ─────────────────────────────────
  totalTests++;

  console.log(
    `\n  ${String(testMessages.length + 1).padStart(2, "0")}. "${orderFollowUp.msg}"  [${orderFollowUp.tag}]`
  );
  console.log(
    `      // Follow-up on cashmere shirt order (same conversation)`
  );

  const {
    reply: followUpReply,
    status: followUpStatus,
    durationMs: followUpDuration,
    error: followUpError,
  } = await sendMessage(orderConversationId || randomUUID(), orderFollowUp.msg);

  const followUpIssues = followUpError
    ? ["REQUEST FAILED: " + followUpError]
    : analyzeIssues(orderFollowUp.msg, "order-followup", followUpReply);

  const followUpQuality = followUpError
    ? []
    : checkResponseQuality(orderFollowUp.tag, followUpReply, products);

  const followUpPassed = followUpIssues.length === 0 && followUpStatus === 200;
  if (followUpPassed) passedTests++;
  else failedTests++;

  if (followUpQuality.length > 0) {
    qualityWarnings++;
    for (const qi of followUpQuality) {
      qualityIssueCounts[qi] = (qualityIssueCounts[qi] || 0) + 1;
    }
  }

  console.log(
    `      HTTP ${followUpStatus} | ${followUpDuration}ms`
  );
  console.log(
    `      Reply: ${followUpReply.substring(0, 150)}${followUpReply.length > 150 ? "..." : ""}`
  );
  if (followUpIssues.length > 0) {
    for (const issue of followUpIssues) {
      console.log(`      FAIL: ${issue}`);
    }
    allIssues.push({
      msg: orderFollowUp.msg,
      tag: "order-followup",
      issues: followUpIssues,
      reply: followUpReply.substring(0, 200),
    });
  }
  if (followUpQuality.length > 0) {
    for (const qi of followUpQuality) {
      console.log(`      WARNING: ${qi}`);
    }
  }
  console.log("  " + "-".repeat(76));

  results.push({
    msg: orderFollowUp.msg,
    tag: "order-followup",
    expectedIntent: "order",
    reply: followUpReply.substring(0, 300),
    rawReply: followUpReply,
    status: followUpStatus,
    error: followUpError,
    conversationId: orderConversationId,
    durationMs: followUpDuration,
    qualityIssues: followUpQuality,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCTIONAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n" + "=".repeat(80));
  console.log("  FUNCTIONAL SUMMARY");
  console.log("=".repeat(80));

  console.log(`  Total tests:  ${totalTests}`);
  console.log(`  Passed:       ${passedTests}`);
  console.log(`  Failed:       ${failedTests}`);
  console.log(
    `  Pass rate:    ${((passedTests / totalTests) * 100).toFixed(1)}%`
  );

  if (allIssues.length > 0) {
    console.log(`\n  Failures by category:`);

    const failsByTag: Record<string, number> = {};
    for (const item of allIssues) {
      failsByTag[item.tag] = (failsByTag[item.tag] || 0) + 1;
    }
    const sortedFails = Object.entries(failsByTag).sort((a, b) => b[1] - a[1]);
    for (const [tag, count] of sortedFails) {
      console.log(`    ${tag}: ${count} failure(s)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUALITY SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n" + "=".repeat(80));
  console.log("  QUALITY SUMMARY");
  console.log("=".repeat(80));

  console.log(`  ${totalTests} tests ran`);
  console.log(`  ${qualityWarnings} responses have quality warnings`);
  console.log(
    `  ${totalTests - qualityWarnings} responses meet human-quality bar`
  );

  if (Object.keys(qualityIssueCounts).length > 0) {
    console.log(`\n  Top quality issues:`);

    const sortedIssues = Object.entries(qualityIssueCounts).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [issue, count] of sortedIssues) {
      console.log(`    ${count}x  ${issue}`);
    }
  } else {
    console.log(`\n  No quality warnings — all responses meet the human-quality bar.`);
  }

  console.log("\n" + "=".repeat(80));

  return { results, allIssues, qualityIssueCounts };
}

main()
  .then(({ results, allIssues, qualityIssueCounts }) => {
    console.log("\n  Test complete. Writing results to file...");

    const fs = require("fs");
    const outPath =
      "/Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app/scripts/fb-chat-test-real2-results.json";
    fs.writeFileSync(
      outPath,
      JSON.stringify({ results, allIssues, qualityIssueCounts }, null, 2)
    );
    console.log(`  Results saved to ${outPath}`);
  })
  .catch(console.error);
