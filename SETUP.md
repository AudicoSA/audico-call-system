# Audico Call System - Setup Guide

Complete setup guide for deploying your AI-powered call center agent with South African voice.

## Prerequisites

- Node.js 18+ installed
- Twilio account with South African phone number
- OpenAI API key (for Whisper STT)
- ElevenLabs API key (for South African TTS)
- Anthropic API key (for Claude LLM)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in your API credentials:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+27123456789

# OpenAI Configuration (for Whisper STT)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# ElevenLabs Configuration (for TTS)
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id_here

# Anthropic Claude Configuration
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Step 3: Get ElevenLabs Voice ID for South African Accent

1. Sign up at [ElevenLabs](https://elevenlabs.io)
2. Browse the Voice Library
3. Search for "South African" or "African" accent voices
4. Select a professional voice (recommended: professional male or female SA English)
5. Copy the Voice ID and add it to your `.env` file

Alternatively, you can use the ElevenLabs Voice Lab to clone a South African voice.

## Step 4: Configure Twilio Phone Number

### A. Purchase a South African Phone Number

1. Log into your Twilio Console
2. Go to Phone Numbers → Buy a number
3. Select South Africa (+27) as the country
4. Choose from:
   - **Local numbers**: 021 (Cape Town), 011 (Johannesburg)
   - **National**: 087
   - **Toll-free**: 0800

### B. Configure Webhooks

1. Go to your purchased phone number settings
2. Configure Voice & Fax:
   - **A call comes in**: Webhook, `https://your-domain.com/voice/incoming`, HTTP POST
   - **Call status changes**: Webhook, `https://your-domain.com/voice/status`, HTTP POST

3. Enable Voice Configuration:
   - Check "Call Recording"
   - Set "Recording Status Callback" to `https://your-domain.com/voice/recording-complete`

## Step 5: Test Locally with Ngrok

For local development, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Start your application
npm start

# In another terminal, start ngrok
ngrok http 3000
```

Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) and update your Twilio webhook URLs with this domain.

## Step 6: Configure CRM Integration (Optional)

If you have an existing CRM (Salesforce, HubSpot, Zoho):

1. Add CRM credentials to `.env`:
```env
CRM_API_URL=https://api.your-crm.com/v1
CRM_API_KEY=your_crm_api_key
```

2. Update CRM service methods in `src/services/crm.js` to match your CRM's API

## Step 7: Customize IVR Menu

Edit `src/config/config.js` to customize your IVR options:

```javascript
ivr: {
  options: {
    1: { name: 'Sales', description: 'Connect to our sales team' },
    2: { name: 'Shipping', description: 'Track your order' },
    3: { name: 'Support', description: 'Technical support' },
    4: { name: 'Accounts', description: 'Billing inquiries' },
    0: { name: 'Operator', description: 'Human operator' },
  },
}
```

## Step 8: Configure Agent Phone Numbers

Edit `src/services/ivr.js` to set phone numbers for human agents:

```javascript
getAgentNumber(department) {
  const agentNumbers = {
    'Sales': '+27123456789',
    'Shipping': '+27123456790',
    'Support': '+27123456791',
    'Accounts': '+27123456792',
    'Operator': '+27123456793',
  };
  return agentNumbers[department];
}
```

## Step 9: Run the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on port 3000 (or your configured PORT).

## Step 10: Test Your System

1. Call your Twilio phone number
2. Listen to the greeting and consent message
3. Say your inquiry or press a number for the IVR menu
4. The AI agent should respond with a South African voice
5. Test escalation to human agents

## Step 11: Monitor Analytics

Access the analytics dashboard:
```
http://localhost:3000/analytics/dashboard
```

View call logs:
```
http://localhost:3000/analytics/calls
```

## Production Deployment

### Option 1: Deploy to Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create audico-call-system

# Set environment variables
heroku config:set TWILIO_ACCOUNT_SID=your_sid
heroku config:set TWILIO_AUTH_TOKEN=your_token
# ... set all other env variables

# Deploy
git push heroku main
```

Update Twilio webhooks with your Heroku domain.

### Option 2: Deploy to AWS/Azure/GCP

1. Use a service like AWS Elastic Beanstalk, Azure App Service, or Google Cloud Run
2. Ensure your server is accessible via HTTPS
3. Update Twilio webhooks with your production domain
4. Configure environment variables in your cloud platform

### Option 3: VPS (Digital Ocean, Linode, etc.)

```bash
# On your server
git clone your-repo
cd audico-call-system
npm install

# Use PM2 for process management
npm install -g pm2
pm2 start src/index.js --name audico

# Setup nginx as reverse proxy
# Point your domain to the server
# Configure SSL with Let's Encrypt
```

## POPIA Compliance Configuration

The system includes POPIA compliance features:

1. **Call Recording Consent**: Automatically plays consent message
2. **Data Subject Requests**: Handled via compliance manager
3. **Audit Logs**: All compliance events are logged
4. **Data Retention**: Configure in `src/utils/logger.js`

To adjust the consent message:
```env
RECORDING_CONSENT_MESSAGE="This call will be recorded for quality and training purposes."
```

## Troubleshooting

### Issue: No audio on calls
- Check that your Twilio account is verified
- Ensure your ElevenLabs API key is valid
- Verify webhook URLs are accessible (test with curl)

### Issue: Transcription not working
- Verify OpenAI API key has access to Whisper
- Check that audio format is supported
- Review logs for STT errors

### Issue: AI not responding correctly
- Review Claude prompt in `src/services/llm.js`
- Check conversation history is being maintained
- Verify Anthropic API key is valid

### Issue: Calls not connecting to human agents
- Verify agent phone numbers are correct in `src/services/ivr.js`
- Check that numbers are in E.164 format (+27...)
- Test calling agent numbers directly

## Cost Estimates (Monthly)

Based on 1000 calls per month, average 5 minutes per call:

- **Twilio**: ~$25 (phone number + usage)
- **OpenAI Whisper**: ~$30 (5000 minutes @ $0.006/min)
- **ElevenLabs**: ~$22 (30k characters on Creator plan)
- **Anthropic Claude**: ~$15 (based on API usage)

**Total**: ~$92/month for 1000 calls

Scale pricing accordingly for your expected volume.

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Review the technical business plan
3. Consult Twilio, OpenAI, ElevenLabs, and Anthropic documentation

## Next Steps

1. Train your AI agent with domain-specific knowledge
2. Integrate with your CRM and business systems
3. Set up monitoring and alerting
4. Conduct user acceptance testing
5. Roll out gradually to your customer base
