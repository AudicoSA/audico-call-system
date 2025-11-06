# Update Twilio Webhooks to Railway

## Quick Steps

### 1. Get Your Railway URL
- Go to: https://railway.app/dashboard
- Find: Audico Call System project
- Copy the URL (e.g., `https://audico-call-system.up.railway.app`)

### 2. Update Twilio Webhooks

**Go to Twilio Console:**
https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

**Find your phone number:** +1 620 529 1708

**Update these webhooks:**

#### A Call Comes In:
```
Webhook: https://YOUR-RAILWAY-URL.up.railway.app/voice/incoming
Method: HTTP POST
```

#### Call Status Changes:
```
Webhook: https://YOUR-RAILWAY-URL.up.railway.app/voice/status
Method: HTTP POST
```

### 3. Save Configuration

Click **Save Configuration** at the bottom

### 4. Test!

Call your Twilio number: **+1 620 529 1708**

It should now:
- ✅ Connect to Railway (not Serveo)
- ✅ Work 24/7
- ✅ Never need tunnel updates again!

---

## Verify Railway is Running

Check these:

1. **Railway Dashboard:**
   - Project status should be "Active" or "Running"
   - Should show recent deployments

2. **Test Railway URL directly:**
   Open browser: `https://YOUR-RAILWAY-URL.up.railway.app`
   
   Should see: "Audico Call System API" or similar response

3. **Check Environment Variables in Railway:**
   Make sure these are set:
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_PHONE_NUMBER
   - OPENAI_API_KEY
   - ELEVENLABS_API_KEY
   - ELEVENLABS_VOICE_ID
   - ANTHROPIC_API_KEY
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - NODE_ENV=production
   - PORT (Railway sets this automatically)

---

## Troubleshooting

### If Railway URL doesn't respond:

1. **Check Railway logs:**
   - In Railway dashboard → Your project → Deployments → View Logs
   - Look for errors

2. **Check if service is running:**
   - Railway dashboard should show "Active"
   - If not, click "Redeploy"

3. **Verify environment variables:**
   - Railway dashboard → Variables tab
   - Make sure all API keys are set

### If Twilio still hits Serveo:

- You forgot to update webhooks!
- Go back to Twilio console and verify the URLs

---

## Once Updated - You're Done! ✅

**What changes:**
- ❌ No more Serveo tunnel
- ❌ No more `npm start` on your computer
- ❌ No more URL changes
- ✅ Works 24/7 automatically
- ✅ Permanent Railway URL
- ✅ Update Twilio webhooks ONCE only

**Your computer can be OFF and calls still work!** 🎉

---

## Need Help?

If you need help finding your Railway URL or updating webhooks, just ask!

