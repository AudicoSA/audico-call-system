# Debugging Call Flow Issues

## Current Problems

1. **Twilio TTS voice still being used** instead of ElevenLabs
2. **"Say menu" does nothing** - not triggering IVR menu

## System Architecture

### Call Flow

```
1. Customer calls +1 620 529 1708
   ↓
2. Twilio receives call
   ↓
3. Twilio POSTs to: https://audico-call-system-production.up.railway.app/voice/incoming
   ↓
4. Server responds with TwiML (XML)
   ↓
5. TwiML contains:
   - <Say> tags (Twilio TTS) OR
   - <Play> tags (ElevenLabs audio URLs)
   ↓
6. <Gather> tag listens for speech
   ↓
7. When customer speaks, Twilio POSTs to: /voice/process-input
   ↓
8. Server analyzes speech and responds
```

## Key Files

### 1. **src/routes/voice.js** - Main call handling
- `POST /voice/incoming` - Initial greeting
- `POST /voice/process-input` - Handles customer speech
- `POST /voice/ivr-menu` - Shows menu
- `POST /voice/ivr-selection` - Processes menu selection

### 2. **src/routes/audio.js** - ElevenLabs audio generation
- Pre-caches common phrases on startup
- Serves audio files via `/audio/:callSid/:filename`
- Falls back to Twilio TTS if generation fails

### 3. **src/services/tts.js** - ElevenLabs TTS service
- Uses `eleven_turbo_v2_5` model
- Generates speech from text
- Optimized for low latency

### 4. **src/services/ivr.js** - Call routing logic
- `analyzeIntent()` - Detects if customer wants menu
- `processMenuSelection()` - Handles DTMF/speech selection
- `canAIHandle()` - Decides AI vs human routing

### 5. **src/services/telephony.js** - TwiML generation
- `createGreetingResponse()` - Twilio TTS greeting
- `createGreetingResponseWithAudio()` - ElevenLabs greeting
- `createIVRMenu()` - Twilio TTS menu
- `createIVRMenuWithAudio()` - ElevenLabs menu

## Why ElevenLabs Might Not Work

### Issue 1: Audio Pre-generation Failing

**Check Railway logs for:**
```
[Audio] Pre-generating common phrases...
[Audio] Pre-cached: greeting
[Audio] Pre-cached: menu
[Audio] Common phrases pre-generation complete!
```

**If you DON'T see these logs:**
- ElevenLabs API key is missing/invalid
- API call is failing
- Server restarted before pre-generation completed

**Solution:**
- Check environment variable: `ELEVENLABS_API_KEY`
- Check environment variable: `ELEVENLABS_VOICE_ID`

### Issue 2: Audio URL Generation Timing Out

**Check Railway logs for:**
```
[Audio] Preparing audio URL for: ...
[Audio] Error preparing audio URL: Audio generation timeout (3s)
```

**If timeout errors:**
- ElevenLabs API is slow
- Network latency to ElevenLabs
- Model generation taking > 3 seconds

**Solution:**
- Increase timeout in `src/routes/audio.js` line 138
- Use Twilio TTS until we optimize further

### Issue 3: Audio Cache Not Being Used

**Check Railway logs for:**
```
[Audio] Using pre-cached phrase: greeting
[Audio] Using pre-cached phrase: menu
```

**If you DON'T see these:**
- Text doesn't match exactly (check for extra spaces)
- Cache was cleared (server restart)
- Pre-generation didn't complete

## Why "Say Menu" Does Nothing

### Issue 1: Speech Recognition Not Triggering

**In `src/routes/voice.js` line 75-90:**
```javascript
const speechResult = req.body.SpeechResult;

if (!speechResult) {
  // No speech detected
}
```

**Check Railway logs for:**
```
[Voice] Processing input: { callSid: '...', speechResult: 'menu' }
```

**If speechResult is empty:**
- Twilio's speech recognition didn't hear anything
- Timeout occurred (5 seconds)
- Background noise prevented recognition

### Issue 2: Intent Analysis Not Detecting "Menu"

**In `src/services/ivr.js` line 216-248:**
```javascript
async analyzeIntent(callSid, speechInput) {
  const lowerInput = speechInput.toLowerCase();

  // Check for menu keywords
  if (lowerInput.includes('menu') || lowerInput.includes('options')) {
    return { wantsMenu: true };
  }
}
```

**Check Railway logs for:**
```
[Voice] Intent analysis: { wantsMenu: true }
```

**If wantsMenu is false:**
- The word "menu" wasn't in the speech result
- Speech recognition transcribed it wrong (e.g., "manual", "many")

