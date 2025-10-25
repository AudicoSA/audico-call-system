# Quick Start Checklist

Follow these steps to get your AI call system with product knowledge up and running!

## ✅ Status Check

- [x] OpenAI API Key configured (for Whisper + Embeddings)
- [x] Anthropic API Key configured (for Claude)
- [x] Supabase URL configured
- [x] Supabase Service Role Key configured
- [x] ElevenLabs API Key configured
- [ ] ElevenLabs Voice ID configured
- [ ] Twilio Account SID configured
- [ ] Twilio Auth Token configured
- [ ] Twilio Phone Number configured

## 🎯 Setup Steps

### Step 1: Complete .env Configuration

Edit `.env` and add the missing values:

```env
# These you still need to add:
ELEVENLABS_VOICE_ID=your_south_african_voice_id  # Get from ElevenLabs Voice Library
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx        # From Twilio Console
TWILIO_AUTH_TOKEN=your_auth_token                # From Twilio Console
TWILIO_PHONE_NUMBER=+27123456789                 # Your SA phone number
```

**Get ElevenLabs Voice ID:**
1. Go to https://elevenlabs.io/app/voice-library
2. Search for "South African" accent
3. Select a professional voice
4. Copy the Voice ID

**Get Twilio Credentials:**
1. Go to https://console.twilio.com/
2. Find Account SID and Auth Token on dashboard
3. Buy a South African phone number (+27)

---

### Step 2: Install Dependencies

```bash
npm install
```

This will install the new `@supabase/supabase-js` package.

---

### Step 3: Run Supabase SQL Setup

**Two options:**

**Option A: Run the complete SQL file (EASIEST)**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase-setup.sql` (in this folder)
5. Copy the **entire file** and paste into SQL Editor
6. Click **Run** button
7. Verify you see "5 rows" returned at the bottom

**Option B: Run step by step**

Follow the SQL commands in `SUPABASE_SETUP.md` sections:
- Step 2: Create products table
- Step 3: Enable vector extension
- Step 4: Create vector search function
- Step 5: Set up RLS policies
- Step 6: Insert sample products

---

### Step 4: Generate Product Embeddings

This creates vector embeddings for semantic search:

```bash
node scripts/generate-embeddings.js
```

**Expected output:**
```
🔄 Product Embedding Generator
====================================

📥 Fetching products from Supabase...
✅ Found 5 products

Processing: Sony 55" 4K Smart TV... ✅
Processing: Samsung 65" QLED TV... ✅
Processing: Apple iPhone 15 Pro... ✅
Processing: Dell XPS 13 Laptop... ✅
Processing: Sony WH-1000XM5 Headphones... ✅

====================================
📊 Summary:
   ✅ Generated: 5
   ⏭️  Skipped:   0
   ❌ Errors:    0
====================================

🎉 Embeddings generated successfully!
💡 Your AI agent can now perform semantic product search
```

---

### Step 5: Test Your Services

```bash
node scripts/test-services.js
```

This will test:
- Configuration validity
- ElevenLabs TTS (generates test audio)
- Claude LLM (generates test response)
- Product search (if embeddings are ready)

---

### Step 6: Start the Server

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
    - TTS: ElevenLabs (Voice ID: xxx...)
    - LLM: claude-3-5-sonnet-20241022

  Ready to accept calls!
================================================
```

---

### Step 7: Expose with Ngrok (for testing)

In a new terminal:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

---

### Step 8: Configure Twilio Webhooks

1. Go to https://console.twilio.com/
2. Navigate to: Phone Numbers → Manage → Active Numbers
3. Click your South African phone number
4. Under **Voice Configuration**:
   - **A call comes in**:
     - Webhook: `https://your-ngrok-url.ngrok.io/voice/incoming`
     - HTTP POST
   - **Call status changes**:
     - Webhook: `https://your-ngrok-url.ngrok.io/voice/status`
     - HTTP POST
5. Click **Save**

---

### Step 9: Test Your First Call! 🎉

1. Call your Twilio phone number from your mobile
2. Listen for:
   - ✅ Consent message (POPIA compliance)
   - ✅ Greeting in South African voice
3. Try saying:
   - "Tell me about your Sony TV"
   - "Do you have the iPhone 15?"
   - "What headphones are available?"
4. AI should respond with accurate product info from Supabase!

---

## 🐛 Troubleshooting

### "Missing required environment variables"
- Check all keys are in `.env` file
- No quotes needed around values
- No spaces around `=`

### "No products found"
- Run SQL setup first: `supabase-setup.sql`
- Check Supabase dashboard → Table Editor → products
- Should see 5 sample products

### "Semantic search not working"
- Run: `node scripts/generate-embeddings.js`
- Check product_embeddings table has data
- Verify pgvector extension is enabled

### "No audio on calls"
- Verify ElevenLabs Voice ID is correct
- Check Twilio webhooks are configured
- Ensure ngrok is running

### "AI not finding products"
- Check embeddings were generated
- Review server logs for errors
- Test direct search: See `scripts/test-product-search.js`

---

## 📊 Quick Test Commands

```bash
# Test all services
node scripts/test-services.js

# Generate embeddings
node scripts/generate-embeddings.js

# Start server
npm start

# Start ngrok (separate terminal)
ngrok http 3000

# Check health
curl http://localhost:3000/health

# View analytics
# Open: http://localhost:3000/analytics/dashboard
```

---

## 🎯 Example Product Questions to Test

Once your system is running, call and ask:

1. **"Tell me about your Sony TV"**
   - Should return: Sony 55" 4K Smart TV with price and stock

2. **"Do you have a 65-inch television?"**
   - Should return: Samsung 65" QLED TV

3. **"What's the latest iPhone?"**
   - Should return: Apple iPhone 15 Pro

4. **"Show me noise cancelling headphones"**
   - Should return: Sony WH-1000XM5

5. **"What laptops do you have?"**
   - Should return: Dell XPS 13 Laptop

---

## 📚 Documentation

- **SETUP.md** - Detailed setup guide
- **SUPABASE_SETUP.md** - Complete Supabase instructions
- **SUPABASE_INTEGRATION.md** - How RAG works
- **ARCHITECTURE.md** - System architecture
- **PROJECT_SUMMARY.md** - Feature overview

---

## ✅ You're Ready When...

- [x] All services pass `test-services.js`
- [x] Embeddings generated successfully
- [x] Server starts without errors
- [x] Ngrok provides HTTPS URL
- [x] Twilio webhooks configured
- [x] Test call works with product questions

---

**Need help?** Check the troubleshooting guides in the documentation files above!

Good luck! 🚀
