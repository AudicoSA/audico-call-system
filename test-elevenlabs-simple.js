import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

console.log('🔍 Testing ElevenLabs Audio Generation...\n');

if (!ELEVENLABS_API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not found in .env file');
  process.exit(1);
}

if (!ELEVENLABS_VOICE_ID) {
  console.error('❌ ELEVENLABS_VOICE_ID not found in .env file');
  process.exit(1);
}

console.log('✅ API Key found:', ELEVENLABS_API_KEY.substring(0, 15) + '...');
console.log('✅ Voice ID:', ELEVENLABS_VOICE_ID);
console.log('');

async function testAudioGeneration() {
  try {
    console.log('📋 Generating test audio with turbo model...');
    const testText = 'Welcome to Audico. How may I assist you today? You may also say menu to hear our department options.';

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
      timeout: 15000,
    });
    const endTime = Date.now();

    const audioBuffer = Buffer.from(response.data);
    const outputPath = 'test-greeting.mp3';
    fs.writeFileSync(outputPath, audioBuffer);

    console.log('');
    console.log('✅ SUCCESS! Audio generated!');
    console.log(`   Generation time: ${endTime - startTime}ms`);
    console.log(`   File size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Saved to: ${outputPath}`);
    console.log('');

    if (endTime - startTime > 8000) {
      console.log(`⚠️  WARNING: Took ${endTime - startTime}ms (exceeds 8s timeout)`);
      console.log('   May cause fallback to Twilio in live calls');
      console.log('   Consider using shorter text or pre-caching');
    } else {
      console.log(`✅ Generation time is acceptable (under 8s timeout)`);
    }
    console.log('');

    console.log('🎉 TEST PASSED!');
    console.log('');
    console.log('ACTION REQUIRED:');
    console.log('1. ▶️  Play "test-greeting.mp3" to verify voice quality');
    console.log('2. 🔍 Go to Railway → Your Project → Variables');
    console.log('3. ✅ Verify ELEVENLABS_API_KEY matches your local .env');
    console.log('4. ✅ Verify ELEVENLABS_VOICE_ID matches your local .env');
    console.log('5. 📋 Check Railway logs for any ElevenLabs errors');
    console.log('');
    console.log('If Railway has the wrong API key, the system will ALWAYS use Twilio fallback.');

  } catch (error) {
    console.error('\n❌ AUDIO GENERATION FAILED:');
    if (error.response) {
      console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      console.error('');

      if (error.response.status === 401) {
        console.error('   ❌ API KEY IS INVALID OR EXPIRED');
        console.error('   → Go to https://elevenlabs.io/app/settings/api-keys');
        console.error('   → Generate a NEW API key with full permissions');
        console.error('   → Update your .env file and Railway environment variables');
      } else if (error.response.status === 429) {
        console.error('   ❌ RATE LIMIT OR OUT OF CREDITS');
        console.error('   → Check your ElevenLabs account balance');
        console.error('   → You may need to upgrade your plan');
      } else if (error.response.status === 404) {
        console.error('   ❌ VOICE ID NOT FOUND');
        console.error('   → The voice ID "' + ELEVENLABS_VOICE_ID + '" does not exist');
        console.error('   → Go to https://elevenlabs.io/app/voice-library');
        console.error('   → Find a voice and copy its ID');
      } else if (error.response.status === 422) {
        console.error('   ❌ INVALID REQUEST');
        console.error('   → Check if the voice ID is correct');
        console.error('   → Check if the model "eleven_turbo_v2_5" is available');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('   ⏱️  REQUEST TIMEOUT');
      console.error('   → Generation took longer than 15 seconds');
      console.error('   → Check your internet connection');
    } else {
      console.error(`   ${error.message}`);
    }
    console.error('');
    process.exit(1);
  }
}

testAudioGeneration();
