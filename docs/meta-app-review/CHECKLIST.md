# Meta App Review — submission checklist

Working order for the submission. `PERMISSION_USE_CASES.md` holds the text to
paste per permission; `SCREENCASTS.md` holds the video scripts. This file is
what to do, in what order, and what is already done.

Status as of 2026-08-14: the app is live at `https://temuulel.com`, so
everything a reviewer needs to reach is reachable.

---

## Already done — verified live, no action

| Item | Evidence |
|---|---|
| Privacy Policy URL | `https://temuulel.com/privacy` → 200 |
| Terms of Service URL | `https://temuulel.com/terms` → 200 |
| Data Deletion **callback** | `https://temuulel.com/api/data-deletion` → 200. Parses `signed_request`, verifies HMAC-SHA256 against `FACEBOOK_APP_SECRET`, deletes the user's data, returns `{url, confirmation_code}` as Meta requires |
| Data Deletion **instructions page** | `https://temuulel.com/data-deletion` → 200 (plus `/data-deletion/status`) |
| OAuth redirect URI | `https://temuulel.com/api/auth/facebook/callback` — built from `NEXT_PUBLIC_APP_URL` |
| Webhook endpoint | `https://temuulel.com/api/webhook/messenger` — verify handshake confirmed to **reject a wrong token** rather than echo the challenge |
| App is live and reachable | smoke test passes with no warnings |

---

## Blockers — do these first

> Two of the three are now cleared. What is left is the test assets and the
> videos — both hands-on, neither blocked by anyone else.

### ~~1. Permission-list discrepancy~~ — RESOLVED 2026-08-14

The code requests **seven** scopes
(`src/app/api/auth/facebook/route.ts:62-71`); the write-ups covered six, and
one was marked conditional when it is not. Both fixed:

- `pages_show_list` now has a use case (§7). It backs the Page picker —
  `GET /me/accounts` at `callback/route.ts:179` — and is requested on every
  connect.
- `pages_read_engagement` is no longer headed "only if requested". The code
  requests it unconditionally, so it will always be reviewed and needs its own
  **Video 6**.

All seven now have a use case: `pages_messaging`, `pages_manage_metadata`,
`business_management`, `instagram_basic`, `instagram_manage_messages`,
`pages_read_engagement`, `pages_show_list`.

### ~~2. Business Verification~~ — APPROVED 2026-08-14

Confirmed approved in Meta Business Manager. This was the slowest dependency;
advanced access to the page/messaging permissions is no longer blocked on it.

### 3. Test assets the reviewer will use

The reviewer must be able to reproduce every claim without you.

- [ ] Facebook **Test User** with a Page they administer (App Dashboard → Roles
      → Test Users). A personal account is not a substitute.
- [ ] A second Test User to play the customer sending messages.
- [ ] A Temuulel demo account, and a store — `SCREENCASTS.md` assumes
      "Temuulel Demo Shop" with ~10 products loaded, so the AI has a catalogue
      to answer from. An empty catalogue makes the demo look broken.
- [ ] Put those credentials in the submission's "App Review test account"
      fields.

---

## Screencasts — 6 videos

Scripts are in `SCREENCASTS.md`. 1080p, screen + narration in English, uploaded
unlisted (Loom / YouTube), URLs pasted into the submission.

- [ ] **1. Product overview** (1:30) — what Temuulel is and who uses it
- [ ] **2. Page connection** (2:00) — the OAuth consent screen must be visible,
      showing the exact permissions being granted. This is the video reviewers
      scrutinise most.
- [ ] **3. Customer message → AI reply** (1:30) — the core `pages_messaging`
      claim, shown end to end
- [ ] **4. Instagram DM handling** (1:30) — only if submitting the two
      `instagram_*` scopes
- [ ] **5. Data deletion** (1:00) — removing the app from Facebook settings,
      then showing the data is gone
- [ ] **6. Comment auto-reply** — `pages_read_engagement`. Not in
      `SCREENCASTS.md` yet; the testing steps in `PERMISSION_USE_CASES.md` §6
      are the script (create a comment rule → post a matching comment → the
      commenter receives a DM)

Two things worth doing in every video: show the **URL bar** so the reviewer can
see it is the live domain, and narrate what permission each step exercises.

---

## App Dashboard configuration

- [ ] App **Mode: Live** (a Development-mode app cannot be reviewed)
- [ ] App icon (1024×1024) and category set
- [ ] Privacy Policy URL, Terms of Service URL, Data Deletion callback filled in
      with the URLs in the table above
- [ ] Valid OAuth redirect URI whitelisted:
      `https://temuulel.com/api/auth/facebook/callback`
- [ ] Webhook subscribed to the `messages` and `messaging_postbacks` fields on
      the Page, pointing at `https://temuulel.com/api/webhook/messenger`
- [ ] Optional but tidy: a **Deauthorize callback URL**. The app has no handler
      for it today — the data-deletion callback covers the deletion obligation,
      so this is a nice-to-have, not a blocker.

---

## Submit

- [ ] Paste each use case from `PERMISSION_USE_CASES.md` **verbatim** into its
      permission's field — they were written to match what the videos show
- [ ] Attach the matching screencast URL per permission
- [ ] Fill the test-account fields
- [ ] Submit, then expect a wait. Review turnaround is long and often includes
      one round of clarification, so submit before you need it, not after.

---

## If it comes back rejected

Meta's rejections usually name a permission and say the use case or video did
not demonstrate it. The common causes here would be: the OAuth consent screen
not visible in video 2, the reviewer's test user unable to reach a working
store, or a permission requested in code but not justified in the submission —
the class of problem blocker 1 was.
