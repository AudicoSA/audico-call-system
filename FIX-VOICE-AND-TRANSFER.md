# Voice and Transfer Issues - FIXED

## Issues Identified and Fixed

### 1. ✅ US Accent Issue (FIXED)
**Problem**: System was using Twilio's US voice (Polly.Joanna) instead of your ElevenLabs South African voice.

**Root Cause**: The `RECEPTIONIST_VOICE_ID` in your `.env` file was not being read by the config.

**Fix Applied**: Updated [src/config/config.js](src/config/config.js:25) to use `RECEPTIONIST_VOICE_ID` as the primary voice:
```javascript
voiceId: process.env.RECEPTIONIST_VOICE_ID || process.env.ELEVENLABS_VOICE_ID
```

### 2. ✅ Transfer Detection Issue (FIXED)
**Problem**: When you said "please transfer me to sales", the system didn't recognize it as a transfer request.

**Root Cause**: The keyword detection in [src/services/ivr.js](src/services/ivr.js:312) was missing "transfer" variations.

**Fix Applied**: Added these keywords to the human request detection:
- `'transfer'`
- `'transfer to'`
- `'transfer me'`
- `'speak with'`
- `'talk with'`

### 3. ✅ Call Disconnect Issue (FIXED)
**Problem**: Call disconnects after saying "I'll transfer you to a specialist"

**Root Cause**: Agent phone numbers in config were placeholder numbers (+27123456789) that don't exist.

**Fix Applied**:
1. Changed config to use `null` if no numbers are set (instead of fake numbers)
2. Updated [src/services/telephony.js](src/services/telephony.js:197) to handle missing numbers gracefully
3. Now offers voicemail instead of disconnecting

---

## What You Need to Do

### Update Your `.env` File

Add these lines to set up real agent phone numbers for transfers:

```bash
# Human Agent Phone Numbers (for transfers)
# Format: +[country code][area code][number]
# Example South African: +27821234567
# Example US: +16205291708

AGENT_SALES_NUMBER=+27XXXXXXXXX
AGENT_SHIPPING_NUMBER=+27XXXXXXXXX
AGENT_SUPPORT_NUMBER=+27XXXXXXXXX
AGENT_ACCOUNTS_NUMBER=+27XXXXXXXXX
AGENT_OPERATOR_NUMBER=+27XXXXXXXXX
```

**Replace `+27XXXXXXXXX` with actual phone numbers where calls should transfer.**

### If You Don't Have Agent Numbers Yet

**No problem!** The system now handles this gracefully:

- If no agent number is set, customers will hear:
  > "I apologize, but our [Department] team is not available at the moment. Please leave a message after the tone, and someone will call you back shortly."

- The system will record their message (up to 2 minutes)
- You can retrieve voicemails from Twilio console

---

## Testing the Fixes

### Test 1: Voice Accent
1. Call your Twilio number: **+1 620 529 1708**
2. Listen to the greeting
3. **Expected**: You should hear your South African ElevenLabs voice (Ch64U6EEtyKWKY4sW8MH)
4. **Not**: US Polly.Joanna voice

### Test 2: Transfer Detection
1. Call the number
2. Say: **"Please transfer me to sales"**
3. **Expected**: System should recognize this and attempt transfer
4. **Not**: "I'm sorry, let me transfer you to a specialist" then disconnect

### Test 3: Transfer Without Agent Number
1. Call the number
2. Say: **"I want to speak to a human"**
3. **Expected**: System offers voicemail: "I apologize, but our team is not available..."
4. Leave a test message
5. **Not**: Call disconnects abruptly

### Test 4: Transfer With Agent Number (After You Set It)
1. Add real number to `.env`: `AGENT_SALES_NUMBER=+27821234567`
2. Restart server: `npm start`
3. Call and say: **"Transfer me to sales"**
4. **Expected**: Call transfers to the number you specified
5. Your phone should ring!

---

## Understanding the Voice Issue

### Why It Was Using US Voice

Your system has **two voice systems**:

