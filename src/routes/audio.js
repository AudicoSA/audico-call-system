import express from 'express';
import { ttsService } from '../services/tts.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store audio files temporarily in memory (for Railway serverless)
const audioCache = new Map();

// Pre-cache common phrases for instant playback
const COMMON_PHRASES = {
  'greeting': 'This call will be recorded for quality and training purposes. Welcome to Audico. How may I assist you today? You may also say menu to hear our department options.',
  'greeting_short': 'Welcome to Audico. How may I assist you today? You may also say menu to hear our department options.',
  'menu': 'Welcome to Audico how may I direct your call - press 1 for sales, 2 for shipping, 3 for technical support and 4 for accounts.',
  'sales_intro': "I'll be happy to help you with your sales inquiry.",
  'shipping_intro': "Let me help you with your shipping question.",
  'support_intro': "I'm here to provide technical support.",
  'accounts_intro': "I can assist you with your account inquiry.",
};

// Pre-generate common phrases on startup
let preGenerationComplete = false;

async function preGenerateCommonPhrases() {
  if (preGenerationComplete) return;

  console.log('[Audio] Pre-generating common phrases...');
  const { ttsService } = await import('../services/tts.js');

  for (const [key, text] of Object.entries(COMMON_PHRASES)) {
    try {
      const audioBuffer = await ttsService.generateSpeech(text);
      audioCache.set(`common/${key}`, audioBuffer);
      console.log(`[Audio] Pre-cached: ${key}`);
    } catch (error) {
      console.error(`[Audio] Failed to pre-cache ${key}:`, error.message);
    }
  }

  preGenerationComplete = true;
  console.log('[Audio] Common phrases pre-generation complete!');
}

// Start pre-generation (non-blocking)
preGenerateCommonPhrases().catch(console.error);

/**
 * GET /audio/:callSid/:filename
 * Serve generated audio files
 */
router.get('/:callSid/:filename', async (req, res) => {
  try {
    const { callSid, filename } = req.params;
    const cacheKey = `${callSid}/${filename}`;

    // Check if audio is in cache
    if (audioCache.has(cacheKey)) {
      const audioBuffer = audioCache.get(cacheKey);
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(audioBuffer);
    }

    // If not in cache, return 404
    res.status(404).json({ error: 'Audio file not found' });
  } catch (error) {
    console.error('[Audio] Error serving audio:', error);
    res.status(500).json({ error: 'Error serving audio file' });
  }
});

/**
 * Generate and cache audio
 * @param {string} text - Text to convert to speech
 * @param {string} callSid - Call identifier
 * @param {string} filename - Audio filename
 * @param {object} options - TTS options (department, voiceId, etc.)
 * @returns {string} - URL to audio file
 */
export async function generateAndCacheAudio(text, callSid, filename, options = {}) {
  const cacheKey = `${callSid}/${filename}`;

  try {
    console.log(`[Audio] Generating audio for ${cacheKey}`);

    // Generate audio with ElevenLabs
    const audioBuffer = await ttsService.generateSpeech(text, options);

    // Store in cache
    audioCache.set(cacheKey, audioBuffer);

    // Clean up old cache entries after 1 hour
    setTimeout(() => {
      audioCache.delete(cacheKey);
      console.log(`[Audio] Cleaned up cache for ${cacheKey}`);
    }, 3600000); // 1 hour

    return `/audio/${callSid}/${filename}`;
  } catch (error) {
    console.error('[Audio] Error generating audio:', error);
    throw error;
  }
}

/**
 * Pre-generate audio for a message
 * @param {string} text - Text to convert
 * @param {string} callSid - Call identifier
 * @param {string} filename - Filename
 * @param {string} baseUrl - Base URL for full audio URL
 * @param {object} options - TTS options
 * @returns {string} - Full URL to audio file
 */
export async function prepareAudioUrl(text, callSid, filename, baseUrl, options = {}) {
  try {
    // Check if this matches a pre-cached common phrase
    for (const [key, phraseText] of Object.entries(COMMON_PHRASES)) {
      if (text === phraseText) {
        console.log(`[Audio] Using pre-cached phrase: ${key}`);
        // Copy to call-specific cache for serving
        const commonKey = `common/${key}`;
        const callKey = `${callSid}/${filename}`;

        if (audioCache.has(commonKey)) {
          audioCache.set(callKey, audioCache.get(commonKey));
          return `${baseUrl}/audio/${callSid}/${filename}`;
        }
      }
    }

    // If not pre-cached, generate on-demand with timeout
    console.log(`[Audio] Generating audio on-demand for: ${filename}`);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Audio generation timeout (8s)')), 8000)
    );

    const audioPromise = generateAndCacheAudio(text, callSid, filename, options);
    const audioPath = await Promise.race([audioPromise, timeoutPromise]);

    return `${baseUrl}${audioPath}`;
  } catch (error) {
    console.error('[Audio] Error preparing audio URL:', error.message);
    return null; // Fallback to Twilio TTS
  }
}

export default router;
