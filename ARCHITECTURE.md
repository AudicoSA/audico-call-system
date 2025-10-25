# Audico Call System - Architecture Documentation

## System Overview

The Audico Call System is an AI-powered call center agent that combines multiple AI services to provide an intelligent, conversational experience with a South African voice.

```
┌─────────────┐
│   Caller    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│          Twilio (Telephony)             │
│  - South African Phone Numbers          │
│  - Call Routing                          │
│  - WebRTC/SIP Integration                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       Express Server (Node.js)          │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │      Voice Routes (/voice/*)       │ │
│  │  - Incoming call handler           │ │
│  │  - IVR menu processor              │ │
│  │  - Conversation flow controller    │ │
│  │  - Call status callbacks           │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │   Analytics Routes (/analytics/*)  │ │
│  │  - Dashboard data                  │ │
│  │  - Call logs and metrics           │ │
│  │  - Performance reports             │ │
│  └────────────────────────────────────┘ │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ IVR Service │  │LLM Service  │
│  - Intent   │  │- Claude AI  │
│  - Routing  │  │- Context    │
│  - State    │  │- History    │
└──────┬──────┘  └──────┬──────┘
       │                │
       ▼                ▼
┌──────────────────────────────────────────┐
│         Core AI Services                 │
│                                           │
│  ┌────────────┐  ┌────────────────────┐  │
│  │    STT     │  │       LLM          │  │
│  │  Whisper   │  │   Claude/GPT       │  │
│  │  (OpenAI)  │  │  (Anthropic)       │  │
│  └────────────┘  └────────────────────┘  │
│                                           │
│  ┌────────────┐  ┌────────────────────┐  │
│  │    TTS     │  │       CRM          │  │
│  │ ElevenLabs │  │  Integrations      │  │
│  │  (SA Voice)│  │  - Salesforce      │  │
│  └────────────┘  └────────────────────┘  │
└──────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│      Data & Compliance Layer             │
│  - Call Logs                             │
│  - POPIA Compliance                      │
│  - Audit Trails                          │
│  - Analytics Database                    │
└──────────────────────────────────────────┘
```

## Component Details

### 1. Telephony Layer (Twilio)

**Purpose**: Handle phone call connectivity and basic call control

**Key Functions**:
- Provide South African phone numbers (021, 011, 087, 0800)
- Route inbound calls to webhook endpoints
- Handle call transfers to human agents
- Record calls (with consent)
- Send SMS for payment links, tracking updates, etc.

**Files**:
- `src/services/telephony.js`

**External Dependencies**:
- Twilio Programmable Voice API
- Twilio TwiML for call flow control

### 2. Express Server Layer

**Purpose**: Central application server handling HTTP requests and orchestrating services

**Key Functions**:
- Receive Twilio webhook callbacks
- Route requests to appropriate handlers
- Manage application state
- Serve analytics endpoints
- Health monitoring

**Files**:
- `src/index.js` - Main server
- `src/routes/voice.js` - Voice call handlers
- `src/routes/analytics.js` - Analytics endpoints
- `src/config/config.js` - Configuration management

**Endpoints**:
- `POST /voice/incoming` - Initial call handler
- `POST /voice/process-input` - Process user speech
- `POST /voice/ivr-menu` - Display IVR menu
- `POST /voice/ivr-selection` - Handle menu selection
- `POST /voice/conversation` - Ongoing AI conversation
- `POST /voice/status` - Call status callbacks
- `GET /analytics/dashboard` - Analytics dashboard
- `GET /analytics/calls` - Call logs

### 3. IVR Service

**Purpose**: Intelligent call routing and menu management

**Key Functions**:
- Maintain call state for each active call
- Analyze caller intent from speech
- Route calls to appropriate department or agent
- Determine if AI can handle or needs human escalation
- Generate handoff summaries for human agents

**Files**:
- `src/services/ivr.js`

