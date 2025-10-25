import express from 'express';
import { telephonyService } from '../services/telephony.js';
import { ivrService } from '../services/ivr.js';
import { llmService } from '../services/llm.js';
import { ttsService } from '../services/tts.js';
import { sttService } from '../services/stt.js';
import { crmService } from '../services/crm.js';
import { config } from '../config/config.js';
import { prepareAudioUrl } from './audio.js';

const router = express.Router();

// Get base URL for webhooks
const getBaseUrl = (req) => {
  // Railway/Vercel/other proxies set x-forwarded-proto header
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${protocol}://${req.get('host')}`;
};

/**
 * POST /voice/incoming
 * Handle incoming calls
 */
router.post('/incoming', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const from = req.body.From;
    const to = req.body.To;

    console.log('[Voice] Incoming call:', { callSid, from, to });

    // Initialize call in IVR system
    ivrService.initializeCall(callSid, {
      from,
      fromCity: req.body.FromCity,
      fromState: req.body.FromState,
      fromCountry: req.body.FromCountry,
    });

    const baseUrl = getBaseUrl(req);

    // Try ElevenLabs with pre-cached greeting (instant playback)
    const greetingText = config.recording.enabled
      ? 'This call will be recorded for quality and training purposes. Welcome to Audico. How may I assist you today? You may also say menu to hear our department options.'
      : 'Welcome to Audico. How may I assist you today? You may also say menu to hear our department options.';

    const audioUrl = await prepareAudioUrl(
      greetingText,
      callSid,
      'greeting.mp3',
      baseUrl
    );

    if (audioUrl) {
      // Use ElevenLabs audio (pre-cached, instant)
      const twiml = telephonyService.createGreetingResponseWithAudio(baseUrl, audioUrl);
      res.type('text/xml');
      return res.send(twiml);
    }

    // Fallback to Twilio TTS if generation failed
    const twiml = telephonyService.createGreetingResponse(baseUrl);
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[Voice] Error handling incoming call:', error);
    const baseUrl = getBaseUrl(req);
    const twiml = telephonyService.createGreetingResponse(baseUrl);
    res.type('text/xml');
    res.send(twiml);
  }
});

/**
 * POST /voice/process-input
 * Process initial user speech input
 */
router.post('/process-input', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult || '';

    console.log('[Voice] Processing input:', { callSid, speechResult });

    if (!speechResult) {
      // No speech detected, show IVR menu
      const baseUrl = getBaseUrl(req);
      const twiml = telephonyService.createIVRMenu(baseUrl);
      res.type('text/xml');
      return res.send(twiml);
    }

    // Analyze intent from speech
    const intentAnalysis = await ivrService.analyzeIntent(callSid, speechResult);

    console.log('[Voice] Intent analysis:', intentAnalysis);

    // Determine routing
    const routing = await ivrService.determineRouting(callSid, intentAnalysis.department);

    if (routing.routeType === 'human') {
      // Transfer to human agent
      const twiml = telephonyService.createTransferResponse(
        routing.agentNumber,
        routing.department
      );
      res.type('text/xml');
      res.send(twiml);
    } else {
      // Route to AI agent
      const baseUrl = getBaseUrl(req);
      const state = ivrService.getCallState(callSid);

      // Generate AI response with product knowledge tools
      const aiResponse = await llmService.generateResponseWithTools(
        speechResult,
        callSid,
        {
          department: intentAnalysis.department,
          intent: intentAnalysis.intent,
          callerInfo: {
            phone: state.callerNumber,
          },
        }
      );

      // Generate TTS audio (using Twilio's TTS for now, can switch to ElevenLabs)
      const twiml = telephonyService.createSpeechResponse(
        aiResponse,
        null,
        `${baseUrl}/voice/conversation`
      );

      // Update conversation turn count
      ivrService.updateCallState(callSid, {
        conversationTurns: (state.conversationTurns || 0) + 1,
      });

      res.type('text/xml');
      res.send(twiml);
    }
  } catch (error) {
    console.error('[Voice] Error processing input:', error);
    res.status(500).send('Error processing input');
  }
});

/**
 * POST /voice/ivr-menu
 * Show IVR menu
 */
router.post('/ivr-menu', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const baseUrl = getBaseUrl(req);

    // Try ElevenLabs with pre-cached menu (instant playback)
    const menuText = 'Welcome to Audico how may I direct your call - press 1 for sales, 2 for shipping, 3 for technical support and 4 for accounts.';

    const audioUrl = await prepareAudioUrl(
      menuText,
      callSid,
      'menu.mp3',
      baseUrl
    );

    if (audioUrl) {
      // Use ElevenLabs audio (pre-cached, instant)
      const twiml = telephonyService.createIVRMenuWithAudio(baseUrl, audioUrl);
      res.type('text/xml');
      return res.send(twiml);
    }

    // Fallback to Twilio TTS
    const twiml = telephonyService.createIVRMenu(baseUrl);
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[Voice] Error showing IVR menu:', error);
    const baseUrl = getBaseUrl(req);
    const twiml = telephonyService.createIVRMenu(baseUrl);
    res.type('text/xml');
    res.send(twiml);
  }
});

/**
 * POST /voice/ivr-selection
 * Process IVR menu selection
 */
