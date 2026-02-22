# TEMUULEL - PATH TO WORKING STATE
## From "Built" to "Actually Working with Real Customers"

**Current State**: Foundation complete, integrations incomplete, no real customer tests  
**Goal**: End-to-end working system with Facebook integration + 3 pilot customers  
**Timeline**: 2-3 weeks

---

## 🎯 THE CRITICAL PATH (15 Steps to Working)

These are the ONLY things between you and a working system.

---

## WEEK 1: MAKE IT WORK END-TO-END

### Step 1: Facebook Integration - Setup (Day 1)
**Priority**: P0 - Nothing works without this

**What you have:**
- ✅ Database fields (`facebook_page_id`, `facebook_access_token` in stores table)
- ✅ Auth routes (`/api/auth/facebook`, `/api/auth/facebook/callback`)
- ✅ Webhook route (`/api/webhook/messenger`)
- ✅ RPC functions (save/disconnect facebook)

**What you need to do:**

#### 1a. Create Facebook App
```bash
# Go to: https://developers.facebook.com/apps/
1. Click "Create App"
2. Choose "Business" type
3. App Name: "Temuulel AI Assistant"
4. Contact Email: your@email.com
5. Click "Create App"
```

#### 1b. Configure Facebook App
```bash
# In Facebook App Dashboard:

1. Add Messenger Product:
   - Click "Add Product" 
   - Select "Messenger"
   - Click "Set Up"

2. Generate Page Access Token:
   - Go to Messenger > Settings
   - Under "Access Tokens"
   - Select a test page
   - Click "Generate Token"
   - Copy token → save for step 1c

3. Configure Webhooks:
   - Go to Messenger > Settings > Webhooks
   - Click "Add Callback URL"
   - Callback URL: https://YOUR-DOMAIN.vercel.app/api/webhook/messenger
   - Verify Token: (create random string, save it)
   - Subscribe to: messages, messaging_postbacks

4. Add Test Users:
   - Go to Roles > Testers
   - Add your personal Facebook account
   - Add 2-3 friend accounts for testing
```

#### 1c. Update Environment Variables
```bash
# In .env.local and Vercel
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_VERIFY_TOKEN=your_verify_token_here  # From step 1b.3
```

#### 1d. Deploy to Vercel
```bash
# Push to GitHub (triggers Vercel deploy)
git add .
git commit -m "Configure Facebook integration"
git push origin main

# Verify deployment
# Wait for Vercel build to complete
# Copy production URL
```

#### 1e. Verify Webhook
```bash
# In Facebook App > Messenger > Webhooks
1. Click "Verify and Save"
2. Facebook will send GET request to your webhook
3. Should see "Success" ✓

# If it fails:
# Check Vercel logs for errors
# Common issues:
# - FACEBOOK_VERIFY_TOKEN mismatch
# - Webhook route not deployed
# - HTTPS certificate issues
```

#### 1f. Test Message Receiving
```bash
# Send test message to your Facebook Page
1. Go to your test Facebook Page
2. Send message: "Hello"
3. Check Vercel logs
4. Should see webhook payload logged

# If not working:
# - Check webhook subscription status
# - Verify page token is valid
# - Check RLS policies on messages table
```

**Success Criteria:**
- [ ] Facebook app created and configured
- [ ] Webhook verified successfully
- [ ] Test message appears in Vercel logs
- [ ] Message saved to `messages` table in Supabase

**Time**: 3-4 hours

---

### Step 2: Facebook Connection Flow (Day 1-2)
**Priority**: P0

**Test the store connection flow:**

#### 2a. Connect Store to Facebook Page
```bash
# In your dashboard:
1. Go to /dashboard/settings/integrations
2. Click "Connect Facebook"
3. OAuth flow redirects to Facebook
4. Select page to connect
5. Grant permissions
6. Redirect back to dashboard
7. Verify store record updated:
   - facebook_page_id populated
   - facebook_access_token encrypted and saved
   - facebook_connected_at timestamp set
```

