# Railway.app Deployment Guide

## Why Railway.app?

Railway.app is **perfect** for the Audico Call Center system because:

✅ **No timeout limits** - Calls can last as long as needed
✅ **Persistent memory** - Conversation state maintained across webhooks
✅ **No cold starts** - Instant response for every call
✅ **Automatic HTTPS** - Built-in SSL certificate
✅ **Simple deployment** - Connect GitHub and deploy
✅ **Free trial** - $5 credit to start, then ~$5-10/month

---

## Step-by-Step Deployment (5 Minutes)

### 1. Sign Up for Railway

1. Go to: https://railway.app
2. Click **"Start a New Project"**
3. Sign in with GitHub

### 2. Deploy from GitHub

1. Click **"Deploy from GitHub repo"**
2. Select your repository: **`AudicoSA/audico-call-system`**
3. Click **"Deploy Now"**

Railway will automatically:
- Detect it's a Node.js project
- Run `npm install`
- Start with `npm start`

### 3. Add Environment Variables

⚠️ **IMPORTANT**: Add your environment variables before the app starts

1. In your Railway project, click on your service
2. Go to **"Variables"** tab
3. Click **"+ New Variable"**
4. Add each variable (one at a time):

```bash
# Required Variables
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

OPENAI_API_KEY=sk-proj-your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=xeBpkkuzgxa0IwKt7NTP
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key

SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Optional - Department Specific Voices
ELEVENLABS_VOICE_SALES=fPVZbr0RJBH9KL47pnxU
ELEVENLABS_VOICE_SHIPPING=YinfoGr2vb39a177NNfl
ELEVENLABS_VOICE_SUPPORT=YPtbPhafrxFTDAeaPP4w

# Optional - Human Agent Numbers
AGENT_SALES_NUMBER=+27821234567
AGENT_SHIPPING_NUMBER=+27821234568
AGENT_SUPPORT_NUMBER=+27821234569
AGENT_ACCOUNTS_NUMBER=+27821234570
AGENT_OPERATOR_NUMBER=+27821234571

# Server Config
PORT=3000
NODE_ENV=production
ENABLE_CALL_RECORDING=true
```

5. Click **"Deploy"** (Railway will restart with your environment variables)

### 4. Get Your Public URL

1. In your Railway project, go to **"Settings"** tab
2. Scroll to **"Domains"**
3. Click **"Generate Domain"**
4. You'll get a URL like: `https://audico-call-system-production.up.railway.app`

✅ **This is your permanent HTTPS URL!** (No need for ngrok/serveo anymore!)

### 5. Configure Twilio Webhooks

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your phone number
3. Scroll to **"Voice Configuration"**
4. Set **"A Call Comes In"**:
   - Webhook: `https://audico-call-system-production.up.railway.app/voice/incoming`
   - HTTP POST
5. Set **"Call Status Changes"**:
   - Webhook: `https://audico-call-system-production.up.railway.app/voice/status`
   - HTTP POST
6. Click **"Save Configuration"**

---

## Testing Your Deployment

### 1. Check Health Endpoint

Visit: `https://your-railway-url.up.railway.app/health`

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-25T...",
  "uptime": 123.456,
  "environment": "production"
}
```

### 2. Test API Info

Visit: `https://your-railway-url.up.railway.app/`

You should see:
```json
{
  "name": "Audico Call System",
  "version": "1.0.0",
  "description": "AI-powered call center agent with South African voice",
  "endpoints": {
    "voice": "/voice/*",
    "analytics": "/analytics/*",
    "health": "/health"
  }
}
```

### 3. Make a Test Call

Call your Twilio number: **+1 620 529 1708** (or your local SA number)

Expected flow:
1. "This call will be recorded for quality and training purposes."
2. "Welcome to Audico. How may I assist you today? You may also say menu to hear our department options."
3. Try saying: "I need help with shipping" or "Show me the menu"

---

## Monitoring & Logs

### View Logs in Real-Time

1. In Railway dashboard, click your service
2. Go to **"Deployments"** tab
3. Click on the latest deployment
4. You'll see live logs from your app

### What to Look For

✅ Good logs:
```
[Server] Configuration validated successfully
================================================
  Audico Call System - AI Voice Agent
================================================
  Server running on port: 3000
  Ready to accept calls!
```

❌ Bad logs (configuration errors):
```
[Server] Configuration error: Missing required environment variable: TWILIO_ACCOUNT_SID
```

