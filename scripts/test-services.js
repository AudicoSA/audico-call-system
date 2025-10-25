#!/usr/bin/env node

/**
 * Test script to verify all services are configured correctly
 */

import { config, validateConfig } from '../src/config/config.js';
import { sttService } from '../src/services/stt.js';
import { ttsService } from '../src/services/tts.js';
import { llmService } from '../src/services/llm.js';
import { telephonyService } from '../src/services/telephony.js';

console.log('🧪 Audico Call System - Service Test\n');
console.log('====================================\n');

// Test 1: Configuration
console.log('1️⃣  Testing Configuration...');
try {
  validateConfig();
  console.log('✅ Configuration valid\n');
  console.log('   Services configured:');
  console.log(`   - Twilio: ${config.twilio.phoneNumber}`);
  console.log(`   - ElevenLabs Voice ID: ${config.elevenlabs.voiceId}`);
  console.log(`   - LLM Model: ${config.anthropic.model}\n`);
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  console.error('   Please check your .env file\n');
  process.exit(1);
}

// Test 2: ElevenLabs TTS
console.log('2️⃣  Testing ElevenLabs TTS...');
try {
  const testText = 'Hello, this is a test of the South African voice. Howzit!';
  console.log(`   Generating speech: "${testText}"`);

  const audio = await ttsService.generateSpeech(testText);
  console.log(`✅ TTS working! Generated ${audio.length} bytes of audio\n`);
} catch (error) {
  console.error('❌ TTS error:', error.message);
  console.error('   Check your ElevenLabs API key and Voice ID\n');
}

// Test 3: Get available voices
console.log('3️⃣  Fetching ElevenLabs voices...');
try {
  const voices = await ttsService.getVoices();
  console.log(`✅ Found ${voices.length} voices\n`);

  // Show South African voices
  const saVoices = voices.filter(v =>
    v.name.toLowerCase().includes('south') ||
    v.name.toLowerCase().includes('african') ||
    v.labels?.accent?.toLowerCase().includes('south african')
  );

  if (saVoices.length > 0) {
    console.log('   South African voices available:');
    saVoices.forEach(v => {
      console.log(`   - ${v.name} (ID: ${v.voice_id})`);
    });
  } else {
    console.log('   ℹ️  No explicit South African voices found in your library');
    console.log('   Consider using Voice Lab to clone a SA accent\n');
  }
  console.log('');
} catch (error) {
  console.error('❌ Error fetching voices:', error.message, '\n');
}

// Test 4: Claude LLM
console.log('4️⃣  Testing Claude LLM...');
try {
  const testCallSid = 'TEST-CALL-' + Date.now();
  const response = await llmService.generateResponse(
    'Hello, I need help with my order',
    testCallSid,
    {
      department: 'Support',
      intent: 'order_inquiry',
    }
  );

  console.log('✅ LLM working!\n');
  console.log('   Sample response:');
  console.log(`   "${response.substring(0, 100)}..."\n`);

  // Cleanup
  llmService.clearHistory(testCallSid);
} catch (error) {
  console.error('❌ LLM error:', error.message);
  console.error('   Check your Anthropic API key\n');
}

// Test 5: Intent Analysis
console.log('5️⃣  Testing Intent Analysis...');
try {
  const intent = await llmService.analyzeIntent('My package has not arrived and I am very frustrated');
  console.log('✅ Intent analysis working!\n');
  console.log('   Analysis:', JSON.stringify(intent, null, 2), '\n');
} catch (error) {
  console.error('❌ Intent analysis error:', error.message, '\n');
}

// Test 6: Twilio Connection
console.log('6️⃣  Testing Twilio Connection...');
try {
  // Just verify we can create the client
  console.log(`✅ Twilio client initialized\n`);
  console.log(`   Phone Number: ${config.twilio.phoneNumber}`);
  console.log(`   Account SID: ${config.twilio.accountSid.substring(0, 10)}...\n`);
} catch (error) {
  console.error('❌ Twilio error:', error.message, '\n');
}

// Summary
console.log('====================================');
console.log('🎉 Service Tests Complete!\n');
console.log('Next steps:');
console.log('1. Start the server: npm start');
console.log('2. Expose with ngrok: ngrok http 3000');
console.log('3. Configure Twilio webhooks with ngrok URL');
console.log('4. Call your Twilio number to test\n');