#### 2b. Verify Connection
```sql
-- Check in Supabase SQL editor:
SELECT 
  id,
  name,
  facebook_page_id,
  facebook_connected_at,
  LENGTH(facebook_access_token) as token_length  -- Should be > 0
FROM stores
WHERE owner_id = 'your-user-id';
```

#### 2c. Test Disconnect
```bash
# In dashboard:
1. Click "Disconnect Facebook"
2. Verify confirmation dialog
3. Confirm disconnect
4. Check database:
   - facebook_page_id = NULL
   - facebook_access_token = NULL
   - facebook_connected_at = NULL
```

**Success Criteria:**
- [ ] OAuth flow works (no errors)
- [ ] Page selection works
- [ ] Database updates correctly
- [ ] Disconnect works
- [ ] Can reconnect after disconnect

**Time**: 2-3 hours

---

### Step 3: Message Receiving + Storage (Day 2)
**Priority**: P0

**Make sure incoming messages are saved correctly:**

#### 3a. Send Test Messages
```bash
# From your Facebook account to test page:
Message 1: "Hello"
Message 2: "Do you have products?"
Message 3: "What's the price?"
```

#### 3b. Verify Database Records
```sql
-- Check messages were saved:
SELECT 
  m.id,
  m.content,
  m.sender_type,
  m.created_at,
  c.platform,
  c.status
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.platform = 'messenger'
ORDER BY m.created_at DESC
LIMIT 10;
```

#### 3c. Check Conversation Creation
```sql
-- Verify conversation auto-created:
SELECT 
  id,
  platform,
  channel,
  status,
  customer_id,
  created_at
FROM conversations
WHERE platform = 'messenger'
ORDER BY created_at DESC;
```

#### 3d. Check Customer Record
```sql
-- Verify customer auto-created:
SELECT 
  id,
  name,
  platform,
  messenger_id,
  created_at
FROM customers
WHERE platform = 'messenger'
ORDER BY created_at DESC;
```

**Success Criteria:**
- [ ] All 3 test messages appear in `messages` table
- [ ] Conversation auto-created
- [ ] Customer record auto-created with messenger_id
- [ ] No duplicate conversations for same customer

**Time**: 1-2 hours

---

### Step 4: AI Response Generation (Day 2-3)
**Priority**: P0

**Connect AI to respond to messages:**

#### 4a. Configure OpenAI
```bash
# Verify in .env.local and Vercel:
OPENAI_API_KEY=sk-...your-key

# Test OpenAI connection:
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

#### 4b. Test AI Chat Endpoint
```bash
# Test via API route:
curl -X POST https://your-domain.vercel.app/api/chat/ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_STORE_TOKEN" \
  -d '{
    "message": "Do you have products?",
    "conversationId": "conversation-id-from-step-3"
  }'

# Expected response:
{
  "success": true,
  "message": "...",
  "intent": "product_search",
  "confidence": 0.95
}
```

#### 4c. Add Products to Test Store
```bash
# In dashboard > Products:
1. Create 5 test products:
   - T-Shirt (Red, M/L/XL) - 25,000₮
   - Jeans (Blue, 28/30/32) - 45,000₮
   - Sneakers (White, 40/42/44) - 55,000₮
   - Backpack - 35,000₮
   - Hat - 15,000₮

2. Set all to "Active" status
3. Add at least 1 image per product
4. Set stock quantities > 0
```

#### 4d. Test Product Search Intent
```bash
# Send message: "Do you have t-shirts?"
# Expected AI response should:
- Classify intent as "product_search"
- Search products by keyword "t-shirt"
- Return matching products with prices
- Format as user-friendly message
```

#### 4e. Test Order Status Intent
```bash
# Create test order first (in dashboard)
# Then send message: "Where is my order?"
# Expected AI response should:
- Classify intent as "order_status"
- Look up customer's orders
- Return order status
```

**Success Criteria:**
- [ ] OpenAI API connected
- [ ] AI chat endpoint works
- [ ] Intent classification working
- [ ] Product search returns correct results
- [ ] Order status lookup works

**Time**: 3-4 hours

---

### Step 5: AI Reply to Facebook (Day 3)
**Priority**: P0

**Close the loop - send AI responses back to Facebook:**

#### 5a. Implement Facebook Send API
```typescript
// Check if this exists in your webhook handler:
// /api/webhook/messenger

