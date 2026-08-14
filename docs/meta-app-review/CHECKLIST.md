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

### 1. Resolve the permission-list discrepancy

The code requests **seven** scopes; the write-ups cover six, and one is
described as conditional when it is not. From
`src/app/api/auth/facebook/route.ts:62-71`:

```text
pages_show_list          <- requested ALWAYS, no use-case write-up exists
pages_messaging          <- documented
pages_read_engagement    <- requested ALWAYS, but documented as "only if requested"
pages_manage_metadata    <- documented
business_management      <- documented
instagram_manage_messages <- documented (added only when channel=instagram)
instagram_basic          <- documented (added only when channel=instagram)
```

Meta wants a use case for every permission the app requests. Before submitting:

- [ ] Write a `pages_show_list` use case, or drop it from the scope list if the
      page picker can work without it. The code comment says it is needed "to
      list ALL pages the user manages".
- [ ] Change the `pages_read_engagement` heading in `PERMISSION_USE_CASES.md`
      from "only if requested" — it is always requested, so it will always be
      reviewed.

### 2. Business Verification

- [ ] Confirm Business Verification is **complete** in Meta Business Manager,
      not just submitted. Advanced access to page/messaging permissions depends
      on it, and it is the slowest step — start it first if it is not done.

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

## Screencasts — 5 videos

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
which is exactly what the discrepancy in blocker 1 would cause.
