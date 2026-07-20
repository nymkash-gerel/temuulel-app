# Meta App Review — Permission Descriptions
# "Describe how your app uses this permission or feature" талбарт оруулах текстүүд

---

## 1. pages_show_list

**Талбарт хуулах:**

```
Temuulel allows business owners to connect their Facebook Pages to our platform through an OAuth flow. We use pages_show_list to display the list of Pages that the business owner manages, so they can select which Page to connect to their Temuulel store account. This is a one-time setup step — the page owner selects their business Page during onboarding, and we store only the selected Page ID and access token to enable automated Messenger responses for that Page.
```

---

## 2. pages_manage_metadata

**Талбарт хуулах:**

```
We use pages_manage_metadata to set up and manage the Messenger webhook subscription for connected Facebook Pages. When a business owner connects their Page to Temuulel, we subscribe to the messaging events on that Page so our AI chatbot can receive and respond to customer messages in real time. Without this permission, we cannot establish the webhook connection needed to receive incoming Messenger messages.
```

---

## 3. pages_messaging ⭐ (хамгийн чухал)

**Талбарт хуулах:**

```
Temuulel is an AI-powered order management platform for Mongolian small businesses. We use pages_messaging to:

1. RECEIVE customer messages sent to the business's Facebook Page via Messenger
2. SEND automated AI responses to customers in real time (product information, pricing, availability)
3. COLLECT order details through a multi-step conversation (name → delivery address → phone number → order confirmation)
4. SEND order confirmation messages to customers after their order is registered

Example flow:
- Customer sends: "Хар өнгийн S размер байна уу?" (Is the black S size available?)
- Our AI responds: "Тийм, байна. Үнэ: 45,000₮. Захиалах уу?" (Yes, available. Price 45,000₮. Would you like to order?)
- Customer confirms and provides their name, address, and phone number through the chat
- Our system creates an order in the business dashboard and sends confirmation

We ONLY respond to messages that customers initiate. We do NOT send unsolicited promotional messages. All responses are directly related to the customer's inquiry about products or orders.

Privacy policy: https://www.temuulel.com/privacy
```

**"Instructions for how to reproduce this feature" талбарт:**

```
To reproduce this feature:
1. Go to the Facebook Page connected to Temuulel (business's Page)
2. Send a message as a customer: "Бараа байна уу?" (Do you have products available?)
3. The Temuulel AI will automatically respond within 2-3 seconds with product information
4. Reply "захиалах" (order) to begin the order flow
5. The bot will collect: name, delivery address, phone number
6. After confirmation, check the Temuulel dashboard at https://www.temuulel.com/dashboard/orders to see the new order

Test account credentials available upon request.
```

---

## 4. instagram_manage_messages

**Талбарт хуулах:**

```
We use instagram_manage_messages to receive and respond to customer messages sent to the business's Instagram professional account via Instagram Direct Messages. Many Mongolian businesses receive customer inquiries through Instagram DMs about product availability, pricing, and orders. Temuulel's AI automatically handles these conversations — answering product questions and collecting order details — the same way it does for Facebook Messenger. This allows business owners to manage both Facebook and Instagram customer conversations from a single dashboard without manual intervention.
```

---

## 5. instagram_basic

**Талбарт хуулах:**

```
We use instagram_basic to retrieve basic information about the Instagram professional account connected to the business's Facebook Page. This is required to properly link the Instagram account to the business's Temuulel store account and enable the instagram_manage_messages functionality. We use this permission only during the initial account connection setup and do not store any personal Instagram data beyond the account ID needed to route incoming messages correctly.
```

---

## Screencast (video) талбарт

Бүх 5 permission-д **нэг ижил video** ашиглаж болно:
→ [`demo-video-script.md`](demo-video-script.md) дагуу бичсэн бичлэг

YouTube Unlisted URL-г бүх permission-д оруулах.

---

## Дараалал

1. `pages_show_list` → Get started → текст оруул → video URL → Agree → Save
2. `pages_manage_metadata` → Get started → текст оруул → video URL → Agree → Save
3. `pages_messaging` → Get started → текст оруул → video URL → instructions оруул → Agree → Save
4. `instagram_basic` → Get started → текст оруул → video URL → Agree → Save
5. `instagram_manage_messages` → Get started → текст оруул → video URL → Agree → Save
6. Next → Submit