async function sendFacebookMessage(
  pageAccessToken: string,
  recipientId: string,
  message: string
) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: pageAccessToken,
      }),
    }
  );
  
  return response.json();
}
```

#### 5b. Connect Webhook to AI
```typescript
// In webhook handler, after receiving message:
// 1. Save incoming message to DB
// 2. Generate AI response
// 3. Send AI response back to Facebook
// 4. Save AI response to DB

// Pseudo-code flow:
const incomingMessage = req.body.entry[0].messaging[0];
const senderId = incomingMessage.sender.id;
const messageText = incomingMessage.message.text;

// Save to DB
await saveMessage(conversationId, messageText, 'customer');

// Generate AI response
const aiResponse = await generateAIResponse(conversationId, messageText);

// Send back to Facebook
await sendFacebookMessage(pageAccessToken, senderId, aiResponse);

// Save AI response to DB
await saveMessage(conversationId, aiResponse, 'ai');
```

#### 5c. Test End-to-End Flow
```bash
# From Facebook Messenger:
You: "Do you have red t-shirts?"

# Expected:
1. Message received by webhook ✓
2. Saved to messages table ✓
3. AI generates response ✓
4. AI response sent to Facebook ✓
5. You receive reply in Messenger ✓
6. AI response saved to DB ✓

# Bot: "Yes! We have Red T-Shirt available in sizes M, L, XL for 25,000₮. Would you like to order?"
```

#### 5d. Test Multiple Intents
```bash
# Test product search:
You: "Show me jeans"
Bot: [Lists jeans with prices]

# Test order creation:
You: "I want the blue jeans size 30"
Bot: "Great! I'll create an order for Blue Jeans (size 30) - 45,000₮. Please confirm your delivery address."

# Test order status:
You: "Where is my order?"
Bot: [Shows order status]

# Test general query:
You: "What are your working hours?"
Bot: [Shows business hours from store settings]
```

**Success Criteria:**
- [ ] End-to-end flow works (customer message → AI response in Messenger)
- [ ] All messages saved to database
- [ ] Intent classification working
- [ ] Product search working
- [ ] Order creation working
- [ ] No duplicate messages

**Time**: 4-5 hours

---

### Step 6: Dashboard Chat View (Day 4)
**Priority**: P1

**Make sure store owner can see conversations:**

#### 6a. Test Conversation List
```bash
# In dashboard:
1. Go to /dashboard/chat
2. Should see list of conversations
3. Should show:
   - Customer name/ID
   - Last message preview
   - Unread count
   - Platform icon (Facebook)
   - Timestamp
```

#### 6b. Test Conversation Detail
```bash
# Click on a conversation
1. Should load /dashboard/chat/[id]
2. Should show:
   - Full message history
   - Customer info sidebar
   - Message input box
   - Send button
```

#### 6c. Test Manual Reply
```bash
# In conversation detail:
1. Type message: "Hello, I'm a human agent"
2. Click "Send"
3. Should:
   - Save to database with sender_type='agent'
   - Send to Facebook via API
   - Appear in conversation view
   - Customer receives in Messenger
```

#### 6d. Test Realtime Updates
```bash
# Open dashboard chat in browser
# Send message from Facebook Messenger
# Dashboard should:
- Show new message immediately (no refresh needed)
- Update conversation list
- Show notification badge
- Play sound (if enabled)
```

**Success Criteria:**
- [ ] Conversation list displays correctly
- [ ] Can view individual conversations
- [ ] Can send manual replies
- [ ] Manual replies appear in Messenger
- [ ] Realtime updates work

**Time**: 2-3 hours

---

### Step 7: Order Creation from Chat (Day 4-5)
**Priority**: P1

**Critical flow - customer orders via chat:**

#### 7a. Test AI Order Draft
```bash
# In Messenger:
You: "I want to order the red t-shirt size L"

