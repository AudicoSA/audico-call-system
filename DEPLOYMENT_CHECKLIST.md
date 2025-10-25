# Audico Call System - Deployment Checklist

Use this checklist to ensure your system is production-ready.

## ☐ Phase 1: Development Setup (Local Testing)

### Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Add Twilio Account SID
- [ ] Add Twilio Auth Token
- [ ] Add Twilio Phone Number (+27...)
- [ ] Add OpenAI API Key (with Whisper access)
- [ ] Add ElevenLabs API Key
- [ ] Add ElevenLabs Voice ID (South African voice)
- [ ] Add Anthropic API Key
- [ ] Set PORT (default: 3000)
- [ ] Set NODE_ENV to 'development'

### Dependencies
- [ ] Run `npm install`
- [ ] Verify all packages installed successfully
- [ ] No vulnerability warnings (or acceptable risks)

### Service Testing
- [ ] Run `node scripts/test-services.js`
- [ ] Verify Twilio client initializes
- [ ] Verify ElevenLabs TTS generates audio
- [ ] Verify Claude LLM generates responses
- [ ] Check available South African voices
- [ ] Test intent analysis

### Local Server
- [ ] Start server with `npm start`
- [ ] Server starts without errors
- [ ] Visit `http://localhost:3000/health` - returns healthy
- [ ] Visit `http://localhost:3000/` - returns API info

### Ngrok Setup (for local testing)
- [ ] Install ngrok: `npm install -g ngrok`
- [ ] Start ngrok: `ngrok http 3000`
- [ ] Copy HTTPS URL (e.g., `https://abc123.ngrok.io`)
- [ ] Keep ngrok running

### Twilio Configuration (Testing)
- [ ] Log into Twilio Console
- [ ] Go to Phone Numbers → Manage → Active Numbers
- [ ] Click your South African phone number
- [ ] Under "Voice & Fax":
  - [ ] "A call comes in": Webhook, `https://your-ngrok-url.ngrok.io/voice/incoming`, POST
  - [ ] "Call status changes": Webhook, `https://your-ngrok-url.ngrok.io/voice/status`, POST
- [ ] Save configuration
- [ ] Enable Call Recording (if needed)

### Test Call #1: Basic Flow
- [ ] Call your Twilio number from your phone
- [ ] Hear greeting and consent message
- [ ] Speak a request (e.g., "I need help with shipping")
- [ ] AI responds with South African voice
- [ ] Conversation continues
- [ ] Call completes successfully

### Test Call #2: IVR Menu
- [ ] Call Twilio number
- [ ] Don't speak during greeting
- [ ] Hear IVR menu (Press 1 for Sales, 2 for Shipping, etc.)
- [ ] Press a number (e.g., 3 for Support)
- [ ] Route to appropriate department
- [ ] AI agent responds correctly

### Test Call #3: Human Transfer
- [ ] Call Twilio number
- [ ] Say "I want to speak to a human" or "operator"
- [ ] System prepares to transfer
- [ ] (Note: Transfer may fail if agent numbers not configured - expected)

### Check Logs
- [ ] Review server console output
- [ ] No unexpected errors
- [ ] Call flow events logged correctly
- [ ] Check `logs/` directory created
- [ ] Review call logs

### Analytics Dashboard
- [ ] Visit `http://localhost:3000/analytics/dashboard`
- [ ] See call statistics
- [ ] Visit `http://localhost:3000/analytics/calls`
- [ ] See call logs from test calls

## ☐ Phase 2: Production Preparation

### Code Review
- [ ] Review all configuration in `src/config/config.js`
- [ ] Customize IVR menu options for your business
- [ ] Update consent message if needed
- [ ] Review LLM system prompts in `src/services/llm.js`
- [ ] Customize for your industry/domain

### Agent Configuration
- [ ] Update human agent phone numbers in `src/services/ivr.js` (line 216)
- [ ] Verify all department agents are reachable
- [ ] Test calling each agent number directly
- [ ] Set up fallback/voicemail for unavailable agents

### CRM Integration (if applicable)
- [ ] Add CRM API URL to `.env`
- [ ] Add CRM API Key to `.env`
- [ ] Update CRM methods in `src/services/crm.js`
- [ ] Test CRM connection
- [ ] Verify customer lookup works
- [ ] Test order status retrieval
- [ ] Test ticket creation

### Voice Optimization
- [ ] Listen to multiple test calls
- [ ] Adjust ElevenLabs voice settings if needed (stability, similarity)
- [ ] Consider cloning a specific voice if needed
- [ ] Test pronunciation of common terms
- [ ] Verify South African expressions sound natural

### Prompt Engineering
- [ ] Review system prompt in `src/services/llm.js`
- [ ] Add domain-specific knowledge
- [ ] Test with various customer scenarios
- [ ] Refine prompts based on response quality
- [ ] Add common FAQ responses

### Error Handling
- [ ] Test with poor audio quality
- [ ] Test with background noise
- [ ] Test when caller doesn't speak
- [ ] Test rapid menu navigation
- [ ] Verify graceful degradation

### Compliance (POPIA)
- [ ] Review consent message
- [ ] Enable call recording: `ENABLE_CALL_RECORDING=true`
- [ ] Test consent recording
- [ ] Verify recordings are stored securely
- [ ] Set up retention policy (default: 90 days)
- [ ] Test data subject access request flow
- [ ] Prepare privacy policy document

## ☐ Phase 3: Production Deployment