If you see errors, go back to **Variables** tab and add the missing variables.

---

## Cost Estimate

Railway pricing is simple and transparent:

- **Free Trial**: $5 credit (enough for ~1 week of testing)
- **After Trial**: Pay as you go
  - ~$5-10/month for a small call center
  - ~$20-30/month for moderate usage
  - Scales automatically based on usage

### What You Pay For:
- **CPU time** (when processing calls)
- **RAM usage** (~512MB for this app)
- **Network egress** (data transfer)

No per-request charges like other platforms!

---

## Advantages Over Vercel

| Feature | Railway | Vercel | Winner |
|---------|---------|--------|--------|
| Timeout | ∞ Unlimited | 60s max | 🏆 Railway |
| Persistent state | ✅ Yes | ❌ No | 🏆 Railway |
| Cold starts | ✅ None | ❌ Yes | 🏆 Railway |
| Real-time webhooks | ✅ Perfect | ⚠️ Limited | 🏆 Railway |
| Price for this app | ~$5-10/mo | ~$20/mo | 🏆 Railway |
| Setup complexity | ⭐ Easy | ⭐⭐⭐ Complex | 🏆 Railway |

---

## Updating Your Deployment

Every time you push to GitHub, Railway will automatically:
1. Pull the latest code
2. Run `npm install`
3. Restart the server
4. Zero-downtime deployment

To manually trigger a deployment:
1. Go to Railway dashboard
2. Click **"Deploy"** button

---

## Environment-Specific Settings

### Development (Local)
```bash
NODE_ENV=development
PORT=3000
```

### Production (Railway)
```bash
NODE_ENV=production
PORT=3000  # Railway will use this port internally
```

Railway automatically provides `PORT` environment variable, but our app uses 3000 by default.

---

## Troubleshooting

### Problem: "Configuration error: Missing required environment variable"

**Solution**: Add the missing variable in Railway dashboard:
1. Go to **Variables** tab
2. Add the variable
3. Railway will auto-redeploy

### Problem: "Cannot connect to Railway URL"

**Solution**: Check deployment status:
1. Go to **Deployments** tab
2. Make sure latest deployment shows "Success"
3. Check logs for errors

### Problem: Twilio webhook returns 500 error

**Solution**: Check Railway logs:
1. Go to **Deployments** tab
2. View logs
3. Look for error messages
4. Common issues:
   - Missing API keys
   - Supabase connection error
   - Claude API rate limit

### Problem: "Out of memory" error

**Solution**: Increase RAM:
1. Go to **Settings** tab
2. Scroll to **"Resources"**
3. Increase memory allocation (default 512MB should be enough)

---

## Security Best Practices

✅ **Do's:**
- Keep environment variables in Railway dashboard (never in code)
- Use HTTPS URLs only (Railway provides this automatically)
- Enable call recording consent
- Monitor logs for suspicious activity

❌ **Don'ts:**
- Don't commit `.env` file to GitHub (already in `.gitignore`)
- Don't share your Railway dashboard access
- Don't hardcode API keys in code

---

## Scaling Your Call Center

As your call center grows, Railway scales automatically:

**Small (0-100 calls/day)**
- Current setup is perfect
- ~$5-10/month

**Medium (100-500 calls/day)**
- No code changes needed
- Railway scales automatically
- ~$20-40/month

**Large (500+ calls/day)**
- Consider adding Redis for call state (optional)
- Increase Railway resources
- ~$50-100/month

---

## Support & Resources

- **Railway Docs**: https://docs.railway.app
- **Railway Community**: https://discord.gg/railway
- **Audico System Docs**: See `CLAUDE.md` in this repo
- **GitHub Issues**: https://github.com/AudicoSA/audico-call-system/issues

---

## Quick Reference Commands

### View Logs
```bash
# Install Railway CLI (optional)
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs
```

### Restart Service
```bash
railway restart
```

### Check Status
```bash
railway status
```

---

## Next Steps After Deployment

1. ✅ **Test the system** - Make a few test calls
2. ✅ **Add products to Supabase** - Populate `call_center_products` table
3. ✅ **Generate embeddings** - Run `node scripts/generate-embeddings.js` locally, then push to Supabase
4. ✅ **Configure agent numbers** - Update `AGENT_*_NUMBER` variables for HITL transfers
5. ✅ **Monitor logs** - Watch for errors and optimize

---

**You're ready to go!** 🚀

Your AI call center is now running 24/7 with automatic HTTPS, no timeouts, and persistent state.
