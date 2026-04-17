# Meta App Review — Screencast Guide

Record 5 short videos (1-2 min each). Record at **1080p**, screen + narration (English).
Upload to Loom / YouTube unlisted, then paste URLs into the Meta App Review submission.

**Tools recommended:** Loom, QuickTime (macOS), OBS Studio.

**Test accounts to prepare:**
- Temuulel owner: `demo@temuulel.com` / Facebook Test User: `fb-tester-1@temuulel.com`
- Sample business store: "Temuulel Demo Shop" with 10 products pre-loaded
- A second Facebook Test User to play the "customer"

---

## Video 1 — Product Overview (1:30)

**Goal:** Show the reviewer what Temuulel is and who uses it.

**Script:**

> "Hi, I'm [name], founder of Temuulel. Temuulel is a multi-tenant SaaS platform
> that lets any Mongolian business — shops, restaurants, beauty salons, clinics —
> connect their Facebook Page and Instagram, and automatically handle customer
> messages with AI. [*show landing page, scroll through features*]
>
> Business owners sign up, connect their Facebook Page via OAuth, upload their
> product catalog or service menu, and our AI handles customer inquiries in
> Mongolian 24/7. [*show dashboard*]
>
> The platform currently supports 24 business verticals. Let me show you how it
> works end-to-end in the next videos."

**Screen actions:**
1. Visit `https://temuulel.com` landing page
2. Scroll through "Features" section
3. Click "Sign up" — show form briefly
4. Log into existing demo account
5. Show dashboard home

---

## Video 2 — Facebook Page Connection (OAuth + Webhook) (2:00)

**Goal:** Show the permission flow for `pages_messaging`, `pages_manage_metadata`, `business_management`.

**Script:**

> "In this video I'll show how a business owner connects their Facebook Page to
> Temuulel. This is where we request the `pages_messaging` and
> `pages_manage_metadata` permissions. [*navigate to Integrations*]
>
> The business clicks 'Connect Facebook'. They're redirected to Facebook's OAuth
> dialog. They grant permission for our app to manage their page metadata, send
> and receive messages on behalf of the page, and access their business assets
> via `business_management`. [*walk through consent screens*]
>
> After granting, Facebook redirects back. We exchange the token for a
> long-lived Page Access Token, subscribe the Page to our webhook, and store
> the token encrypted in our database. The business is now connected. [*show
> success state*]"

**Screen actions:**
1. `/dashboard/settings/integrations/facebook`
2. Click "Connect Facebook"
3. Facebook OAuth consent screen (highlight each permission requested)
4. Grant permission
5. Back in Temuulel — show "Connected" status with Page name + ID
6. Send a test message to confirm webhook works

---

## Video 3 — Customer Messages Flow (AI response) (1:30)

**Goal:** Demonstrate `pages_messaging` in action.

**Script:**

> "Here's how customer conversations work. A customer opens the business's
> Facebook Page and sends a message in Mongolian — let's say 'сайн байна уу,
> ямар бараа байна?'. [*send message from second FB test user*]
>
> Our webhook receives the message instantly via the `messages` subscription
> field. The AI classifies intent, searches the business's product catalog,
> and responds with a carousel of matching products, prices, and 'Order' buttons.
> [*show message appearing in Messenger*]
>
> The business owner sees the conversation in their Temuulel dashboard in
> real-time. [*switch to /dashboard/chat*] They can take over the conversation
> manually if needed — we call this 'operator mode'."

**Screen actions:**
1. Split screen: Facebook Messenger (left) + Temuulel dashboard (right)
2. Send message as customer via Messenger
3. Watch AI respond within 2-3 seconds
4. Open `/dashboard/chat` → see conversation appear live
5. Click conversation → show message history
6. Toggle "Operator mode" → show AI pausing, owner can now type directly

---

## Video 4 — Instagram DM Handling (1:30)

**Goal:** Demonstrate `instagram_basic` + `instagram_manage_messages`.

**Script:**

> "Temuulel also supports Instagram Direct Messages. Let's show the same flow
> on Instagram. [*open IG app*]
>
> When the business Instagram account is connected via `instagram_basic` and
> `instagram_manage_messages`, incoming DMs are routed to the same AI pipeline
> as Messenger. [*send IG DM*]
>
> The AI responds in the IG DM thread, and the conversation appears in the
> same unified inbox in Temuulel. This lets small businesses handle all
> customer messages from one dashboard."

**Screen actions:**
1. Show Instagram account settings in Temuulel
2. Send DM from second IG test account
3. Show AI response in IG DM
4. Show unified inbox in dashboard with both FB + IG conversations

---

## Video 5 — Data Deletion & Account Management (1:00)

**Goal:** Demonstrate compliance with data deletion requirements.

**Script:**

> "We take data privacy seriously. Business owners can delete their account at
> any time from Settings → Delete Account. [*show delete flow*]
>
> End customers can request data deletion two ways: by emailing
> privacy@temuulel.com, or — for users who logged in via Facebook — by removing
> our app from their Facebook Settings. In that case, Facebook sends a signed
> request to our Data Deletion Callback URL, and we automatically erase all
> their data within 30 days. [*show /data-deletion page*]
>
> All deletion actions are logged for audit purposes. [*show data_deletion_log
> table via SQL*]"

**Screen actions:**
1. `/data-deletion` page
2. Dashboard → Settings → "Delete Account" section
3. Show callback URL: `https://temuulel.com/api/data-deletion`
4. Briefly show the deletion log table in Supabase
