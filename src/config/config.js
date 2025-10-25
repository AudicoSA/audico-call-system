import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Twilio configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // OpenAI configuration (Whisper)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // ElevenLabs configuration
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID, // Default voice
    model: 'eleven_multilingual_v2', // Supports multiple accents
    // Department-specific voices (optional - falls back to default if not set)
    departmentVoices: {
      Sales: process.env.ELEVENLABS_VOICE_SALES || 'fPVZbr0RJBH9KL47pnxU',
      Shipping: process.env.ELEVENLABS_VOICE_SHIPPING || 'YinfoGr2vb39a177NNfl',
      Support: process.env.ELEVENLABS_VOICE_SUPPORT || 'YPtbPhafrxFTDAeaPP4w',
      Accounts: process.env.ELEVENLABS_VOICE_ACCOUNTS || process.env.ELEVENLABS_VOICE_ID,
    },
  },

  // Anthropic Claude configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-5-sonnet-20241022',
  },

  // CRM configuration
  crm: {
    apiUrl: process.env.CRM_API_URL,
    apiKey: process.env.CRM_API_KEY,
  },

  // Supabase configuration (Product Knowledge & RAG)
  supabase: {
    url: process.env.SUPABASE_URL || 'https://ajdehycoypilsegmxbto.supabase.co',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },

  // Call recording & compliance
  recording: {
    enabled: process.env.ENABLE_CALL_RECORDING === 'true',
    consentMessage: process.env.RECORDING_CONSENT_MESSAGE ||
      'This call will be recorded for quality and training purposes.',
  },

  // IVR Menu Options
  ivr: {
    options: {
      1: { name: 'Sales', description: 'Connect to our sales team' },
      2: { name: 'Shipping', description: 'Track your order or shipping inquiries' },
      3: { name: 'Support', description: 'Technical support and troubleshooting' },
      4: { name: 'Accounts', description: 'Billing and account inquiries' },
      0: { name: 'Operator', description: 'Speak to a human operator' },
    },
  },

  // Human Agent Configuration (for HITL transfers)
  agents: {
    sales: process.env.AGENT_SALES_NUMBER || '+27123456789',
    shipping: process.env.AGENT_SHIPPING_NUMBER || '+27123456790',
    support: process.env.AGENT_SUPPORT_NUMBER || '+27123456791',
    accounts: process.env.AGENT_ACCOUNTS_NUMBER || '+27123456792',
    operator: process.env.AGENT_OPERATOR_NUMBER || '+27123456793',
  },

  // Queue Configuration (for when agents are busy)
  queue: {
    maxWaitTime: parseInt(process.env.QUEUE_MAX_WAIT_TIME) || 300, // 5 minutes in seconds
    holdMusicUrl: process.env.QUEUE_HOLD_MUSIC_URL || '',
    callbackThreshold: parseInt(process.env.QUEUE_CALLBACK_THRESHOLD) || 180, // 3 minutes
  },
};

// Validate required configuration
export function validateConfig() {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY',
    'ANTHROPIC_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