# Expected AI behavior:
1. Extract: product="red t-shirt", size="L"
2. Search products
3. Create draft order
4. Respond: "Great! Red T-Shirt (L) - 25,000₮. Please confirm your address."
```

#### 7b. Test Address Collection
```bash
You: "Deliver to БЗД 3-р хороо, 45-р байр"

# Expected:
1. Parse address
2. Update order with address
3. Respond: "Perfect! Total: 28,000₮ (25,000₮ + 3,000₮ delivery). How would you like to pay?"
```

#### 7c. Test Payment Method
```bash
You: "Cash on delivery"

# Expected:
1. Update order payment_method='cash'
2. Finalize order
3. Respond: "Order confirmed! Order #1234. We'll deliver within 2-3 days."
```

#### 7d. Verify Order in Database
```sql
-- Check order was created:
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total,
  o.payment_method,
  o.delivery_address,
  oi.product_id,
  oi.quantity,
  oi.price
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.customer_id IN (
  SELECT id FROM customers WHERE messenger_id = 'test-messenger-id'
)
ORDER BY o.created_at DESC
LIMIT 1;
```

#### 7e. Verify Order in Dashboard
```bash
# In dashboard:
1. Go to /dashboard/orders
2. Should see new order
3. Click order
4. Should show:
   - Customer info
   - Order items
   - Delivery address
   - Payment method
   - Order status
```

**Success Criteria:**
- [ ] AI can extract order intent
- [ ] AI creates draft order
- [ ] AI collects address
- [ ] AI collects payment method
- [ ] Order saved to database correctly
- [ ] Order appears in dashboard
- [ ] Customer receives confirmation

**Time**: 3-4 hours

---

## WEEK 2: TEST WITH REAL SCENARIOS

### Step 8: Create Test Business Data (Day 5-6)
**Priority**: P1

**Use your test conversation files to populate store:**

#### 8a. Set Up Test Store Profile
```bash
# In dashboard > Settings > Store:
Business Name: Urban Style Boutique (Test)
Business Type: Commerce
Phone: +976 9999 1001
Address: Sukhbaatar District, UB
Working Hours: Mon-Sat 9am-6pm
Currency: MNT
```

#### 8b. Add Real Products
```bash
# Use data from: 01-COMMERCE-LAUNDRY-BEAUTY.md
# Add these products with variants:

1. Classic White Button Shirt
   - Variants: S/M/L in White/Blue
   - Prices: 45,000₮
   - Stock: 5-15 per variant

2. Casual Striped T-Shirt  
   - Variants: S/M/L in Navy-White/Black-White
   - Prices: 28,000₮
   - Stock: 10-20 per variant

3. High-Waist Jeans
   - Variants: 26/27/28/29 in Dark Blue/Light Blue
   - Prices: 55,000₮
   - Stock: 4-12 per variant

4. Leather Crossbody Bag
   - No variants
   - Price: 85,000₮
   - Stock: 15

5. Silk Scarf
   - Variants: Red Floral/Blue Floral/Green Floral
   - Prices: 35,000₮
   - Stock: 6-10 per variant
```

#### 8c. Configure Store Policies
```bash
# In dashboard > Settings > Policies:
Shipping Policy: 
"Standard: 2-3 days (5,000₮)
Express: Next day (10,000₮)
Free shipping over 200,000₮"

Return Policy:
"Returns within 7 days
Must be unworn with tags
Refund in 5-7 days"