### Issue 3: TwiML Not Redirecting to Menu

**In `src/routes/voice.js` line 79-85:**
```javascript
if (intentAnalysis.wantsMenu) {
  const twiml = telephonyService.createIVRMenuResponse(baseUrl);
  return res.type('text/xml').send(twiml);
}
```

**Check Railway logs for:**
```
[Voice] Routing to IVR menu
```

## Current Configuration

### Environment Variables (Railway)
```bash
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=+16205291708

OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=YOUR_ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID=YOUR_ELEVENLABS_VOICE_ID
ANTHROPIC_API_KEY=sk-ant-api03-...

SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### Twilio Webhooks
```
Voice URL: https://audico-call-system-production.up.railway.app/voice/incoming
Status Callback: https://audico-call-system-production.up.railway.app/voice/status
```

## Debugging Steps

### 1. Check Railway Logs

Go to: https://railway.app/project/96d1d165-01e9-49d5-86c0-b32e00997010/service/e40e3506-2132-4c59-8c82-c7fe050a9d9e

**Look for:**
- `[Audio] Pre-generating common phrases...` - Is pre-caching working?
- `[Voice] Incoming call:` - Is the call reaching the server?
- `[Voice] Processing input:` - What did Twilio transcribe?
- `[Voice] Intent analysis:` - Did it detect "menu"?
- `[Audio] Error preparing audio URL:` - Is ElevenLabs failing?

### 2. Test TwiML Response Directly

```bash
curl -X POST https://audico-call-system-production.up.railway.app/voice/incoming \
  -d "CallSid=TEST123" \
  -d "From=+27123456789" \
  -d "To=+16205291708"
```

**Expected output:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://audico-call-system-production.up.railway.app/audio/TEST123/greeting.mp3</Play>
  <Gather input="speech" ...>
  </Gather>
</Response>
```

**If you see `<Say>` instead of `<Play>`:**
- ElevenLabs audio generation failed
- Falling back to Twilio TTS

### 3. Test Audio Endpoint

```bash
curl -I https://audico-call-system-production.up.railway.app/audio/common/greeting
```

**Expected:**
```
HTTP/1.1 404 Not Found  (if pre-caching failed)
HTTP/1.1 200 OK         (if pre-caching worked)
```

### 4. Test Speech Input Processing

```bash
curl -X POST https://audico-call-system-production.up.railway.app/voice/process-input \
  -d "CallSid=TEST123" \
  -d "SpeechResult=menu"
```

**Expected:** Should return TwiML with IVR menu

## Quick Fixes

### Fix 1: Force Twilio TTS (Temporary)

**In `src/routes/voice.js` line 42-60:**

Change:
```javascript
const audioUrl = await prepareAudioUrl(...);

if (audioUrl) {
  const twiml = telephonyService.createGreetingResponseWithAudio(baseUrl, audioUrl);
  return res.send(twiml);
}
```

To:
```javascript
// Temporarily disable ElevenLabs
const audioUrl = null; // Force Twilio TTS

if (audioUrl) {
  const twiml = telephonyService.createGreetingResponseWithAudio(baseUrl, audioUrl);
  return res.send(twiml);
}
```

### Fix 2: Add More Logging

**In `src/routes/voice.js` line 76:**

Add:
```javascript
console.log('[Voice] Speech result:', speechResult);
console.log('[Voice] Speech result type:', typeof speechResult);
console.log('[Voice] Speech result length:', speechResult?.length);
```

### Fix 3: Make "Menu" Detection More Lenient

**In `src/services/ivr.js` line 216:**

Change:
```javascript
if (lowerInput.includes('menu') || lowerInput.includes('options')) {
  return { wantsMenu: true };
}
```

To:
```javascript
// More lenient detection
const menuKeywords = ['menu', 'options', 'choice', 'select', 'man', 'many'];
if (menuKeywords.some(kw => lowerInput.includes(kw))) {
  console.log('[IVR] Menu keyword detected:', lowerInput);
  return { wantsMenu: true };
}
```

## Recommended Action

1. **Check Railway logs** - See what's actually happening
2. **Test with curl** - Verify TwiML responses
3. **Temporarily disable ElevenLabs** - Get basic flow working first
4. **Add more logging** - Understand why "menu" isn't triggering
5. **Fix the speech recognition issue** before worrying about voice quality

## Contact Points

- **Railway Dashboard**: https://railway.app/project/96d1d165-01e9-49d5-86c0-b32e00997010
- **GitHub Repo**: https://github.com/AudicoSA/audico-call-system
- **Twilio Console**: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
- **Railway Logs**: Click "Deployments" tab → Latest deployment → View logs
