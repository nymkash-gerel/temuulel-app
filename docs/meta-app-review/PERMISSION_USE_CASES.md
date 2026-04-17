# Meta App Review — Permission Use Case Descriptions

Copy-paste these into the Meta App Review submission form. Each permission has:
1. **Use case description** (what you submit)
2. **Step-by-step testing instructions** (for the reviewer)
3. **Screencast reference** (which of the 5 videos shows it)

**App name:** Temuulel
**Category:** Business, Messaging
**Business Use:** Yes — we are a registered LLC in Mongolia operating as a SaaS platform.

---

## 1. `pages_messaging`

### Use case description (submit verbatim)

> Temuulel is a multi-tenant SaaS chatbot platform that lets Mongolian small
> businesses (shops, restaurants, salons, clinics) automatically respond to
> customer messages on their Facebook Page. When a customer sends a message to
> a Page that has connected to Temuulel, our AI classifies the intent, searches
> the business's product or service catalog, and sends a contextually relevant
> response — including product cards with images, prices, and one-tap "Order"
> buttons. Business owners can also manually take over any conversation from
> our unified inbox dashboard ("operator mode"). This permission is essential:
> without it, we cannot send or receive messages on behalf of the connected
> Pages, which is the core product.

### Testing instructions

1. Log into Temuulel at `https://temuulel.com/login` with:
   - Email: `demo@temuulel.com`
   - Password: `FBReview2026!`
2. Navigate to **Settings → Integrations → Facebook**. You'll see the
   Facebook Page "Temuulel Demo Shop" already connected.
3. Open Facebook Messenger on a second account (not the demo account).
4. Search for the Page "Temuulel Demo Shop" and send the message:
   `"Сайн байна уу, ямар утас байна?"` (Hello, what phones do you have?)
5. Within 5 seconds, the AI will reply with a carousel of 3 phones from the
   demo catalog.
6. Switch back to Temuulel. Open `/dashboard/chat`. The conversation from step
   4 appears in the inbox in real time with full message history visible to
   the business owner.

### Screencast
Video 3 — Customer Messages Flow

---

## 2. `pages_manage_metadata`

### Use case description

> We use `pages_manage_metadata` exclusively to subscribe the Page to our
> webhook when the business owner connects their Facebook Page during
> onboarding. This subscription lets us receive `messages`, `messaging_postbacks`,
> `message_reads`, and `messaging_deliveries` events from that specific Page
> so we can respond to customer inquiries. We do not modify Page settings,
> posts, or any public Page metadata.

### Testing instructions

1. Log into Temuulel with the demo account.
2. Create a new test store, or go to **Settings → Integrations → Facebook**.
3. If not already connected, click "Connect Facebook". Select a test Page you
   administer.
4. Observe that Temuulel only subscribes the Page to webhook events — no Page
   metadata is modified.
5. Check Graph API: `GET /{page-id}/subscribed_apps` will show Temuulel in the
   list. That is the only visible effect.

### Screencast
Video 2 — Facebook Page Connection (0:45–1:30 section)

---

## 3. `business_management`

### Use case description

> As a multi-tenant SaaS platform, Temuulel lets business owners connect
> multiple Facebook Pages they manage (e.g. a chain restaurant with 5 locations).
> The `business_management` permission lets us list the Pages and Business
> Assets that the logged-in user manages, so we can present them as connection
> options in our onboarding flow. We do not modify Business Manager settings,
> assets, or ad accounts — we only read the list of Pages the user can connect.

### Testing instructions

1. Log into Temuulel with the demo account.
2. Click "Add another Page" on the integrations screen.
3. You'll be redirected to Facebook's OAuth dialog, which includes
   `business_management` in the requested scopes.
4. After granting, Temuulel displays a dropdown of all Pages the test user
   administers. Select any Page to connect.
5. The selected Page becomes available in the Temuulel dashboard as a separate
   store.

### Screencast
Video 2 — Facebook Page Connection (0:00–0:45 section)

---

## 4. `instagram_basic`

### Use case description

> Temuulel supports Instagram Direct Messages in addition to Messenger. Many
> of our Mongolian business customers run their storefront primarily through
> Instagram. `instagram_basic` lets us read the business's Instagram account
> metadata (account ID, username, profile picture) so we can confirm the
> correct account is linked and display it in our dashboard.

### Testing instructions

1. Log into Temuulel demo account.
2. Navigate to **Settings → Integrations → Instagram**.
3. Click "Connect Instagram". OAuth will request `instagram_basic` among
   other scopes.
4. After granting, the Instagram username and profile picture appear in the
   dashboard.

### Screencast
Video 4 — Instagram DM Handling (0:00–0:30)

---