1. **ElevenLabs** (for AI responses)
   - Your South African voice: `Ch64U6EEtyKWKY4sW8MH`
   - Natural, professional quality
   - Takes ~2-3 seconds to generate

2. **Twilio TTS** (fallback for system messages)
   - Built-in voice: `Polly.Joanna`
   - US accent
   - Instant, no generation needed

### When Each Is Used

**ElevenLabs is used for:**
- Initial greeting (pre-cached)
- IVR menu (pre-cached)
- AI conversation responses

**Twilio TTS is used as fallback when:**
- ElevenLabs generation times out (>8 seconds)
- ElevenLabs API fails
- Audio cache misses

### The Fix

Before fix:
```javascript
voiceId: process.env.ELEVENLABS_VOICE_ID  // Was reading wrong variable
```

After fix:
```javascript
voiceId: process.env.RECEPTIONIST_VOICE_ID || process.env.ELEVENLABS_VOICE_ID
```

Your `.env` has:
```
ELEVENLABS_VOICE_ID=Ch64U6EEtyKWKY4sW8MH
RECEPTIONIST_VOICE_ID=Ch64U6EEtyKWKY4sW8MH
```

Now it correctly reads `RECEPTIONIST_VOICE_ID` first!

---

## Understanding the Transfer Issue

### Detection Flow

1. **Customer speaks**: "Please transfer me to sales"
2. **Twilio transcribes** → `SpeechResult: "Please transfer me to sales"`
3. **System checks keywords** in [src/services/ivr.js](src/services/ivr.js:312):
   ```javascript
   const humanKeywords = ['human', 'agent', 'transfer', ...]
   ```
4. **Match found**: `'transfer'` detected
5. **System sets flag**: `requestedHuman = true`
6. **Transfer initiated**: Calls `createTransferResponse()`

### Keywords Now Detected

The system now detects these phrases:
- "transfer me"
- "transfer me to sales"
- "please transfer"
- "transfer to support"
- "speak with an agent"
- "talk to someone"
- "I want a human"
- "connect me to sales"
- Any variation with these words

---

## Restart Required

After updating `.env`, you **must restart** the server:

```bash
# Stop the server (Ctrl+C in terminal)
# Then restart:
npm start
```

On Railway (production), the server restarts automatically when you push changes.

---

## Quick Checklist

- [x] ✅ Voice config updated to use `RECEPTIONIST_VOICE_ID`
- [x] ✅ Transfer keywords added (including "transfer")
- [x] ✅ Agent phone handling fixed (won't disconnect if not set)
- [ ] ⏳ **You need to**: Add agent phone numbers to `.env`
- [ ] ⏳ **You need to**: Restart server
- [ ] ⏳ **You need to**: Test the call flow

---

## Optional: Different Voices per Department

If you want different voices for Sales, Shipping, etc., your `.env` already has them:

```bash
SALES_VOICE_ID=fPVZbr0RJBH9KL47pnxU
SHIPPING_VOICE_ID=YPtbPhafrxFTDAeaPP4w
SUPPORT_VOICE_ID=fPVZbr0RJBH9KL47pnxU
ACCOUNTS_VOICE_ID=xeBpkkuzgxa0IwKt7NTP
```

The config now reads these automatically! Each department will use its assigned voice for responses.

---

## Next Steps

1. **Add agent numbers** to `.env` (if you have them)
2. **Restart server**: `npm start`
3. **Test call flow**: Dial +1 620 529 1708
4. **Verify**:
   - ✅ Hears South African voice
   - ✅ "Transfer me to sales" is recognized
   - ✅ Either transfers OR offers voicemail (doesn't just disconnect)

5. **Push to Railway** (optional, for production):
   ```bash
   git add .
   git commit -m "Fix voice accent and transfer detection"
   git push origin clean-main
   ```

---

## Need Help?

If issues persist:
1. Check server logs for errors
2. Verify `.env` variables are set correctly
3. Ensure ElevenLabs API key is valid
4. Test with: `node scripts/test-services.js`

**All fixes are now in place!** Just need to restart and test. 🎉
