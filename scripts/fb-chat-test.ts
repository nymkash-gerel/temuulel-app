#!/usr/bin/env npx tsx
/**
 * FB Chat Test - Tests the Temuulel AI chatbot with real customer messages
 * Analyzes responses for correctness, tone, and completeness
 */

import { randomUUID } from "crypto";

const ENDPOINT = "https://temuulel-app.vercel.app/api/chat/widget";
const STORE_ID = "236636f3-0a44-4f04-aba1-312e00d03166";

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
}

const testMessages: TestMessage[] = [
  // Browse/product discovery
  { msg: "Загварууд", tag: "BROWSE", expectedIntent: "product_search", notes: "show styles" },
  { msg: "Bara uzi", tag: "BROWSE", expectedIntent: "product_search", notes: "Latin: show products" },
  { msg: "бараа харуулна уу", tag: "BROWSE", expectedIntent: "product_search", notes: "show me products" },
  { msg: "Ямар бараа байна", tag: "BROWSE", expectedIntent: "product_search", notes: "what products do you have" },
  { msg: "юу байна", tag: "BROWSE", expectedIntent: "product_search", notes: "what do you have" },
  { msg: "Кашемир цамц байна уу", tag: "BROWSE", expectedIntent: "product_search", notes: "do you have cashmere shirt" },
  { msg: "цүнх байна уу", tag: "BROWSE", expectedIntent: "product_search", notes: "do you have bags" },
  { msg: "Ухаалаг цаг", tag: "BROWSE", expectedIntent: "product_search", notes: "smart watch" },
  { msg: "Bluetooth чихэвч", tag: "BROWSE", expectedIntent: "product_search", notes: "bluetooth earphones" },
  // Size queries
  { msg: "62 кг жинтэй хүнд таарах сайз", tag: "SIZE", expectedIntent: "size_inquiry", notes: "size for 62kg person" },
  { msg: "Yamar sz we", tag: "SIZE", expectedIntent: "size_inquiry", notes: "what size?" },
  { msg: "XS bgaa yuu", tag: "SIZE", expectedIntent: "size_inquiry", notes: "do you have XS?" },
  // Delivery/shipping
  { msg: "Хүргэлт үнэ хэд вэ", tag: "DELIVERY", expectedIntent: "delivery_inquiry", notes: "delivery cost" },
  { msg: "нөөдөр хүргэж өгч болох уу", tag: "DELIVERY", expectedIntent: "delivery_inquiry", notes: "can you deliver today" },
  { msg: "Хөдөө орон нутагруу явуулхуу", tag: "DELIVERY", expectedIntent: "delivery_inquiry", notes: "can you ship to countryside" },
  // Complaints
  { msg: "Zahialga ireegui", tag: "COMPLAINT", expectedIntent: "complaint", notes: "Latin: order didn't arrive" },
  { msg: "Хүргэлтийн жолооч холбоо барьсангүй ээ", tag: "COMPLAINT", expectedIntent: "complaint", notes: "delivery driver not reachable" },
  { msg: "Yupkni sz XL zahisan L sz irsen bn", tag: "COMPLAINT", expectedIntent: "complaint", notes: "ordered XL got L" },
  { msg: "Гэтэл ийм өнгө ирсэн", tag: "COMPLAINT", expectedIntent: "complaint", notes: "wrong color arrived" },
  // Payment
  { msg: "Хэрхэн төлөх вэ", tag: "PAYMENT", expectedIntent: "payment_inquiry", notes: "how to pay" },
  { msg: "qpay-р төлж болох уу", tag: "PAYMENT", expectedIntent: "payment_inquiry", notes: "can I pay with qpay" },
  // Greeting
  { msg: "Сайн байна уу", tag: "GREETING", expectedIntent: "greeting", notes: "hello" },
  { msg: "Сайн уу", tag: "GREETING", expectedIntent: "greeting", notes: "hi" },
  // Order flow (2 messages, same conversation)
  { msg: "Кашемир цамц авмаар байна", tag: "ORDER", expectedIntent: "order", notes: "I want to buy cashmere shirt" },
];