Payment Methods:
"Cash on delivery, QPay, Bank transfer"
```

#### 8d. Set Up Delivery Zones
```bash
# In dashboard > Settings > Delivery:
Zone 1: Sukhbaatar District - 3,000₮ (free over 150,000₮)
Zone 2: Khan-Uul District - 4,000₮ (free over 150,000₮)
Zone 3: Other UB Districts - 5,000₮ (free over 200,000₮)
```

**Success Criteria:**
- [ ] Store profile complete
- [ ] 5+ products with variants added
- [ ] All products have images
- [ ] Stock quantities set
- [ ] Policies configured
- [ ] Delivery zones set up

**Time**: 2-3 hours

---

### Step 9: Run Test Conversations (Day 6-7)
**Priority**: P1

**Use test data from COMMERCE-REALISTIC-CONVERSATIONS.md:**

#### 9a. Test Product Inquiry (TEST-COM-001)
```bash
# In Messenger:
You: "M siz bayna uu? i ned medium"

# Expected:
Bot: Should understand despite typos
Bot: Should show products in size M
Bot: Should list available items
```

#### 9b. Test Mixed Language (TEST-COM-002)
```bash
You: "Энэ shirt-ийг L размер-тай авч болох уу? What colors?"

# Expected:
Bot: Understands Mongolian + English mix
Bot: Shows L size shirts
Bot: Lists color options
```

#### 9c. Test Shipping Cost (TEST-COM-003)
```bash
You: "Darkahn ruu hurgelt hed ve?"

# Expected:
Bot: Recognizes "Darkahn" as "Darkhan"
Bot: Shows shipping cost to Darkhan
Bot: Shows delivery time
```

#### 9d. Test Order Status (TEST-COM-005)
```bash
# Create test order first (via dashboard)
# Note the order number

You: "ORD-2026-0142 дугаартай захиалга маань хаана вэ?"

# Expected:
Bot: Extracts order number
Bot: Looks up order
Bot: Shows status and tracking info
```

#### 9e. Test Return Request (TEST-COM-006)
```bash
You: "буцаах бомжтой юу? хэрхн буцаах вэ"

# Expected:
Bot: Detects return intent despite typos
Bot: Shows return policy
Bot: Explains return process
```

#### 9f. Test Complete Order Flow (TEST-COM-012)
```bash
# Full multi-turn conversation:
You: "Хар өнгийн А загварын цүнх байна уу?"
Bot: [Shows black bags]

You: "Эхнийхийг нь захиалья"
Bot: [Creates draft order, asks address]

You: "БЗД 3-р хороо, 45-р байр 301 тоот"
Bot: [Calculates total, asks payment]

You: "QPay-аар төлье"
Bot: [Confirms order, provides order number]

# Verify:
- Order created in database
- Order appears in dashboard
- All items correct
- Address saved
- Payment method set
```

**Success Criteria:**
- [ ] 5/6 test scenarios pass
- [ ] AI understands typos
- [ ] AI handles mixed language
- [ ] Intent classification accurate
- [ ] Multi-turn context maintained
- [ ] Orders created successfully

**Time**: 4-5 hours

---

### Step 10: Test Escalation Flow (Day 7)
**Priority**: P1

**Test complaint handling (TEST-COM-011):**

```bash
# Turn 1:
You: "Илгээмж ирээгүй байна. 5 хоногийн өмнө илгээсэн гэсэн."

# Expected:
- Escalation score: +25 (complaint)
- Bot apologizes, asks for order number
- Score: 25 (low level)

# Turn 2:
You: "Яагаад ийм удаан байгаа юм!? хэн хариуцах вэ???"

# Expected:
- Escalation score: +20 (frustration) = 45 total
- Bot apologizes again, checks tracking
- Score: 45 (medium level)

# Turn 3:
You: "Хариулахгүй байхаар мөнгөө буцааж өг!!! Энэ яаж ийм байна!!!"

