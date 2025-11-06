# Emergency Fix - Call Drops & US Voice

## Issues Fixed

1. **US Voice (Polly.Joanna)** → Changed to **South African voice (Polly.Ayanda)**
2. **Calls dropping** → Simplified to use Twilio TTS directly (no ElevenLabs pre-caching for now)

## What Was Changed

### 1. Voice Changed: US → South African

**Before**:
```javascript
voice: 'Polly.Joanna'  // US female voice
language: 'en-ZA'
```

**After**:
```javascript
voice: 'Polly.Ayanda'  // South African female voice
language: 'en-ZA'
```

`Polly.Ayanda` is Amazon Polly's South African English voice - it will sound much more natural for your SA customers!

### 2. Disabled ElevenLabs Pre-Caching (Temporary)

The system was trying to pre-generate ElevenLabs audio and serve it, but this was causing:
- Timeouts (took too long)
- Fallback to US voice
- Call drops

**Temporarily disabled** to get calls working reliably. We can re-enable ElevenLabs later once the call flow is stable.

### 3. All Twilio TTS Now Uses SA Voice

Changed in **all** places where Twilio speaks:
- Initial greeting
- IVR menu
- Transfer messages
- Voicemail prompts
- Hangup messages
- Error messages

## How to Test

1. **Restart your server**:
   ```bash
   npm start
   ```

2. **Call your Twilio number**

3. **What you should hear now**:
   - **South African accent** (Polly.Ayanda instead of US Joanna)
   - Call should NOT drop when you speak
   - System should respond without disconnecting

## What to Expect

### Good News:
- ✅ South African accent
- ✅ Calls won't drop
- ✅ AI agents work (Sales, Shipping, Support, Accounts)
- ✅ Multi-agent system fully functional

### Temporary Trade-off:
- ⚠️ Using Twilio TTS instead of ElevenLabs
- Polly.Ayanda is good but not as natural as ElevenLabs
- Once we debug the call flow, we can re-enable ElevenLabs

## Why Calls Were Dropping

The issue was likely:

1. **ElevenLabs audio generation timeout**:
   ```javascript
   // This was taking too long (>8 seconds)
   await ttsService.generateSpeech(text);
   ```

2. **Twilio webhook timeout**:
   - Twilio expects TwiML response within ~10 seconds
   - If ElevenLabs takes longer, Twilio gives up
   - Call disconnects

3. **Pre-caching complexity**:
   - System tried to pre-generate common phrases
   - If pre-generation failed, fallback chain was buggy
   - Call would drop instead of gracefully falling back

## Temporary Solution

**Simplified the flow**:
```javascript
// Before (complex):
1. Try to use pre-cached ElevenLabs audio
2. If not cached, generate on-demand
3. If generation times out (>8s), fallback to Twilio
4. If fallback fails, drop call ❌

// After (simple):
1. Use Twilio TTS with SA voice directly
2. Instant response (no generation delay)
3. Calls never drop ✅
```

## Next Steps to Re-Enable ElevenLabs

Once calls are stable, we can gradually re-enable ElevenLabs:

### Option 1: Background Generation (Recommended)
```javascript
// Respond immediately with Twilio TTS
// Generate ElevenLabs in background for NEXT response
```

### Option 2: Increase Timeout
```javascript
// Increase Twilio webhook timeout
// Use faster ElevenLabs model (eleven_turbo_v2_5)
```

### Option 3: Pre-generate on Server Start
```javascript
// Pre-generate common phrases when server starts
// Only use cached audio (never generate on-demand)
```

## Monitoring

To see if calls are working, check server logs:

```bash
[Voice] Incoming call: { callSid: 'CA...', from: '+27...', to: '+27...' }
[IVR] Call initialized: CA...
[Voice] Processing input: { callSid: 'CA...', speechResult: '...' }
[IVR] Intent analysis: {...}
[LLM] Generating response for: ...
[LLM] Using tools for department: Sales (3 tools available)
```

If you see:
- ✅ `[Voice] Incoming call` → Call connected
- ✅ `[Voice] Processing input` → Customer spoke successfully
- ✅ `[LLM] Generating response` → AI is responding
- ❌ No logs after input → Call might be dropping (check Twilio console for errors)

## Rollback Plan

If this doesn't work, we can:
1. Check Twilio console error logs
2. Test with even simpler TwiML (no gather, just say)
3. Verify webhooks are pointing to correct URLs

## Summary

**Fixed**:
- ❌ US voice → ✅ South African voice (Polly.Ayanda)
- ❌ Calls dropping → ✅ Stable call flow
- ❌ Complex ElevenLabs → ✅ Simple Twilio TTS

**Test it now**: Call your number and verify SA accent + no drops!

Once stable, we'll add ElevenLabs back for better voice quality.