**State Management**:
```javascript
{
  callSid: string,
  callerNumber: string,
  currentState: 'greeting' | 'menu' | 'ai_conversation' | 'transfer',
  selectedDepartment: string,
  intent: string,
  sentiment: 'positive' | 'neutral' | 'negative',
  urgency: 'low' | 'medium' | 'high' | 'critical',
  conversationTurns: number,
  transferAttempts: number
}
```

### 4. Speech-to-Text Service (STT)

**Purpose**: Convert caller's speech to text for AI processing

**Provider**: OpenAI Whisper API

**Key Functions**:
- Transcribe audio from Twilio
- Support multiple languages (English, Afrikaans)
- Handle both file-based and streaming audio
- Detect language automatically

**Files**:
- `src/services/stt.js`

**API Usage**:
```javascript
const text = await sttService.transcribe(audioBuffer, 'en');
```

### 5. Text-to-Speech Service (TTS)

**Purpose**: Generate natural-sounding South African voice responses

**Provider**: ElevenLabs

**Key Functions**:
- Generate speech from AI responses
- Use authentic South African accent
- Support emotional tone control
- Stream audio for real-time responses

**Files**:
- `src/services/tts.js`

**Voice Configuration**:
- Model: `eleven_multilingual_v2`
- Stability: 0.5 (natural variation)
- Similarity Boost: 0.75 (voice consistency)
- Speaker Boost: Enabled

### 6. LLM Service (Large Language Model)

**Purpose**: Generate intelligent, context-aware responses

**Provider**: Anthropic Claude (primary), OpenAI GPT (fallback)

**Key Functions**:
- Maintain conversation history per call
- Generate contextual responses
- Analyze customer intent and sentiment
- Determine escalation needs
- Generate call summaries for handoff

**Files**:
- `src/services/llm.js`

**Conversation Context**:
```javascript
{
  department: string,
  intent: string,
  callerInfo: {
    phone: string,
    previousCalls: number,
    customerStatus: string
  }
}
```

**System Prompt Structure**:
- Role definition (South African call center agent)
- Guidelines (friendly, concise, use SA expressions)
- Current context (department, caller info)
- Task instructions (collect info, resolve issue)

### 7. CRM Service

**Purpose**: Integrate with business systems and provide tool calling for AI

**Key Functions**:
- Fetch customer information by phone number
- Retrieve order status and tracking
- Create support tickets
- Schedule callbacks
- Update customer records
- Generate payment links

**Files**:
- `src/services/crm.js`

**Tool Definitions** (for LLM function calling):
- `get_customer_info` - Retrieve customer data
- `get_order_status` - Check order/shipment status
- `create_support_ticket` - Create new ticket
- `schedule_callback` - Schedule agent callback
- `get_account_balance` - Check billing status

**Integration Points**:
- Salesforce (via REST API)
- HubSpot (via API)
- Zoho (via API)
- Custom CRM systems

### 8. Compliance & Logging

**Purpose**: Ensure POPIA compliance and maintain audit trails

**Key Functions**:
- Record call consent
- Handle data subject requests (access, deletion, correction)
- Maintain do-not-call lists
- Generate compliance reports
- Anonymize data for analytics
- Enforce retention policies

**Files**:
- `src/utils/compliance.js`
- `src/utils/logger.js`

**POPIA Requirements**:
- ✅ Consent recording for call recording
- ✅ Data subject access requests
- ✅ Right to deletion
- ✅ Right to correction
- ✅ Marketing consent (opt-in)
- ✅ Secure data storage
- ✅ Audit trails
- ✅ Retention policies (90 days default)

## Data Flow

### Incoming Call Flow

```
1. Caller dials → Twilio receives call
2. Twilio → POST /voice/incoming (CallSid, From, To)
3. Server → Initialize call state in IVR
4. Server → Generate greeting TwiML (with consent message)
5. Twilio → Play greeting to caller
6. Caller → Speaks their request
7. Twilio → POST /voice/process-input (SpeechResult)
8. Server → STT Service (if needed)
9. Server → LLM Service analyzes intent
10. Server → IVR Service determines routing
11a. If AI handles: Continue to conversation loop
11b. If human needed: Transfer to agent
```