# Expected:
- Escalation score: +25 (payment_dispute) = 70 total
- ESCALATION TRIGGERED (score ≥ 60)
- Bot: "I'm connecting you with our team..."
- Dashboard notification appears
- Conversation status changes to "escalated"
```

#### 10a. Verify Escalation in Dashboard
```bash
# In dashboard > Chat:
1. Should see notification badge
2. Conversation marked as "Escalated"
3. Escalation score visible: 70
4. Alert shows complaint keywords detected
```

#### 10b. Test Agent Takeover
```bash
# In dashboard > Chat > [escalated conversation]:
1. Click "Take Over"
2. Send message: "Hello, I'm here to help. Let me check your order."
3. Verify:
   - AI stops responding
   - Agent messages sent to customer
   - Conversation status = "agent_handling"
```

**Success Criteria:**
- [ ] Escalation scoring works
- [ ] Escalation triggers at score ≥ 60
- [ ] Dashboard notification appears
- [ ] Agent can take over conversation
- [ ] AI stops responding after takeover

**Time**: 2-3 hours

---

## WEEK 3: POLISH & PILOT

### Step 11: Fix Critical Bugs (Day 8-9)
**Priority**: P0

**Based on testing, fix what's broken:**

```bash
# Common issues to watch for:
□ Messages not saving to database
□ AI not generating responses
□ Responses not sent back to Facebook
□ Duplicate conversations created
□ Incorrect intent classification
□ Product search not finding results
□ Order not saving to database
□ Realtime updates not working
□ Escalation not triggering
□ Dashboard not showing conversations
```

**Process:**
1. Document each bug with screenshots
2. Reproduce bug consistently
3. Check Vercel logs for errors
4. Fix in code
5. Deploy fix
6. Retest
7. Mark as fixed

**Time**: 8-10 hours (depends on bug severity)

---

### Step 12: Add Critical Monitoring (Day 9-10)
**Priority**: P1

**From Phase 51.1 - Minimum monitoring:**

#### 12a. Set Up Sentry Alerts
```bash
# If Sentry already configured:
1. Go to Sentry dashboard
2. Create alert rule:
   - Name: "Critical API Errors"
   - Condition: Error count > 10 in 5 minutes
   - Action: Email + Slack (if configured)

