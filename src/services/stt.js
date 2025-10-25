import OpenAI from 'openai';
import { config } from '../config/config.js';
import fs from 'fs/promises';

/**
 * Speech-to-Text service using OpenAI Whisper
 */
export class STTService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * Transcribe audio to text using Whisper API
   * @param {Buffer|string} audioInput - Audio buffer or file path
   * @param {string} language - Language code (default: 'en')
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribe(audioInput, language = 'en') {
    try {
      let audioFile;

      // Handle both file paths and buffers
      if (typeof audioInput === 'string') {
        audioFile = await fs.readFile(audioInput);
      } else {
        audioFile = audioInput;
      }

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: language,
        response_format: 'json',
      });

      console.log('[STT] Transcription successful:', transcription.text);
      return transcription.text;
    } catch (error) {
      console.error('[STT] Transcription error:', error.message);
      throw new Error(`Speech-to-text transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe audio stream in real-time
   * Note: For real-time streaming, you may want to use a different service
   * or implement chunked processing
   * @param {ReadableStream} audioStream - Audio stream
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeStream(audioStream) {
    // Collect chunks from stream
    const chunks = [];

    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);
    return this.transcribe(audioBuffer);
  }

  /**
   * Detect language of audio
   * @param {Buffer|string} audioInput - Audio buffer or file path
   * @returns {Promise<string>} - Detected language code
   */
  async detectLanguage(audioInput) {
    try {
      let audioFile;

      if (typeof audioInput === 'string') {
        audioFile = await fs.readFile(audioInput);
      } else {
        audioFile = audioInput;
      }

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'json',
      });

      console.log('[STT] Language detected:', transcription.language);
      return transcription.language;
    } catch (error) {
      console.error('[STT] Language detection error:', error.message);
      return 'en'; // Default to English
    }
  }
}

// Singleton instance
export const sttService = new STTService();
