import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

console.log('🔍 Testing ElevenLabs Configuration...\n');

// Check if credentials exist
if (!ELEVENLABS_API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not found in .env file');
  process.exit(1);
}

if (!ELEVENLABS_VOICE_ID) {
  console.error('❌ ELEVENLABS_VOICE_ID not found in .env file');
  process.exit(1);
}

console.log('✅ API Key found:', ELEVENLABS_API_KEY.substring(0, 10) + '...');
console.log('✅ Voice ID:', ELEVENLABS_VOICE_ID);
console.log('');

async function testElevenLabs() {
  try {
    // Test 1: Check API key validity by fetching voices
    console.log('📋 Test 1: Fetching available voices...');
    const voicesResponse = await axios({
      method: 'GET',
      url: 'https://api.elevenlabs.io/v1/voices',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    console.log(`✅ API Key valid! Found ${voicesResponse.data.voices.length} voices in your account\n`);

    // Check if the configured voice ID exists
    const voiceExists = voicesResponse.data.voices.find(v => v.voice_id === ELEVENLABS_VOICE_ID);
    if (voiceExists) {
      console.log(`✅ Voice ID "${ELEVENLABS_VOICE_ID}" found: ${voiceExists.name}`);
    } else {
      console.error(`❌ Voice ID "${ELEVENLABS_VOICE_ID}" NOT found in your account!`);
      console.log('Available voices:');
      voicesResponse.data.voices.forEach(v => {
        console.log(`   - ${v.name} (${v.voice_id})`);
      });
      process.exit(1);
    }
    console.log('');

    // Test 2: Check department voices
    console.log('📋 Test 2: Checking department voices...');
    const departmentVoices = {
      Sales: 'fPVZbr0RJBH9KL47pnxU',
      Shipping: 'YinfoGr2vb39a177NNfl',
      Support: 'YPtbPhafrxFTDAeaPP4w',
    };

    for (const [dept, voiceId] of Object.entries(departmentVoices)) {
      const exists = voicesResponse.data.voices.find(v => v.voice_id === voiceId);
      if (exists) {
        console.log(`✅ ${dept} voice (${voiceId}): ${exists.name}`);
      } else {
        console.log(`⚠️  ${dept} voice (${voiceId}): NOT found - will use default`);
      }
    }
    console.log('');

    // Test 3: Generate test audio
    console.log('📋 Test 3: Generating test audio...');
    const testText = 'Welcome to Audico. How may I assist you today?';

    const startTime = Date.now();
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        text: testText,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.6,
          use_speaker_boost: false,
        },
        optimize_streaming_latency: 3,
      },
      responseType: 'arraybuffer',
    });
    const endTime = Date.now();

    const audioBuffer = Buffer.from(response.data);
    const outputPath = 'test-output.mp3';
    fs.writeFileSync(outputPath, audioBuffer);

    console.log(`✅ Audio generated successfully!`);
    console.log(`   Duration: ${endTime - startTime}ms`);
    console.log(`   File size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Saved to: ${outputPath}`);
    console.log('');

    // Test 4: Check if generation time is acceptable
    if (endTime - startTime > 8000) {
      console.log(`⚠️  WARNING: Generation took ${endTime - startTime}ms (>8s timeout threshold)`);
      console.log('   This may cause fallback to Twilio TTS in live calls');
    } else {
      console.log(`✅ Generation time ${endTime - startTime}ms is within 8s timeout`);
    }
    console.log('');

    console.log('🎉 ALL TESTS PASSED!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Play test-output.mp3 to hear the voice quality');
    console.log('2. Verify these same credentials are set in Railway environment variables');
    console.log('3. Check Railway logs for "[Audio] Pre-generating common phrases..." messages');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 401) {
        console.error('\n   → API key is invalid or expired');
      } else if (error.response.status === 429) {
        console.error('\n   → Rate limit exceeded or out of credits');
      } else if (error.response.status === 404) {
        console.error('\n   → Voice ID not found');
      }
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

testElevenLabs();
