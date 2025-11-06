import twilio from 'twilio';
import { config } from '../config/config.js';

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Telephony service using Twilio
 */
export class TelephonyService {
  constructor() {
    this.client = twilio(
      config.twilio.accountSid,
      config.twilio.authToken
    );
    this.phoneNumber = config.twilio.phoneNumber;
  }

  /**
   * Create TwiML response for initial greeting with ElevenLabs audio
   * @param {string} baseUrl - Base URL for callbacks
   * @param {string} audioUrl - URL to ElevenLabs audio file
   * @returns {string} - TwiML XML
   */
  createGreetingResponseWithAudio(baseUrl, audioUrl) {
    const twiml = new VoiceResponse();

    // Play ElevenLabs audio
    if (audioUrl) {
      twiml.play(audioUrl);
    }

    // Gather speech input
    twiml.gather({
      input: 'speech',
      action: `${baseUrl}/voice/process-input`,
      method: 'POST',
      timeout: 5,
      speechTimeout: 'auto',
      language: 'en-ZA',
    });

    // Fallback if no input - use Twilio TTS
    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-ZA',
    }, 'I did not hear anything. Please call back when you are ready.');

    twiml.hangup();

    return twiml.toString();
  }

  /**
   * Create TwiML response for initial greeting (fallback with Twilio TTS)
   * @param {string} baseUrl - Base URL for callbacks
   * @returns {string} - TwiML XML
   */
  createGreetingResponse(baseUrl) {
    const twiml = new VoiceResponse();

    // Play consent message if recording is enabled
    if (config.recording.enabled) {
      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-ZA',
      }, config.recording.consentMessage);
    }

    // Greeting with menu option
    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-ZA',
    }, 'Welcome to Audico. How may I assist you today? You may also say menu to hear our department options.');

    // Gather speech input
    const gather = twiml.gather({
      input: 'speech',
      action: `${baseUrl}/voice/process-input`,
      method: 'POST',
      timeout: 5,
      speechTimeout: 'auto',
      language: 'en-ZA',
    });

    // Fallback if no input
    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-ZA',
    }, 'I did not hear anything. Please call back when you are ready.');

    twiml.hangup();

    return twiml.toString();
  }

  /**
   * Create TwiML response for IVR menu with ElevenLabs audio
   * @param {string} baseUrl - Base URL for callbacks
   * @param {string} audioUrl - URL to ElevenLabs audio file
   * @returns {string} - TwiML XML
   */
  createIVRMenuWithAudio(baseUrl, audioUrl) {
    const twiml = new VoiceResponse();

    // Play ElevenLabs audio
    if (audioUrl) {
      twiml.play(audioUrl);
    }

    twiml.gather({
      input: 'dtmf speech',
      action: `${baseUrl}/voice/ivr-selection`,
      method: 'POST',
      numDigits: 1,
      timeout: 5,
    });

    // Repeat menu if no input
    twiml.redirect(`${baseUrl}/voice/ivr-menu`);

    return twiml.toString();
  }

  /**
   * Create TwiML response for IVR menu (fallback with Twilio TTS)
   * @param {string} baseUrl - Base URL for callbacks
   * @returns {string} - TwiML XML
   */
  createIVRMenu(baseUrl) {
    const twiml = new VoiceResponse();

    const menuText = `Welcome to Audico how may I direct your call - press 1 for sales, 2 for shipping, 3 for technical support and 4 for accounts.`;

    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-ZA',
    }, menuText);

    twiml.gather({
      input: 'dtmf speech',
      action: `${baseUrl}/voice/ivr-selection`,
      method: 'POST',
      numDigits: 1,
      timeout: 5,
    });

    // Repeat menu if no input
    twiml.redirect(`${baseUrl}/voice/ivr-menu`);

    return twiml.toString();
  }

  /**
   * Create TwiML response with AI-generated speech
   * @param {string} text - Text to speak
   * @param {string} audioUrl - URL to audio file (if pre-generated)
   * @param {string} nextAction - URL for next action
   * @param {object} options - Additional options (department for voice selection)
   * @returns {string} - TwiML XML
   */
  createSpeechResponse(text, audioUrl = null, nextAction = null, options = {}) {
    const twiml = new VoiceResponse();

    if (audioUrl) {
      // Use pre-generated audio
      twiml.play(audioUrl);
    } else {
      // Use Twilio's TTS (fallback)
      // Note: For ElevenLabs voices, audio should be pre-generated and passed as audioUrl
      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-ZA',
      }, text);
    }

    if (nextAction) {
      // Continue to next action
      const gather = twiml.gather({
        input: 'speech',
        action: nextAction,
        method: 'POST',
        timeout: 5,
        speechTimeout: 'auto',
        language: 'en-ZA',
      });
    }

    return twiml.toString();
  }

  /**
   * Create TwiML response to transfer call to human agent
   * @param {string} agentNumber - Phone number of agent
   * @param {string} department - Department name
   * @returns {string} - TwiML XML
   */
  createTransferResponse(agentNumber, department) {
    const twiml = new VoiceResponse();

    // Check if agent number is configured
    if (!agentNumber || agentNumber === 'null') {
      // No agent number configured - inform customer and offer voicemail
      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-ZA',
      }, `I apologize, but our ${department} team is not available at the moment. Please leave a message after the tone, and someone will call you back shortly.`);

      twiml.record({
        maxLength: 120,
        transcribe: true,
        playBeep: true,
      });

      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-ZA',
      }, 'Thank you for your message. We will contact you soon. Goodbye.');

      twiml.hangup();
    } else {
      // Agent number is configured - attempt transfer
      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-ZA',
      }, `Transferring you to our ${department} team. Please hold.`);

      twiml.dial({
        callerId: this.phoneNumber,
      }, agentNumber);
    }

    return twiml.toString();
  }

  /**
   * Create TwiML response to record a message
   * @param {string} baseUrl - Base URL for callbacks
   * @returns {string} - TwiML XML
   */
  createRecordingResponse(baseUrl) {
    const twiml = new VoiceResponse();

    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-ZA',
    }, 'Please leave a message after the tone. Press any key when you are finished.');

    twiml.record({
      action: `${baseUrl}/voice/recording-complete`,
      method: 'POST',
      maxLength: 120,
      transcribe: true,
      transcribeCallback: `${baseUrl}/voice/transcription`,
    });

    return twiml.toString();
  }

  /**
   * Make an outbound call
   * @param {string} toNumber - Recipient phone number
   * @param {string} callbackUrl - URL for handling the call
   * @returns {Promise<object>} - Call object
   */
  async makeOutboundCall(toNumber, callbackUrl) {
    try {
      const call = await this.client.calls.create({
        to: toNumber,
        from: this.phoneNumber,
        url: callbackUrl,
        method: 'POST',
      });

      console.log('[Telephony] Outbound call initiated:', call.sid);
      return call;
    } catch (error) {
      console.error('[Telephony] Outbound call error:', error.message);
      throw new Error(`Failed to make outbound call: ${error.message}`);
    }
  }

  /**
   * Send SMS message
   * @param {string} toNumber - Recipient phone number
   * @param {string} message - SMS message text
   * @returns {Promise<object>} - Message object
   */
  async sendSMS(toNumber, message) {
    try {
      const sms = await this.client.messages.create({
        to: toNumber,
        from: this.phoneNumber,
        body: message,
      });

      console.log('[Telephony] SMS sent:', sms.sid);
      return sms;
    } catch (error) {
      console.error('[Telephony] SMS error:', error.message);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Get call details
   * @param {string} callSid - Call SID
   * @returns {Promise<object>} - Call details
   */
  async getCallDetails(callSid) {
    try {
      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      console.error('[Telephony] Error fetching call details:', error.message);
      throw new Error(`Failed to fetch call details: ${error.message}`);
    }
  }

  /**
   * Get call recording
   * @param {string} recordingSid - Recording SID
   * @returns {Promise<object>} - Recording details
   */
  async getRecording(recordingSid) {
    try {
      const recording = await this.client.recordings(recordingSid).fetch();
      return recording;
    } catch (error) {
      console.error('[Telephony] Error fetching recording:', error.message);
      throw new Error(`Failed to fetch recording: ${error.message}`);
    }
  }

  /**
   * Create TwiML for hangup with goodbye message
   * @returns {string} - TwiML XML
   */
  createHangupResponse(message = 'Thank you for calling Audico. Goodbye!') {
    const twiml = new VoiceResponse();

    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-ZA',
    }, message);

    twiml.hangup();

    return twiml.toString();
  }
}

// Singleton instance
export const telephonyService = new TelephonyService();
