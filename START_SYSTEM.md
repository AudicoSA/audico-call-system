# 🚀 Start Your AI Call System - Step by Step

## Prerequisites ✅
- [x] Supabase SQL setup completed
- [x] Embeddings generated
- [x] All API keys configured in `.env`

---

## Step 1: Start the Server

Open a terminal in your project folder and run:

```bash
npm start
```

**Expected output:**
```
================================================
  Audico Call System - AI Voice Agent
================================================
  Environment: development
  Server running on port: 3000
  URL: http://localhost:3000

  Services:
    - STT: OpenAI Whisper
    - TTS: ElevenLabs (Voice ID: xeBpkkuzgxa0IwKt7NTP)
    - LLM: claude-3-5-sonnet-20241022

  Twilio Configuration:
    - Phone Number: +16205291708

  POPIA Compliance:
    - Call Recording: Enabled

  Ready to accept calls!
================================================
```

✅ **Server is running!** Keep this terminal window open.

---

## Step 2: Start Ngrok (New Terminal)

**Open a NEW terminal window** and run:

```bash
ngrok http 3000
```

**Expected output:**
```
Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000
```

📋 **Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

⚠️ **Important**: Keep this terminal window open too!

---

## Step 3: Configure Twilio Webhooks

### Option A: Quick Setup (Copy & Paste)

Replace `YOUR_NGROK_URL` with your ngrok URL in the commands below:

```bash
# Example: https://abc123.ngrok-free.app (NO trailing slash!)

# Set Voice URL
curl -X POST https://api.twilio.com/2010-04-01/Accounts/YOUR_TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json ^
  --data-urlencode "VoiceUrl=https://YOUR_NGROK_URL/voice/incoming" ^
  --data-urlencode "VoiceMethod=POST" ^
  --data-urlencode "StatusCallback=https://YOUR_NGROK_URL/voice/status" ^
  --data-urlencode "StatusCallbackMethod=POST" ^
  -u "YOUR_TWILIO_ACCOUNT_SID:YOUR_TWILIO_AUTH_TOKEN"
```

### Option B: Manual Setup (Web Interface)

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on your phone number: **+1 620 529 1708**
3. Scroll to **Voice Configuration** section
4. Set these values:

   **A call comes in:**
   - Dropdown: `Webhook`
   - URL: `https://YOUR_NGROK_URL/voice/incoming`
   - HTTP Method: `POST`

   **Status Callback URL:**
   - URL: `https://YOUR_NGROK_URL/voice/status`
   - HTTP Method: `POST`

5. Click **Save** at the bottom

✅ **Webhooks configured!**

---

## Step 4: Test Your System! 🎉

### Make a Test Call

**Call your Twilio number from your phone:**

📞 **+1 620 529 1708**

### What Should Happen:

1. **📞 Call connects**

2. **🔊 You hear (in South African accent):**
   > "This call will be recorded for quality and training purposes."
   > "Welcome to Audico. How may I assist you today?"

3. **💬 You say something like:**
   - "Tell me about your Sony TV"
   - "Do you have the iPhone 15?"
   - "What headphones are available?"

4. **🤖 AI responds (in SA voice):**
   > "Ja, we have the Sony 55-inch 4K Smart TV available for R12,999. It's a lekker TV with 4K Ultra HD, HDR support, and built-in Android TV. We have 15 units in stock. Would you like to know more about it?"

---

## 🎯 Test Queries

Try these questions when you call:

### Product Questions (will search Supabase)
- "Tell me about your Sony TV"
- "Do you have a 65-inch television?"
- "What's the latest iPhone?"
- "Show me noise cancelling headphones"
- "Is the Dell laptop in stock?"

### IVR Menu (if you don't speak)
- Just wait without speaking
- You'll hear: "Press 1 for Sales, 2 for Shipping..."

---

## 📊 Monitor Your System

While testing, open these in your browser:

- **Health Check**: http://localhost:3000/health
- **Analytics Dashboard**: http://localhost:3000/analytics/dashboard
- **Call Logs**: http://localhost:3000/analytics/calls
- **Ngrok Inspector**: http://127.0.0.1:4040

---

## 🔍 Check Terminal Logs

**In your server terminal**, you should see logs like:

```
[Voice] Incoming call: { callSid: 'CA...', from: '+270799041903', to: '+16205291708' }
[IVR] Call initialized: CA...
[LLM] Generating response for: Tell me about your Sony TV
[LLM] Executing product tool: get_product_info { query: 'Sony TV', search_type: 'semantic' }
[Product] Semantic search: Sony TV
[Product] Found 1 products via semantic search
[LLM] Response generated: Ja, we have the Sony 55-inch 4K Smart TV...
```

---

## ✅ Success Checklist

After your test call:

- [ ] Call connected successfully
- [ ] Heard consent message
- [ ] Heard greeting in South African voice
- [ ] AI understood your question
- [ ] AI found product in database
- [ ] AI responded with accurate information
- [ ] Voice sounded natural (ElevenLabs)

---

## 🐛 Troubleshooting

### Call doesn't connect
- Check both terminals are running (server + ngrok)
- Verify Twilio webhooks have correct ngrok URL
- Check ngrok URL has no trailing slash

### No audio / robotic voice
- ElevenLabs Voice ID is configured ✅
- May fallback to Polly if ElevenLabs fails
- Check server logs for TTS errors

### AI doesn't find products
- Verify embeddings were generated
- Check Supabase has 5 products
- Review server logs for database errors

### Webhook timeout errors
- Server might be slow to respond
- Check server logs for errors
- Ensure Supabase connection is working

---

## 🔄 Restart Process

If you need to restart:

1. **Stop everything**: Ctrl+C in both terminals
2. **Start server**: `npm start`
3. **Start ngrok**: `ngrok http 3000`
4. **Update Twilio**: New ngrok URL (it changes each restart!)
5. **Test call again**

---

## 📸 See It in Action

Your call flow:

```
📞 You call +1 620 529 1708
    ↓
🌐 Twilio receives call
    ↓
🔗 Twilio → Ngrok → Your Server (localhost:3000)
    ↓
🎤 Whisper transcribes your speech
    ↓
🤖 Claude processes with product knowledge (Supabase)
    ↓
🗣️ ElevenLabs generates South African voice
    ↓
🌐 Response → Twilio → Your Phone
    ↓
✨ You hear AI agent with product info!
```

---

## 🎉 What You've Built

A complete AI call center with:
- ✅ South African voice (ElevenLabs)
- ✅ Product knowledge (Supabase + RAG)
- ✅ Semantic search (understands meaning)
- ✅ Real-time conversation (Claude)
- ✅ POPIA compliance (consent messages)
- ✅ Analytics tracking

---

## 📞 Ready?

**Open 2 terminals:**

Terminal 1:
```bash
npm start
```

Terminal 2:
```bash
ngrok http 3000
```

**Then configure Twilio and call:** `+1 620 529 1708` 🎉

---

**Need help?** Check the logs in your terminal for errors!
