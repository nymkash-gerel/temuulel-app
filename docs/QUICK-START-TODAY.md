# QUICK START - WHAT TO DO TODAY

**Your Situation**: Platform built, but Facebook not connected, no real customer tests  
**Goal**: Working system in 2-3 weeks  
**Start Here**: Day 1 checklist below

---

## 🎯 TODAY (Day 1): Connect Facebook

### Step 1: Create Facebook App (1 hour)

```bash
1. Go to https://developers.facebook.com/apps/
2. Click "Create App" → Choose "Business"
3. Name: "Temuulel AI Assistant"
4. Save App ID and Secret
```

### Step 2: Add Messenger Product (30 min)

```bash
1. In app dashboard, click "Add Product"
2. Select "Messenger" → Click "Set Up"
3. Generate Page Access Token:
   - Select a test page you control
   - Copy token (starts with EAAG...)
```

### Step 3: Update Environment Variables (15 min)

```bash
# In .env.local:
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_VERIFY_TOKEN=create_random_string_here

# Copy same to Vercel:
vercel env add FACEBOOK_APP_ID
vercel env add FACEBOOK_APP_SECRET  
vercel env add FACEBOOK_VERIFY_TOKEN
```

### Step 4: Deploy to Vercel (15 min)

```bash
git add .
git commit -m "Add Facebook credentials"
git push origin main

# Wait for deployment
# Copy production URL
```

### Step 5: Configure Webhook (30 min)

```bash
1. In Facebook App > Messenger > Settings > Webhooks
2. Click "Add Callback URL"
3. Callback URL: https://YOUR-DOMAIN.vercel.app/api/webhook/messenger
4. Verify Token: (same as FACEBOOK_VERIFY_TOKEN above)
5. Subscribe to: messages, messaging_postbacks
6. Click "Verify and Save"

✓ Should see "Success"
```

### Step 6: Test Message (15 min)

```bash
1. Go to your Facebook test page
2. Send message: "Hello"
3. Check Vercel logs (vercel logs)
4. Should see webhook payload

If not working:
- Check webhook is verified
- Check token matches
- Check route is deployed
```

---

## 📅 THIS WEEK: Week 1 Plan

### Monday (Day 1) ← TODAY
- [ ] Steps 1-6 above (Facebook setup)
- [ ] Test message receiving
- [ ] Verify database saves messages

### Tuesday (Day 2)
- [ ] Test store connection flow
- [ ] Verify message storage
- [ ] Start AI response generation

### Wednesday (Day 3)
- [ ] Add test products (5 products)
- [ ] Test AI product search
- [ ] Connect AI to Facebook replies

### Thursday (Day 4)
- [ ] Test end-to-end flow
- [ ] Test dashboard chat view
- [ ] Test manual agent replies

### Friday (Day 5)
- [ ] Test order creation from chat
- [ ] Verify orders in database
- [ ] Fix any critical bugs found

---

## 🚨 BLOCKERS TO WATCH FOR

### "Webhook won't verify"
**Symptoms**: Facebook shows error when verifying webhook  
**Fix**: 
1. Check FACEBOOK_VERIFY_TOKEN matches in code and Facebook
2. Ensure webhook route is deployed (check Vercel)
3. Test locally with ngrok first
4. Check logs: `vercel logs --follow`

### "Messages not saving to database"
**Symptoms**: Send message, nothing in Supabase  
**Fix**:
1. Check RLS policies on messages table
2. Verify customer record exists
3. Check conversation record exists
4. Look for errors in Vercel logs

### "AI not responding"
**Symptoms**: Message received, no reply sent  
**Fix**:
1. Check OPENAI_API_KEY is set
2. Test OpenAI connection separately
3. Check AI endpoint: /api/chat/ai
4. Verify intent classification working
5. Check product data exists in database

---

## 💡 QUICK WINS

**If stuck on Facebook:**
- Test locally with ngrok first
- Use Facebook test app (not production)
- Join Facebook Developers group for help

**If stuck on AI:**
- Start with simple responses (no product search)
- Test intent classification separately
- Use Claude API instead of OpenAI temporarily

**If running out of time:**
- Skip nice-to-have features
- Focus ONLY on: receive → AI → reply
- Add features after basics work

---

## 📞 NEED HELP?

**When to ask for help:**
- After 2 hours stuck on same issue
- When error messages are unclear
- When not sure what to debug next

**What to provide:**
- Error messages (full text)
- Vercel logs (last 50 lines)
- What you've tried already
- Screenshots if helpful

**Where to get help:**
- Facebook Developers Community
- Supabase Discord
- Vercel Discord
- Stack Overflow

---

## ✅ END OF DAY 1 SUCCESS

You can stop for today when:

```bash
✓ Facebook app created
✓ Messenger product added
✓ Webhook verified successfully
✓ Test message received in logs
✓ Message saved to database

= READY FOR DAY 2
```

**Tomorrow**: Connect AI responses + start testing

---

## 📖 DETAILED GUIDE

For full step-by-step instructions, see: **PATH-TO-WORKING.md**

That file has:
- 15 detailed steps
- All commands to run
- SQL queries to verify
- Troubleshooting guides
- Success criteria for each step

---

## 🎯 2-WEEK MILESTONE

By end of Week 2:
- Facebook integration working ✓
- AI responding to messages ✓
- Orders created via chat ✓
- Dashboard showing conversations ✓
- All test scenarios passing ✓
- Ready for pilot customers ✓

**Let's get to working state! Start with Day 1 checklist above.** 🚀