### Choose Hosting Platform
Select one:
- [ ] Heroku
- [ ] AWS (Elastic Beanstalk, EC2, ECS)
- [ ] Azure (App Service)
- [ ] Google Cloud (Cloud Run, App Engine)
- [ ] VPS (DigitalOcean, Linode, Vultr)

### Domain & SSL
- [ ] Purchase/configure domain name
- [ ] Set up DNS records
- [ ] Configure SSL certificate (Let's Encrypt recommended)
- [ ] Verify HTTPS is working

### Environment Variables (Production)
- [ ] Set all environment variables on hosting platform
- [ ] Change NODE_ENV to 'production'
- [ ] Use production API keys (not dev/test keys)
- [ ] Secure secrets (use secret manager if available)

### Database (if using)
- [ ] Set up PostgreSQL/MongoDB
- [ ] Configure connection string
- [ ] Run migrations (if applicable)
- [ ] Test database connectivity

### Deploy Application
- [ ] Push code to hosting platform
- [ ] Install dependencies on server
- [ ] Start application
- [ ] Check health endpoint: `https://your-domain.com/health`
- [ ] Review deployment logs

### Update Twilio Webhooks (Production)
- [ ] Go to Twilio Console → Phone Numbers
- [ ] Update "A call comes in": `https://your-domain.com/voice/incoming`
- [ ] Update "Call status changes": `https://your-domain.com/voice/status`
- [ ] Update Recording callbacks if used
- [ ] Save and verify

### Production Test Calls
- [ ] Make test call to verify greeting
- [ ] Test IVR menu navigation
- [ ] Test AI conversation
- [ ] Test human transfer
- [ ] Test from different numbers/locations
- [ ] Test during high load (multiple simultaneous calls)

### Monitoring Setup
- [ ] Set up application monitoring (New Relic, Datadog, etc.)
- [ ] Configure error alerting
- [ ] Set up uptime monitoring (Pingdom, UptimeRobot)
- [ ] Configure log aggregation (ELK, CloudWatch, etc.)
- [ ] Set up call volume alerts

### Performance Testing
- [ ] Test with 5 concurrent calls
- [ ] Test with 10 concurrent calls
- [ ] Monitor API latency (Whisper, Claude, ElevenLabs)
- [ ] Check memory usage
- [ ] Check CPU usage
- [ ] Verify no memory leaks

### Security Audit
- [ ] Verify API keys are not exposed
- [ ] Check webhook signature validation
- [ ] Review HTTPS configuration
- [ ] Test rate limiting
- [ ] Check CORS settings
- [ ] Review data encryption

## ☐ Phase 4: Go Live

### Documentation
- [ ] Prepare internal documentation for staff
- [ ] Document escalation procedures
- [ ] Create troubleshooting guide
- [ ] Document common issues and solutions

### Staff Training
- [ ] Train human agents on system
- [ ] Show how to access call logs
- [ ] Explain handoff process from AI
- [ ] Review dashboard and analytics
- [ ] Practice handling AI-transferred calls

### Communication
- [ ] Announce new phone number (if changed)
- [ ] Update website with phone number
- [ ] Update email signatures
- [ ] Update business cards
- [ ] Update Google My Business

### Soft Launch
- [ ] Enable for limited hours initially
- [ ] Monitor closely for first week
- [ ] Collect feedback from callers
- [ ] Gather feedback from agents
- [ ] Make adjustments as needed

### Full Launch
- [ ] Enable 24/7 operation
- [ ] Monitor daily for first month
- [ ] Review call analytics weekly
- [ ] Optimize prompts based on data
- [ ] Adjust routing rules if needed

## ☐ Phase 5: Ongoing Maintenance

### Daily
- [ ] Check health endpoint
- [ ] Review error logs
- [ ] Monitor call volume

### Weekly
- [ ] Review call analytics
- [ ] Check AI resolution rate
- [ ] Review customer satisfaction
- [ ] Check API usage and costs
- [ ] Review escalated calls

### Monthly
- [ ] Generate compliance report
- [ ] Review and optimize costs
- [ ] Update AI prompts if needed
- [ ] Check API rate limits
- [ ] Review security logs
- [ ] Update dependencies
- [ ] Backup call data

### Quarterly
- [ ] Review and update CRM integrations
- [ ] Evaluate new features to add
- [ ] Review POPIA compliance
- [ ] Audit data retention policies
- [ ] Review and optimize voice prompts
- [ ] Consider multi-language support

## 🚨 Emergency Procedures

### If System Goes Down
1. Check health endpoint
2. Review server logs
3. Check Twilio status page
4. Verify API keys are valid
5. Check rate limits
6. Restart server if needed
7. Notify customers if extended outage

### If Calls Fail
1. Test webhook URLs (curl/Postman)
2. Check Twilio webhook logs
3. Verify ngrok/domain is accessible
4. Check SSL certificate
5. Review server error logs
6. Test API services individually

### If Voice Quality Poor
1. Check ElevenLabs API status
2. Verify Voice ID is correct
3. Test TTS directly
4. Check network latency
5. Consider switching to backup TTS

### If AI Misbehaves
1. Review recent conversation logs
2. Check prompt configuration
3. Verify Claude API is working
4. Increase human escalation threshold
5. Temporarily route all to humans if critical

---

## ✅ Completion Checklist

- [ ] All Phase 1 items completed
- [ ] All Phase 2 items completed
- [ ] All Phase 3 items completed
- [ ] All Phase 4 items completed
- [ ] Phase 5 procedures scheduled
- [ ] Emergency procedures documented and accessible

---

**Congratulations! Your Audico Call System is production-ready!** 🎉

Track your checklist progress and update as needed throughout deployment.