3. Create alert rule:
   - Name: "Webhook Failures"
   - Condition: /api/webhook/* errors
   - Action: Immediate notification
```

#### 12b. Set Up Uptime Monitoring
```bash
# Use UptimeRobot (free):
1. Go to uptimerobot.com
2. Add monitor:
   - Name: "Temuulel API Health"
   - Type: HTTP(s)
   - URL: https://your-domain.vercel.app/api/health
   - Interval: 5 minutes
   - Alert when down

2. Add monitor:
   - Name: "Facebook Webhook"
   - Type: Keyword
   - URL: https://your-domain.vercel.app/api/webhook/messenger
   - Keyword: "verify" (for GET request)
   - Alert when down
```

#### 12c. Test Monitoring
```bash
# Trigger test error:
1. Temporarily break webhook endpoint
2. Send Facebook message
3. Verify Sentry captures error
4. Verify you receive alert

# Verify uptime monitoring:
1. Check UptimeRobot dashboard
2. Should show "Up" status
3. Test alert by pausing site
```

**Success Criteria:**
- [ ] Sentry alert rules configured
- [ ] Uptime monitoring active
- [ ] Test alerts received
- [ ] Email notifications working

**Time**: 2-3 hours

---

### Step 13: Prepare Pilot Customer Onboarding (Day 10-11)
**Priority**: P1

#### 13a. Create Onboarding Checklist
```markdown
# New Store Onboarding (15 minutes)

□ Step 1: Sign up (2 min)
  - Go to temuulel.mn/signup
  - Enter business details
  - Verify email

□ Step 2: Connect Facebook (3 min)
  - Dashboard > Settings > Integrations
  - Click "Connect Facebook"
  - Select Facebook Page
  - Grant permissions

□ Step 3: Add Products (5 min)
  - Dashboard > Products > New
  - Add at least 3 products
  - Set prices and stock
  - Upload images

□ Step 4: Configure Settings (3 min)
  - Set working hours
  - Add delivery zones
  - Set policies

□ Step 5: Test Chat (2 min)
  - Send test message to your page
  - Verify bot responds
  - Check dashboard shows conversation

□ DONE! You're live! 🎉
```

#### 13b. Create Quick Start Video
```bash
# Screen record (5 minutes):
1. Sign up process
2. Facebook connection
3. Adding first product
4. Sending test message
5. Viewing in dashboard

# Upload to YouTube/Loom
# Share link with pilot customers
```

#### 13c. Prepare Support Materials
```markdown
# Common Issues & Solutions

Q: Bot not responding to Facebook messages
A: Check Facebook webhook is verified (Settings > Integrations)

Q: Products not showing in chat
A: Ensure products are "Active" status with stock > 0

Q: Can't connect Facebook page
A: Make sure you're an admin of the page

Q: Dashboard not showing conversations
A: Refresh page, check Facebook connection is active

Q: How to take over from AI?
A: Click "Take Over" button in conversation view
```

**Success Criteria:**
- [ ] Onboarding checklist complete
- [ ] Quick start video recorded
- [ ] FAQ document created
- [ ] Support email/chat channel set up

**Time**: 3-4 hours

---

### Step 14: Recruit 3 Pilot Customers (Day 11-12)
**Priority**: P0

**Target Profile:**
- Small businesses (1-5 employees)
- Active on Facebook
- Selling physical products
- Tech-friendly owner
- Willing to give feedback

#### 14a. Identify Candidates
```bash
# Option 1: Personal network
- Friend's online shop
- Family member's business
- Former colleague's side hustle

# Option 2: Local businesses
- Contact via Facebook
- Offer free 1-month trial
- Position as "beta tester"

# Option 3: Online communities
- Post in entrepreneur Facebook groups
- Reddit /r/entrepreneur
- Local business forums
```

#### 14b. Pitch Template
```
Subject: Free AI Chatbot for Your Business (Beta Test)

Hi [Name],

I'm launching Temuulel - an AI assistant that chats with your Facebook customers 24/7.

I'm looking for 3 businesses to beta test (FREE for 1 month).

What it does:
- Answers product questions automatically
- Takes orders via Facebook Messenger
- Handles shipping/payment info
- Escalates complaints to you

Setup takes 15 minutes. Interested?

[Your Name]
temuulel.mn
```

#### 14c. Selection Criteria
```bash
# Choose businesses that:
✓ Respond quickly to inquiry
✓ Have 10-50 products (not too simple/complex)
✓ Get 5+ customer messages per day
✓ Are active on Facebook (post regularly)
✓ Owner is hands-on (will give feedback)

# Avoid:
✗ Too busy to provide feedback
✗ Not on Facebook
✗ Extremely complex product catalog
✗ Inactive business
```

**Success Criteria:**
- [ ] 3 pilot customers recruited
- [ ] All 3 confirmed start date
- [ ] Contact info collected
- [ ] Onboarding calls scheduled

**Time**: 4-6 hours

---

### Step 15: Onboard Pilot Customers (Day 12-14)
**Priority**: P0

**Process per customer:**

#### 15a. Onboarding Call (30 minutes each)
```bash
# Agenda:
1. Intro (5 min)
   - Your background
   - Why you built this
   - What to expect from beta

2. Setup (15 min)
   - Screen share
   - Walk through sign up
   - Connect Facebook page
   - Add 3 sample products
   - Test first message

3. Training (10 min)
   - How to view conversations
   - How to take over from AI
   - How to add more products
   - What to do if something breaks
```

#### 15b. First Week Support
```bash
# Daily check-ins:
Day 1: "How's it going? Any issues?"
Day 2: "Let me know if you need help with anything"
Day 3: "Have you received any customer messages?"
Day 7: "Let's do a quick review call"

# Monitor their usage:
- Check conversation count
- Check order count
- Check error rates
- Watch for escalations
```

#### 15c. Collect Feedback
```bash
# After 1 week, ask:
1. What's working well?
2. What's confusing?
3. What features are missing?
4. Would you pay for this?
5. What price seems fair?

# Document everything
# Prioritize fixes based on feedback
```

**Success Criteria:**
- [ ] All 3 customers onboarded
- [ ] All 3 receiving messages via AI
- [ ] At least 1 order placed via chat
- [ ] Feedback collected from all 3
- [ ] Critical issues identified

**Time**: 6-8 hours spread over 3 days

---

## 📊 SUCCESS METRICS

After 2 weeks with pilot customers, you should have:

### Technical Metrics
```bash
□ 0 critical bugs
□ 95%+ webhook uptime
□ < 2 second AI response time
□ 0 lost messages
□ 0 duplicate conversations
```

### Business Metrics
```bash
□ 3 pilot customers active
□ 50+ messages handled by AI
□ 5+ orders placed via chat
□ 2+ escalations handled correctly
□ 80%+ pilot customer satisfaction
```

### Product Validation
```bash
□ AI intent accuracy > 85%
□ Product search success rate > 90%
□ Order completion rate > 60%
□ Customers confirm "this is useful"
□ All 3 pilots want to continue
```

---

## 🚨 IF THINGS GO WRONG

### Scenario A: Facebook Integration Won't Connect
```bash
Priority: P0 - Nothing works without this

Debug steps:
1. Check Facebook app status (not restricted?)
2. Verify webhook is deployed to production
3. Check FACEBOOK_VERIFY_TOKEN matches
4. Test webhook manually with curl
5. Check Facebook app has Messenger product
6. Verify page permissions granted

Get help:
- Facebook Developers Community
- Check Vercel deployment logs
- Test locally with ngrok first
```

### Scenario B: AI Responses Are Terrible
```bash
Priority: P1 - Customers will complain

Quick fixes:
1. Add more product context (descriptions, tags)
2. Improve intent classification prompts
3. Add more training examples
4. Tune confidence thresholds
5. Add fallback responses
6. Enable easier escalation

Workaround:
- Turn off AI auto-reply temporarily
- Have agent respond manually
- Fix AI in background
```

### Scenario C: Pilot Customer Drops Out
```bash
Priority: P1 - Need 3 active pilots

Actions:
1. Exit interview - understand why
2. Fix their issues immediately
3. Recruit replacement pilot
4. Improve onboarding for next pilot
5. Consider offering more incentive

Remember:
- Dropping out is valuable feedback
- Don't take it personally
- Use it to improve product
```

---

## 📋 DAILY CHECKLIST (During Pilot)

```bash
Every Morning:
□ Check Sentry for new errors
□ Check uptime monitoring status
□ Review conversation count from yesterday
□ Respond to pilot customer questions

Every Evening:
□ Review all pilot customer conversations
□ Check for escalations needing attention
□ Note any recurring issues
□ Plan fixes for tomorrow
```

---

## ✅ DEFINITION OF "WORKING"

You can say "IT WORKS" when:

```bash
✓ Facebook page connected
✓ Customer sends message on Facebook
✓ Message appears in your dashboard
✓ AI generates relevant response
✓ Customer receives response in Messenger
✓ Customer can browse products
✓ Customer can place order
✓ Order appears in dashboard
✓ Agent can take over conversation
✓ All data saves to database
✓ No critical errors for 24 hours
✓ 3 pilot customers using daily
```

Then you're ready for Phase 52: Marketing & Growth! 🚀

---

**Estimated Total Time:**
- Week 1: 20-25 hours
- Week 2: 15-20 hours  
- Week 3: 15-20 hours
- **TOTAL: 50-65 hours = 2-3 weeks full-time**

**Next steps after this:**
Once you have 3 successful pilot customers, we create:
- Marketing plan
- Pricing strategy  
- Customer acquisition playbook
- Scale-up roadmap

**Ready to start? Which step should we tackle first?** 🎯