router.post('/ivr-selection', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const digits = req.body.Digits || '';
    const speechResult = req.body.SpeechResult || '';

    const selection = digits || speechResult;

    console.log('[Voice] IVR selection:', { callSid, selection });

    // Process menu selection
    const result = await ivrService.processMenuSelection(callSid, selection);

    if (result.action === 'repeat_menu') {
      // Invalid selection, repeat menu
      const baseUrl = getBaseUrl(req);
      const twiml = telephonyService.createIVRMenu(baseUrl);
      res.type('text/xml');
      return res.send(twiml);
    }

    // Route based on selection
    const routing = await ivrService.determineRouting(callSid, result.department);

    if (routing.routeType === 'human') {
      // Transfer to human
      const twiml = telephonyService.createTransferResponse(
        routing.agentNumber,
        routing.department
      );
      res.type('text/xml');
      res.send(twiml);
    } else {
      // Continue with AI agent
      const baseUrl = getBaseUrl(req);
      const twiml = telephonyService.createSpeechResponse(
        routing.message,
        null,
        `${baseUrl}/voice/conversation`
      );
      res.type('text/xml');
      res.send(twiml);
    }
  } catch (error) {
    console.error('[Voice] Error processing IVR selection:', error);
    res.status(500).send('Error processing selection');
  }
});

/**
 * POST /voice/conversation
 * Handle ongoing conversation with AI agent
 */
router.post('/conversation', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult || '';

    console.log('[Voice] Conversation turn:', { callSid, speechResult });

    const state = ivrService.getCallState(callSid);

    if (!speechResult) {
      // No speech, ask again
      const twiml = telephonyService.createSpeechResponse(
        'Sorry, I did not hear that. Could you please repeat?',
        null,
        `${getBaseUrl(req)}/voice/conversation`
      );
      res.type('text/xml');
      return res.send(twiml);
    }

    // Check if escalation is needed (pass speech input for human request detection)
    const shouldEscalate = await ivrService.shouldEscalate(callSid, speechResult);

    if (shouldEscalate) {
      // Generate handoff summary
      const summary = await ivrService.generateHandoffSummary(callSid);

      // Log to CRM
      await crmService.logCall(summary);

      // Transfer to human
      const routing = await ivrService.determineRouting(callSid, state.selectedDepartment);
      const twiml = telephonyService.createTransferResponse(
        routing.agentNumber,
        state.selectedDepartment
      );

      res.type('text/xml');
      return res.send(twiml);
    }

    // Generate AI response with product knowledge tools
    const aiResponse = await llmService.generateResponseWithTools(
      speechResult,
      callSid,
      {
        department: state.selectedDepartment,
        intent: state.intent,
        callerInfo: {
          phone: state.callerNumber,
        },
      }
    );

    // Update conversation turn count
    ivrService.updateCallState(callSid, {
      conversationTurns: (state.conversationTurns || 0) + 1,
    });

    // Continue conversation
    const baseUrl = getBaseUrl(req);
    const twiml = telephonyService.createSpeechResponse(
      aiResponse,
      null,
      `${baseUrl}/voice/conversation`
    );

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[Voice] Error in conversation:', error);
    res.status(500).send('Error processing conversation');
  }
});

/**
 * POST /voice/recording-complete
 * Handle completed recording
 */
router.post('/recording-complete', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const recordingUrl = req.body.RecordingUrl;
    const recordingSid = req.body.RecordingSid;

    console.log('[Voice] Recording complete:', { callSid, recordingSid });

    // Thank the caller
    const twiml = telephonyService.createHangupResponse(
      'Thank you for your message. We will get back to you shortly. Goodbye!'
    );

    res.type('text/xml');
    res.send(twiml);

    // Log recording in background
    const state = ivrService.getCallState(callSid);
    if (state) {
      await crmService.logCall({
        callSid,
        callerNumber: state.callerNumber,
        department: state.selectedDepartment || 'Unknown',
        recordingUrl,
        recordingSid,
      });
    }
  } catch (error) {
    console.error('[Voice] Error handling recording:', error);
    res.status(500).send('Error processing recording');
  }
});

/**
 * POST /voice/transcription
 * Handle transcription callback
 */
router.post('/transcription', async (req, res) => {
  try {
    const transcriptionText = req.body.TranscriptionText;
    const callSid = req.body.CallSid;

    console.log('[Voice] Transcription received:', { callSid, transcriptionText });

    // Process transcription (store in database, analyze, etc.)
    // This is called asynchronously after the call ends

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Voice] Error handling transcription:', error);
    res.status(500).send('Error processing transcription');
  }
});

/**
 * POST /voice/status
 * Handle call status callbacks
 */
router.post('/status', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;

    console.log('[Voice] Call status:', { callSid, callStatus });

    if (callStatus === 'completed') {
      // Call ended, cleanup
      const state = ivrService.getCallState(callSid);

      if (state) {
        // Generate final summary
        const summary = await ivrService.generateHandoffSummary(callSid);

        // Log to CRM
        await crmService.logCall({
          ...summary,
          resolved: true,
        });
      }

      // Cleanup call state
      ivrService.cleanupCall(callSid);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Voice] Error handling status:', error);
    res.status(500).send('Error processing status');
  }
});

export default router;
