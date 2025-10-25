# TODO for Tomorrow - Audico Call System

## Current Status
- ✅ Fixed critical bug: AI responses were using Twilio TTS instead of ElevenLabs
- ✅ Added all 3 GPT-recommended fixes:
  - Added `greeting_short` to pre-cached phrases
  - Increased timeout from 3s to 8s
  - Added explicit "menu" keyword detection before LLM
- ✅ Fixed text normalization to prevent cache mismatches
- ✅ ElevenLabs API key permissions updated (now has `text_to_speech` permission)
- ✅ Local test confirmed: Audio generates in 961ms ✅
- ✅ Triggered Railway redeploy
- ❌ **PROBLEM**: Call won't connect after redeploy

## Tomorrow's Tasks

### 1. Diagnose Why Calls Won't Connect (Priority: URGENT)

**Check Railway Deployment:**
- Go to: https://railway.com/project/96d1d165-01e9-49d5-86c0-b32e00997010/service/e40e3506-2132-4c59-8c82-c7fe050a9d9e
- Check **Deployments** tab - verify latest deploy succeeded
- Check **Logs** tab for errors:
  - Look for `[Audio] Pre-generating common phrases...`
  - Look for `[Audio] Common phrases pre-generation complete!`
  - Look for any **ERROR** messages
  - Look for ElevenLabs API errors (401, 429, timeout)

**Check Service Health:**
```bash
curl https://audico-call-system-production.up.railway.app/health
```
Should return: `{"status":"healthy"}`

**Verify Twilio Webhook:**
- Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
- Click on your number: +16205291708
- Verify webhook URL is: `https://audico-call-system-production.up.railway.app/voice/incoming`
- Verify it's set to **POST** method

### 2. Test ElevenLabs Voice (After Fix)

Once calls connect again:

**Test 1 - Greeting:**
- Call: +16205291708
- Expected: Hear ElevenLabs voice (NOT Twilio's "Joanna")
- Should say: *"Welcome to Audico. How may I assist you today? You may also say menu to hear our department options."*

**Test 2 - Menu Command:**
- Say: "menu" or "options"
- Expected: Immediate IVR menu with ElevenLabs voice
- Should say: *"Welcome to Audico how may I direct your call - press 1 for sales, 2 for shipping..."*

**Test 3 - AI Conversation:**
- Say: "I need help with sales"
- Expected: AI responds with ElevenLabs voice (Sales department voice: fPVZbr0RJBH9KL47pnxU)
- Continue conversation, verify every response uses ElevenLabs

**Test 4 - Department-Specific Voices:**
- Press 1 (Sales) - should hear voice: fPVZbr0RJBH9KL47pnxU
- Press 2 (Shipping) - should hear voice: YinfoGr2vb39a177NNfl
- Press 3 (Support) - should hear voice: YPtbPhafrxFTDAeaPP4w

### 3. If Still Using Twilio Voice (Fallback Plan)

If ElevenLabs still doesn't work, check Railway logs for:
- `[Audio] Error preparing audio URL`
- `[Audio] Failed to pre-cache`
- ElevenLabs API errors

Possible issues:
- Pre-caching failing on startup (8s timeout too short for all phrases?)
- Network issues between Railway and ElevenLabs API
- ElevenLabs rate limiting

### 4. Quick Fixes to Try

**Option A - Increase Pre-cache Timeout:**
If pre-caching times out, increase timeout in `src/routes/audio.js`:
```javascript
setTimeout(() => reject(new Error('Audio generation timeout (8s)')), 15000) // 15s
```

**Option B - Test Without Pre-caching:**
Comment out pre-cache in `src/routes/audio.js` line 48:
```javascript
// preGenerateCommonPhrases().catch(console.error);
```
This will generate audio on-demand (slower but should work)

**Option C - Check Railway Region:**
Railway server might be far from ElevenLabs API. Check latency:
```bash
# Run this from Railway logs or SSH
curl -w "@curl-format.txt" -o /dev/null -s https://api.elevenlabs.io/v1/voices
```

## Key Files Modified Today

1. **src/routes/audio.js**
   - Added `greeting_short` to COMMON_PHRASES (line 17)
   - Increased timeout from 3s to 8s (line 139)
   - Added text normalization (lines 120-126)

2. **src/routes/voice.js**
   - Added explicit menu keyword detection (lines 93-113)
   - Generate ElevenLabs audio for /process-input responses (lines 149-156)
   - Generate ElevenLabs audio for /conversation responses (lines 337-344)

3. **test-elevenlabs-simple.js**
   - Test script to verify ElevenLabs API key permissions
   - Run: `node test-elevenlabs-simple.js`
   - Should generate `test-greeting.mp3` in under 1 second

## Environment Variables to Verify

Check Railway has these set correctly:
```bash
ELEVENLABS_API_KEY=YOUR_ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID=YOUR_VOICE_ID
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=+16205291708
```

## Root Cause of Original Problem

**Why you never heard ElevenLabs voice:**
- ElevenLabs API key had NO `text_to_speech` permission
- Every audio generation attempt returned `401 Unauthorized`
- System fell back to Twilio TTS every single time
- You were wasting money on international calls hearing Twilio's terrible voice

**What was fixed:**
- Updated API key permissions in ElevenLabs dashboard
- Local test confirmed: 961ms generation time ✅
- Code already correct - just needed valid API key

## Expected Outcome Tomorrow

After fixing connection issue:
- ✅ Calls connect immediately
- ✅ Every voice is ElevenLabs (greeting, menu, AI responses)
- ✅ "Say menu" works instantly
- ✅ Department-specific voices work
- ✅ No more "call back when you're ready" hangups
- ✅ Professional call experience worth the international call cost

## Contact

- Railway URL: https://audico-call-system-production.up.railway.app
- Twilio Number: +16205291708
- GitHub Repo: https://github.com/AudicoSA/audico-call-system
- Last Commit: 3ecc39b (Trigger redeploy after ElevenLabs API key permissions updated)

## Notes

User is calling from South Africa (+27631443274) to US Twilio number (+16205291708), so each test call costs money. Make sure everything works before asking for test calls.