// Order follow-up message (same conversation as #24)
const orderFollowUp: TestMessage = {
  msg: "M size",
  tag: "ORDER_FOLLOWUP",
  expectedIntent: "order",
  notes: "follow up with size M",
};

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
      data.message ||
      data.response ||
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

  // Product browse
  if (tag === "BROWSE") {
    // Check if products were shown
    const hasProductName =
      reply.includes("₮") ||
      reply.includes("төгрөг") ||
      replyLower.includes("бараа") ||
      reply.match(/\d{4,}/) !== null; // price-like numbers

    const hasNootsOrStock =
      reply.includes("нөөц") ||
      reply.includes("stock") ||
      reply.includes("ширхэг") ||
      reply.includes("үлдэгдэл");

    if (!hasProductName) {
      issues.push("No products shown in browse response");
    }

    if (!hasNootsOrStock) {
      issues.push("Missing нөөц (stock quantity) info");
    }

    // Check for "no products" false negative
    if (
      reply.includes("байхгүй") ||
      reply.includes("олдсонгүй") ||
      reply.includes("no products") ||
      reply.includes("No products")
    ) {
      issues.push("Possible false 'no products found' response");
    }
  }

  // Size queries
  if (tag === "SIZE") {
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

  // Delivery
  if (tag === "DELIVERY") {
    const hasDeliveryInfo =
      reply.includes("₮") ||
      reply.includes("төгрөг") ||
      reply.includes("хүргэлт") ||
      reply.includes("delivery") ||
      replyLower.includes("төлбөр") ||
      reply.includes("үнэ");

    if (!hasDeliveryInfo) {
      issues.push("No delivery info/pricing provided");
    }
  }

  // Complaints
  if (tag === "COMPLAINT") {
    const hasEmpathy =
      reply.includes("уучлаарай") ||
      reply.includes("уучлал") ||
      reply.includes("харамсалтай") ||
      reply.includes("sorry") ||
      reply.includes("таагүй") ||
      reply.includes("ойлгож байна") ||
      reply.includes("мэдэгдсэнд") ||
      reply.includes("хүлээж") ||
      reply.includes("шийдвэрлэ");

    const hasEscalation =
      reply.includes("оператор") ||
      reply.includes("ажилтан") ||
      reply.includes("холбогдох") ||
      reply.includes("дуудах") ||
      reply.includes("дамжуулах") ||
      reply.includes("утас") ||
      reply.includes("холбоо барих") ||
      reply.includes("escalat");

    if (!hasEmpathy) {
      issues.push("Missing empathy in complaint response");
    }

    if (!hasEscalation) {
      issues.push("Missing escalation/contact info for complaint");
    }
  }

  // Payment
  if (tag === "PAYMENT") {
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
  if (tag === "GREETING") {
    const hasGreeting =
      reply.includes("сайн") ||
      reply.includes("Сайн") ||
      reply.includes("тавтай морил") ||
      reply.includes("танилцъя") ||
      reply.includes("мэндчилгээ") ||
      reply.includes("hello") ||
      reply.includes("Hello") ||
      replyLower.includes("welcome");

    if (!hasGreeting) {
      issues.push("Missing greeting/welcome in response");
    }
  }

  return issues;
}

async function main() {
  const results: TestResult[] = [];
  const allIssues: {
    msg: string;
    tag: string;
    issues: string[];
    reply: string;
  }[] = [];

  console.log("🚀 Starting FB Chat Test...\n");
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Store ID: ${STORE_ID}`);
  console.log(`Total messages: ${testMessages.length + 1}\n`);
  console.log("=".repeat(80));

  // Track the order conversation ID for follow-up
  let orderConversationId = "";

  for (let i = 0; i < testMessages.length; i++) {
    const testMsg = testMessages[i];
    const conversationId = randomUUID();

    // For the ORDER message, save the conversation ID
    if (testMsg.tag === "ORDER") {
      orderConversationId = conversationId;
    }

    const { reply, status, durationMs, error } = await sendMessage(
      conversationId,
      testMsg.msg
    );

    const issues = error
      ? ["REQUEST FAILED: " + error]
      : analyzeIssues(testMsg.msg, testMsg.tag, reply, testMsg.notes);

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
    };

    results.push(result);

    if (issues.length > 0) {
      allIssues.push({ msg: testMsg.msg, tag: testMsg.tag, issues, reply: reply.substring(0, 200) });
    }

    // Print result
    console.log(`\nMSG ${i + 1}: "${testMsg.msg}"  [${testMsg.tag}]`);
    if (testMsg.notes) console.log(`  // ${testMsg.notes}`);
    console.log(`  INTENT: ${testMsg.expectedIntent || "unknown"}`);
    console.log(`  STATUS: ${status} | ${durationMs}ms`);
    console.log(`  REPLY: ${reply.substring(0, 150)}${reply.length > 150 ? "..." : ""}`);
    if (issues.length > 0) {
      console.log(`  ISSUES:`);
      issues.forEach((issue) => console.log(`    ⚠️  ${issue}`));
    } else {
      console.log(`  ISSUES: ✅ None`);
    }
    console.log("-".repeat(80));

    // Rate limit
    await sleep(1000);
  }

  // Send order follow-up
  console.log(`\nMSG ${testMessages.length + 1}: "${orderFollowUp.msg}"  [${orderFollowUp.tag}]`);
  console.log(`  // Follow-up on cashmere shirt order (same conversation)`);
  const { reply: followUpReply, status: followUpStatus, durationMs: followUpDuration, error: followUpError } = await sendMessage(
    orderConversationId,
    orderFollowUp.msg
  );
  const followUpIssues = followUpError
    ? ["REQUEST FAILED: " + followUpError]
    : analyzeIssues(orderFollowUp.msg, "ORDER", followUpReply);
  
  console.log(`  STATUS: ${followUpStatus} | ${followUpDuration}ms`);
  console.log(`  REPLY: ${followUpReply.substring(0, 150)}${followUpReply.length > 150 ? "..." : ""}`);
  if (followUpIssues.length > 0) {
    console.log(`  ISSUES:`);
    followUpIssues.forEach((issue) => console.log(`    ⚠️  ${issue}`));
    allIssues.push({ msg: orderFollowUp.msg, tag: "ORDER_FOLLOWUP", issues: followUpIssues, reply: followUpReply.substring(0, 200) });
  } else {
    console.log(`  ISSUES: ✅ None`);
  }
  console.log("-".repeat(80));

  results.push({
    msg: orderFollowUp.msg,
    tag: "ORDER_FOLLOWUP",
    expectedIntent: "order",
    reply: followUpReply.substring(0, 300),
    rawReply: followUpReply,
    status: followUpStatus,
    error: followUpError,
    conversationId: orderConversationId,
    durationMs: followUpDuration,
  });

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 ISSUE SUMMARY BY TYPE\n");

  const issuesByType: Record<string, { msg: string; tag: string; detail: string }[]> = {
    "Wrong intent": [],
    "Missing stock info (нөөц)": [],
    "Wrong/missing products": [],
    "Poor complaint handling": [],
    "Missing empathy": [],
    "Missing escalation": [],
    "No delivery info": [],
    "No size info": [],
    "No payment info": [],
    "Other": [],
  };

  for (const item of allIssues) {
    for (const issue of item.issues) {
      if (issue.includes("нөөц") || issue.includes("stock")) {
        issuesByType["Missing stock info (нөөц)"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("product") || issue.includes("products")) {
        issuesByType["Wrong/missing products"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("empathy")) {
        issuesByType["Missing empathy"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("escalation") || issue.includes("contact")) {
        issuesByType["Missing escalation"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("delivery")) {
        issuesByType["No delivery info"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("size") || issue.includes("Size")) {
        issuesByType["No size info"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("payment") || issue.includes("Payment")) {
        issuesByType["No payment info"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("intent")) {
        issuesByType["Wrong intent"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else if (issue.includes("complaint")) {
        issuesByType["Poor complaint handling"].push({ msg: item.msg, tag: item.tag, detail: issue });
      } else {
        issuesByType["Other"].push({ msg: item.msg, tag: item.tag, detail: issue });
      }
    }
  }

  for (const [type, items] of Object.entries(issuesByType)) {
    if (items.length > 0) {
      console.log(`\n### ${type} (${items.length})`);
      for (const item of items) {
        console.log(`  [${item.tag}] "${item.msg.substring(0, 40)}..." → ${item.detail}`);
      }
    }
  }

  // Return full data for markdown report
  return { results, allIssues, issuesByType };
}

main().then(({ results, allIssues, issuesByType }) => {
  console.log("\n✅ Test complete. Writing results to file...");
  
  // Write JSON for further processing
  const fs = require("fs");
  fs.writeFileSync(
    "/Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app/scripts/fb-chat-test-raw.json",
    JSON.stringify({ results, allIssues, issuesByType }, null, 2)
  );
  console.log("Raw JSON saved.");
}).catch(console.error);
