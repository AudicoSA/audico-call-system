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
    const audioPath = await generateAndCacheAudio(text, callSid, filename, options);
    return `${baseUrl}${audioPath}`;
  } catch (error) {
    console.error('[Audio] Error preparing audio URL:', error);
    return null;
  }
}

export default router;
