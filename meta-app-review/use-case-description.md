# Meta App Review — pages_messaging Permission
# Use Case Description

## App Name
Temuulel — AI Business Automation Platform

## Permission Requested
`pages_messaging`

---

## Use Case Description (Submit this to Meta)

**Temuulel** is a SaaS platform that enables Mongolian small and medium businesses to automate customer conversations and order management through Facebook Messenger.

### How we use pages_messaging:

When a customer sends a message to a business's Facebook Page (e.g., asking about a product's price, size, or availability), our platform:

1. **Receives the customer's message** via the Messenger webhook
2. **Classifies the customer's intent** using our AI (e.g., product inquiry, order request, delivery status)
3. **Responds automatically** with product information, pricing, and availability
4. **Collects order details** through a multi-step conversation (product selection → customer name → delivery address → phone number → order confirmation)
5. **Creates an order record** in the business's dashboard
6. **Sends order confirmation** back to the customer via Messenger

### Example conversation flow:

> Customer: "Хар өнгийн S размер байна уу?" (Is the black S size available?)
> Bot: "Тийм, байна. Үнэ: 45,000₮. Захиалах уу?" (Yes, available. Price: 45,000₮. Would you like to order?)
> Customer: "Тийм" (Yes)
> Bot: "Нэрээ бичнэ үү" (Please enter your name)
> Customer: "Болормаа"
> Bot: "Хүргэлтийн хаягаа бичнэ үү" (Please enter your delivery address)
> Customer: "БЗД 3-р хороо, 45 тоот"
> Bot: "Утасны дугаараа бичнэ үү" (Please enter your phone number)
> Customer: "99001234"
> Bot: "✅ Захиалга амжилттай! Захиалгын дугаар: ORD-001. Жолооч тантай холбогдоно." (Order confirmed! Order #ORD-001. A driver will contact you.)

### Business value:
- Businesses can accept orders 24/7 without manual intervention
- Reduces response time from hours to seconds
- Enables small businesses to compete with larger e-commerce platforms
- Supports the Mongolian language (Cyrillic script)

### Data handling:
- Customer messages are processed to extract order information only
- No messages are stored beyond what is necessary for order fulfillment
- All data is handled in compliance with Mongolia's Personal Data Protection Law
- Full privacy policy: https://www.temuulel.com/privacy

### Pages using this permission:
Business owners connect their Facebook Pages to Temuulel through our OAuth flow. Each page's access token is stored securely and used only to send automated responses to customers who have initiated a conversation.

---

## Data Deletion
Users can request data deletion at: https://www.temuulel.com/data-deletion
