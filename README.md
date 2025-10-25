# Audico Call System

An AI-powered call center agent with South African voice capabilities and intelligent IVR routing.

## Features

- South African voice TTS via ElevenLabs
- Speech-to-text using OpenAI Whisper
- Intelligent call routing with multi-option IVR
- AI-powered conversation handling (Claude/GPT)
- **Product Knowledge with RAG** - Supabase integration for semantic product search
- CRM integration capabilities
- POPIA-compliant call recording
- Real-time analytics and logging

## Architecture

```
Caller → Twilio (Telephony) → Express Server → AI Voice Agent
                                                    ↓
                                          [STT] Whisper API
                                          [LLM] Claude/GPT with Tool Calling
                                          [TTS] ElevenLabs (SA Voice)
                                          [RAG] Supabase Product Knowledge
                                                    ↓
                                          IVR Router → Human Agent/Sub-Agent
                                                    ↓
                                          CRM Integration & Analytics
```

## Quick Start

1. Copy `.env.example` to `.env` and fill in your API keys
2. Install dependencies: `npm install`
3. Set up Supabase for product knowledge (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md))
4. Start the server: `npm start`

See [SETUP.md](SETUP.md) for detailed setup instructions.

## Configuration

### Twilio Setup
- Purchase a South African phone number (021, 011, 087, or 0800)
- Configure webhook URL to point to your server endpoint

### ElevenLabs Voice
- Use a South African accent voice for authentic customer experience
- Recommended voices: Professional South African English accents

## Compliance (POPIA)

This system includes features for POPIA compliance:
- Call recording consent messages
- Secure data storage
- Audit trails for calls
- Data subject request workflows

## License

ISC
