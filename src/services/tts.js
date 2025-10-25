import axios from 'axios';
import { config } from '../config/config.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Text-to-Speech service using ElevenLabs with South African voice
 */
export class TTSService {
  constructor() {
    this.apiKey = config.elevenlabs.apiKey;
    this.voiceId = config.elevenlabs.voiceId;
    this.model = config.elevenlabs.model;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  /**
   * Get voice ID for a specific department
   * @param {string} department - Department name
   * @returns {string} - Voice ID
   */
  getVoiceForDepartment(department) {
    const departmentVoices = config.elevenlabs.departmentVoices || {};
    return departmentVoices[department] || this.voiceId;
  }

  /**
   * Generate speech from text using ElevenLabs
   * @param {string} text - Text to convert to speech
   * @param {object} options - Additional options (voiceId, department, model, etc.)
   * @returns {Promise<Buffer>} - Audio buffer
   */
  async generateSpeech(text, options = {}) {
    try {
      // Determine voice ID (priority: options.voiceId > department-specific > default)
      let voiceId = options.voiceId;
      if (!voiceId && options.department) {
        voiceId = this.getVoiceForDepartment(options.department);
        console.log(`[TTS] Using ${options.department} department voice:`, voiceId);
      }
      if (!voiceId) {
        voiceId = this.voiceId;
      }

      const model = options.model || this.model;

      console.log('[TTS] Generating speech for text:', text.substring(0, 50) + '...');

      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/text-to-speech/${voiceId}`,
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        data: {
          text: text,
          model_id: model,
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarity_boost || 0.75,
            style: options.style || 0.0,
            use_speaker_boost: options.use_speaker_boost || true,
          },
        },
        responseType: 'arraybuffer',
      });

      console.log('[TTS] Speech generated successfully');
      return Buffer.from(response.data);
    } catch (error) {
      console.error('[TTS] Speech generation error:', error.message);
      throw new Error(`Text-to-speech generation failed: ${error.message}`);
    }
  }

  /**
   * Generate speech and save to file
   * @param {string} text - Text to convert to speech
   * @param {string} outputPath - Path to save audio file
   * @param {object} options - Additional options
   * @returns {Promise<string>} - Path to saved file
   */
  async generateSpeechToFile(text, outputPath, options = {}) {
    const audioBuffer = await this.generateSpeech(text, options);
    await fs.writeFile(outputPath, audioBuffer);
    console.log('[TTS] Audio saved to:', outputPath);
    return outputPath;
  }

  /**
   * Get available voices from ElevenLabs
   * @returns {Promise<Array>} - List of available voices
   */
  async getVoices() {
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseUrl}/voices`,
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data.voices;
    } catch (error) {
      console.error('[TTS] Error fetching voices:', error.message);
      throw new Error(`Failed to fetch voices: ${error.message}`);
    }
  }

  /**
   * Stream speech generation (for real-time use)
   * @param {string} text - Text to convert to speech
   * @param {object} options - Additional options
   * @returns {Promise<ReadableStream>} - Audio stream
   */
  async generateSpeechStream(text, options = {}) {
    try {
      const voiceId = options.voiceId || this.voiceId;
      const model = options.model || this.model;

      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        data: {
          text: text,
          model_id: model,
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarity_boost || 0.75,
          },
        },
        responseType: 'stream',
      });

      return response.data;
    } catch (error) {
      console.error('[TTS] Stream generation error:', error.message);
      throw new Error(`Text-to-speech streaming failed: ${error.message}`);
    }
  }

  /**
   * Generate multiple audio segments for IVR menu
   * @param {Array<string>} texts - Array of texts to convert
   * @returns {Promise<Array<Buffer>>} - Array of audio buffers
   */
  async generateBatchSpeech(texts) {
    const audioBuffers = [];

    for (const text of texts) {
      const buffer = await this.generateSpeech(text);
      audioBuffers.push(buffer);
    }

    return audioBuffers;
  }
}

// Singleton instance
export const ttsService = new TTSService();