### AI Conversation Loop

```
1. Caller speaks
2. Twilio → POST /voice/conversation (SpeechResult)
3. Server → LLM generates response (with context)
4. Server → Check escalation criteria
5a. If continue AI: Generate TTS → Twilio plays audio
5b. If escalate: Transfer to human agent
6. Repeat until call resolved or transferred
```

### Call Recording & Compliance

```
1. Call starts → Play consent message
2. Compliance Manager → Record consent
3. Call proceeds with recording enabled
4. Call ends → Recording saved to Twilio
5. Transcription generated → Stored securely
6. Compliance Logger → Audit trail created
7. After retention period → Auto-delete
```

## Scalability Considerations

### Current Architecture
- Single Node.js process
- In-memory state management
- Suitable for: <100 concurrent calls

### Scaling to Production

**1. Horizontal Scaling**
```
┌─────────┐
│ Caller  │
└────┬────┘
     │
     ▼
┌─────────────┐
│Load Balancer│
└──────┬──────┘
       │
   ┌───┴───┬───────┐
   ▼       ▼       ▼
┌─────┐ ┌─────┐ ┌─────┐
│ App │ │ App │ │ App │
│ VM1 │ │ VM2 │ │ VM3 │
└──┬──┘ └──┬──┘ └──┬──┘
   └───────┴───────┘
         │
         ▼
   ┌──────────┐
   │  Redis   │ (Shared state)
   └──────────┘
```

**2. Database Integration**
- Replace in-memory Map() with PostgreSQL/MongoDB
- Store call logs persistently
- Enable analytics across time

**3. Message Queue**
- Use RabbitMQ or AWS SQS for async tasks
- Process recordings in background
- Generate summaries asynchronously

**4. CDN for Audio Assets**
- Store generated TTS files in S3/CloudFront
- Reduce latency for common phrases
- Cache IVR menu audio

## Security Considerations

### API Keys
- Store in environment variables (never commit)
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys regularly

### Call Data
- Encrypt recordings at rest
- Use HTTPS for all webhooks
- Mask phone numbers in logs

### Authentication
- Validate Twilio requests with signatures
- Use API keys for CRM integrations
- Implement rate limiting

### POPIA Compliance
- Obtain consent before recording
- Provide opt-out mechanisms
- Honor data deletion requests
- Maintain audit logs

## Monitoring & Observability

### Metrics to Track
- Call volume (by hour, day, week)
- Average call duration
- AI resolution rate (% calls not transferred)
- Sentiment distribution
- Department breakdown
- API latency (Whisper, Claude, ElevenLabs)

### Logging
- Structured logs (JSON format)
- Log levels (INFO, WARN, ERROR, COMPLIANCE)
- Centralized logging (ELK stack, CloudWatch)

### Alerting
- API failures (Twilio, OpenAI, ElevenLabs, Claude)
- High call volume
- Negative sentiment spikes
- System errors

## Cost Optimization

### Reduce Costs By:
1. **Cache common responses** - Store TTS for FAQ answers
2. **Optimize LLM usage** - Use shorter prompts, limit history
3. **Batch processing** - Generate TTS for IVR once, reuse
4. **Smart routing** - Route simple queries to cheaper models
5. **Compression** - Use audio compression for recordings

### Current Cost per Call (5 min average)
- Twilio: $0.027 × 5 = $0.135
- Whisper: $0.006 × 5 = $0.030
- ElevenLabs: ~$0.022 (30 chars)
- Claude: ~$0.015 (API calls)
**Total: ~$0.20 per call**

## Future Enhancements

1. **Multi-language support** - Add Afrikaans, Zulu, Xhosa
2. **Sentiment analysis** - Real-time emotion detection
3. **Call analytics ML** - Predict escalation probability
4. **Proactive outreach** - AI-initiated callback campaigns
5. **WhatsApp integration** - Omnichannel support
6. **Voice biometrics** - Customer authentication
7. **Custom voice cloning** - Brand-specific voice
8. **A/B testing** - Experiment with prompts and voices