## 5. `instagram_manage_messages`

### Use case description

> This permission lets us receive and respond to Instagram Direct Messages
> sent to the business's connected Instagram account. The flow is identical
> to Messenger: customer sends a DM → our webhook receives it → AI classifies
> intent → AI replies in the same DM thread. Without this permission, IG DM
> customers cannot be served, which is critical for businesses whose main
> customer channel is Instagram.

### Testing instructions

1. Log into Temuulel demo account. Confirm Instagram is connected (see
   previous section).
2. Open Instagram on a second account (not the demo business account).
3. Go to the profile `@temuulel_demo_shop` and send a DM:
   `"Үнэ хэд вэ?"` (How much does it cost?)
4. Within 5 seconds, the AI replies in the same DM thread.
5. Open `/dashboard/chat` in Temuulel — the conversation appears alongside
   Messenger conversations in the unified inbox.

### Screencast
Video 4 — Instagram DM Handling (0:30–1:30)

---

## 6. `pages_read_engagement` (only if requested)

### Use case description

> Used only for Facebook comment auto-reply feature. When a business enables
> "Comment auto-reply", we read new comments on their Page's posts (via
> `feed` webhook subscription) and optionally send a canned DM to the commenter
> inviting them into a conversation. We do not read other engagement data
> (reactions, shares, etc.).

### Testing instructions

1. Log into demo account, go to **Settings → Comment Rules**.
2. Create a rule: "If comment contains 'үнэ' (price), reply with DM invitation."
3. Post a public comment on the demo Page's latest post containing the word
   "үнэ".
4. Within 10 seconds, the test user will receive a DM from the Page inviting
   them to a chat.

### Screencast
Not in the 5 main videos. Record as Video 6 if this permission is requested.

---

## App settings checklist

Fill these in the Basic Settings of the App:

| Field | Value |
|-------|-------|
| **App domains** | `temuulel.com` |
| **Privacy Policy URL** | `https://temuulel.com/privacy` |
| **Terms of Service URL** | `https://temuulel.com/terms` |
| **Data Deletion URL** | `https://temuulel.com/data-deletion` |
| **Data Handling URL** | `https://temuulel.com/data-handling` |
| **User Data Deletion Callback URL** | `https://temuulel.com/api/data-deletion` |
| **App Icon** | 1024×1024 PNG — use `/public/icon-1024.png` |
| **Category** | Business |
| **Contact Email** | `support@temuulel.com` |

## Webhook settings

| Field | Value |
|-------|-------|
| **Callback URL** | `https://temuulel.com/api/webhook/messenger` |
| **Verify Token** | (value of `MESSENGER_VERIFY_TOKEN` in Vercel env) |
| **Subscription Fields** | `messages`, `messaging_postbacks`, `message_reads`, `messaging_deliveries`, `feed` (if using comment auto-reply) |

## Test user credentials (to include in the submission)

```
Temuulel dashboard:
  URL:      https://temuulel.com/login
  Email:    demo@temuulel.com
  Password: FBReview2026!

Connected Facebook Page:
  Name:    Temuulel Demo Shop
  Page ID: [fill in after creation]

Test customer account (for demonstrating message flow):
  FB user:   [provide a test user you've added via Roles → Test Users]
  IG user:   [provide a test IG account linked to that FB test user]
```

## Data handling questionnaire — prepared answers

1. **Do you sell user data?** No.
2. **Do you use Meta data for advertising?** No.
3. **Do you share with third parties?** Only processors (see Data Handling page, section 5). All are DPA-bound.
4. **Do you retain data longer than necessary?** No. Retention schedule on `/data-handling` section 6.
5. **Is data encrypted in transit and at rest?** Yes. TLS 1.3 + AES-256.
6. **How do users delete data?** Email `privacy@temuulel.com`, in-app Delete Account, or Facebook's Apps & Websites removal flow.
7. **Where is data stored?** Supabase (AWS Singapore ap-southeast-1).
8. **Do you have a DPA with Meta?** Will accept Meta's Platform Terms which include data handling obligations.

## Review tips

- **Prepare a real Page.** Don't use the Page reviewer sees as a "test-only" stub. Pre-load it with 5–10 products, 2–3 real-looking conversations, and realistic branding.
- **Respond to reviewer questions within 24h.** Reviewers often ask follow-ups. Fast reply = faster approval.
- **Submit permissions one-by-one if unsure.** You can request `pages_messaging` first, get approved, then add Instagram in a second submission. Reduces risk of a single permission issue blocking everything.
- **Keep videos under 2 min each.** Reviewers often skim. Front-load the most important action in the first 30 seconds.
- **Don't obscure audio with music.** Clear narration is critical.
