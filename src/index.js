/**
 * WORKING SIMPLE MULTI-AGENT SYSTEM
 *
 * Forget complex RAG - use Claude's intelligence with product context!
 * Claude is EXCELLENT at understanding products and answering questions.
 */

import express from 'express';
import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Voice IDs
const AGENT_VOICES = {
  receptionist: process.env.RECEPTIONIST_VOICE_ID || 'tFbs0XxZ7TP2yWyrfBty',
  sales: process.env.SALES_VOICE_ID || 'fPVZbr0RJBH9KL47pnxU',
  shipping: process.env.SHIPPING_VOICE_ID || 'YPtbPhafrxFTDAeaPP4w',
  support: process.env.SUPPORT_VOICE_ID || 'fPVZbr0RJBH9KL47pnxU',
  accounts: process.env.ACCOUNTS_VOICE_ID || 'xeBpkkuzgxa0IwKt7NTP',
};

const callStates = new Map();
const callTranscripts = new Map(); // Store completed call transcripts
const audioDir = path.join(__dirname, 'audio-cache');
const transcriptsDir = path.join(__dirname, 'transcripts');
await fs.mkdir(audioDir, { recursive: true });
await fs.mkdir(transcriptsDir, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/audio', express.static(audioDir));

// Check database connection at startup
async function checkDatabase() {
  console.log('Checking database connection...');
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .gt('total_stock', 0);

  if (error) {
    console.error('❌ Database error:', error.message);
    return 0;
  }

  console.log(`✅ Connected to database: ${count} products available`);
  return count;
}

// Check database at startup
const productCount = await checkDatabase();

/** Generate speech */
async function generateSpeech(text, filename, voiceId) {
  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        text: text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.85,
          style: 0.0,
          use_speaker_boost: true
        },
      },
      responseType: 'arraybuffer',
    });

    const audioPath = path.join(audioDir, filename);
    await fs.writeFile(audioPath, Buffer.from(response.data));
    return filename;
  } catch (error) {
    console.error('[TTS] Error:', error.message);
    return null;
  }
}

/** Search products in database - used by AI tools */
async function searchProducts(query, limit = 10) {
  console.log(`[DB SEARCH] Query: "${query}"`);

  const { data, error } = await supabase
    .from('products')
    .select('product_name, sku, brand, category_name, selling_price, total_stock')
    .eq('active', true)
    .gt('total_stock', 0)
    .or(`product_name.ilike.%${query}%,brand.ilike.%${query}%,sku.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    console.error('[DB SEARCH] Error:', error);
    return [];
  }

  console.log(`[DB SEARCH] Found ${data?.length || 0} results`);
  return data || [];
}

/** Get AI response with product knowledge */
async function getAgentResponse(userMessage, callSid, agentType) {
  const state = callStates.get(callSid) || { history: [], agent: 'receptionist' };
  const history = state.history;

  history.push({ role: 'user', content: userMessage });

  const systemPrompts = {
    receptionist: `You are the friendly receptionist for Audico, a South African electronics retailer.

Route customers to the right department:
- Sales: Product questions, purchases, pricing
- Shipping: Order tracking, delivery
- Support: Technical issues, troubleshooting
- Accounts: Billing, invoices

Keep responses VERY SHORT (1 sentence).

When you know the department, say: "Let me connect you to our [department] team."`,

    sales: `You are a sales specialist for Audico, a South African electronics retailer.

We have 15,000+ products in stock. You have access to REAL-TIME product search via the search_products tool.

Your job:
- Help customers find products using the search_products tool
- Provide accurate pricing and stock information from search results
- Answer questions enthusiastically
- Close sales

CRITICAL PRONUNCIATION RULES:
- ALWAYS write prices as "X thousand Y hundred rand" or "X rand" (NOT "R123" or "ZAR")
- Example: 8990 = "eight thousand nine hundred and ninety rand"
- Example: 164290 = "one hundred and sixty-four thousand two hundred and ninety rand"
- Example: 10190 = "ten thousand one hundred and ninety rand"

RESPONSE STYLE:
- When customer asks for a product, ALWAYS use search_products tool first
- IMMEDIATELY say: "Let me check that for you..." then use the tool
- Keep responses SHORT (2-3 sentences max)
- Be natural and conversational
- Use search results as your source of truth!

If search returns no results, suggest they speak with a specialist or ask for similar products.`,

    shipping: `You are a shipping specialist for Audico.
Help with order tracking and delivery questions.
Keep responses SHORT (2-3 sentences).`,

    support: `You are a technical support specialist for Audico.
Help with product troubleshooting and technical questions.
Keep responses SHORT (2-3 sentences).`,

    accounts: `You are an accounts specialist for Audico.
Help with billing and payment questions.
Keep responses SHORT (2-3 sentences).`
  };

  // Define tools for sales agent
  const tools = agentType === 'sales' ? [
    {
      name: 'search_products',
      description: 'Search Audico product catalog in real-time. Use this EVERY TIME a customer asks about a product. Search by brand name, model number, product type, or SKU.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - brand, model, product type, or SKU (e.g., "Denon AVR-X1800H", "wireless headphones", "JBL")'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results (default 10)',
            default: 10
          }
        },
        required: ['query']
      }
    }
  ] : undefined;

  try {
    let response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompts[agentType] || systemPrompts.receptionist,
      messages: history,
      tools: tools,
    });

    // Handle tool use (product search)
    if (response.stop_reason === 'tool_use') {
      // Check if there's any text response alongside the tool call
      const textBlocks = response.content.filter(block => block.type === 'text');
      const hasAcknowledgment = textBlocks.length > 0 && textBlocks.some(b => b.text.length > 10);

      // If no acknowledgment text, force one
      if (!hasAcknowledgment) {
        console.log('[FORCING ACKNOWLEDGMENT] AI used tool without speaking first');
        // Return immediate acknowledgment, don't use tool yet
        return "Let me check that for you - give me just a moment...";
      }

      const assistantMessage = response.content;
      history.push({ role: 'assistant', content: assistantMessage });

      const toolResults = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`[TOOL CALL] ${block.name} with:`, block.input);

          let toolResult;
          if (block.name === 'search_products') {
            const products = await searchProducts(block.input.query, block.input.limit || 10);
            toolResult = products.length > 0 ? products : [{ message: 'No products found matching that search' }];
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(toolResult, null, 2)
          });
        }
      }

      // Send tool results back to Claude
      history.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompts[agentType] || systemPrompts.receptionist,
        messages: history,
        tools: tools,
      });
    }

    const aiMessage = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join(' ');

    console.log(`[AI-${agentType}] Response:`, aiMessage.substring(0, 100) + '...');

    history.push({ role: 'assistant', content: aiMessage });

    if (history.length > 10) {
      state.history = history.slice(-10);
    } else {
      state.history = history;
    }

    callStates.set(callSid, state);
    return aiMessage;
  } catch (error) {
    console.error(`[AI-${agentType}] Error:`, error.message);
    return 'I apologize, I need to transfer you to a specialist.';
  }
}

function getBaseUrl(req) {
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

function createTwiML(message, audioFile, nextUrl, req) {
  const baseUrl = getBaseUrl(req);
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  twiml += '<Pause length="1"/>';

  if (audioFile) {
    twiml += `<Play>${baseUrl}/audio/${audioFile}</Play>`;
  } else {
    twiml += `<Say voice="Polly.Joanna" language="en-ZA">${message}</Say>`;
  }

  twiml += `<Gather input="speech" action="${baseUrl}${nextUrl}" language="en-ZA" speechTimeout="auto">`;
  twiml += '<Say voice="Polly.Joanna" language="en-ZA"></Say>';
  twiml += '</Gather>';
  twiml += '</Response>';

  return twiml;
}

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Multi-Agent System with Real-Time Product Search!',
    database_connected: productCount > 0,
    total_products: productCount,
  });
});

// View all transcripts
app.get('/admin/transcripts', async (req, res) => {
  try {
    const files = await fs.readdir(transcriptsDir);
    const transcriptFiles = files.filter(f => f.endsWith('.json'));

    const transcripts = [];
    for (const file of transcriptFiles.slice(-20)) { // Last 20 calls
      const content = await fs.readFile(path.join(transcriptsDir, file), 'utf-8');
      transcripts.push(JSON.parse(content));
    }

    res.json({
      success: true,
      count: transcripts.length,
      total_stored: transcriptFiles.length,
      transcripts: transcripts.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View specific transcript
app.get('/admin/transcript/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;

    // Check memory first
    if (callTranscripts.has(callSid)) {
      return res.json({ success: true, transcript: callTranscripts.get(callSid) });
    }

    // Search files
    const files = await fs.readdir(transcriptsDir);
    const matchingFile = files.find(f => f.startsWith(callSid));

    if (matchingFile) {
      const content = await fs.readFile(path.join(transcriptsDir, matchingFile), 'utf-8');
      return res.json({ success: true, transcript: JSON.parse(content) });
    }

    res.status(404).json({ error: 'Transcript not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/voice/incoming', async (req, res) => {
  const callSid = req.body.CallSid;
  const from = req.body.From;

  console.log('');
  console.log('📞 INCOMING CALL:', callSid, 'from', from);

  callStates.set(callSid, {
    agent: 'receptionist',
    history: [],
    from,
    transcript: [],
    startTime: new Date()
  });

  const greeting = 'Welcome to Audico. How may I direct your call today?';
  const audioFile = await generateSpeech(greeting, `${callSid}-greeting.mp3`, AGENT_VOICES.receptionist);

  // Log transcript
  const state = callStates.get(callSid);
  state.transcript.push({
    timestamp: new Date(),
    speaker: 'AI-receptionist',
    text: greeting
  });

  const twiml = createTwiML(greeting, audioFile, '/voice/conversation', req);
  res.type('text/xml').send(twiml);
});

app.post('/voice/conversation', async (req, res) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult || '';

  console.log('💬', callSid, ':', speechResult);

  if (!speechResult) {
    const twiml = createTwiML('Sorry, I did not hear that. Could you please repeat?', null, '/voice/conversation', req);
    return res.type('text/xml').send(twiml);
  }

  const state = callStates.get(callSid) || { agent: 'receptionist', history: [], transcript: [] };

  // Log customer speech to transcript
  if (state.transcript) {
    state.transcript.push({
      timestamp: new Date(),
      speaker: 'Customer',
      text: speechResult
    });
  }

  const aiResponse = await getAgentResponse(speechResult, callSid, state.agent);

  // Log AI response to transcript
  if (state.transcript) {
    state.transcript.push({
      timestamp: new Date(),
      speaker: `AI-${state.agent}`,
      text: aiResponse
    });
  }

  // Check for routing
  const routingMatch = aiResponse.match(/connect you to our (sales|shipping|support|accounts) team/i);

  if (routingMatch && state.agent === 'receptionist') {
    const department = routingMatch[1].toLowerCase();
    console.log(`🔄 ROUTING TO: ${department}`);

    state.agent = department;
    state.history = [];
    callStates.set(callSid, state);

    const audioFile = await generateSpeech(aiResponse, `${callSid}-routing.mp3`, AGENT_VOICES.receptionist);

    const baseUrl = getBaseUrl(req);
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (audioFile) {
      twiml += `<Play>${baseUrl}/audio/${audioFile}</Play>`;
    }

    twiml += '<Pause length="1"/>';

    const agentGreeting = `Hello, this is ${department}. How can I help you today?`;
    const agentAudioFile = await generateSpeech(agentGreeting, `${callSid}-${department}-greeting.mp3`, AGENT_VOICES[department]);

    if (agentAudioFile) {
      twiml += `<Play>${baseUrl}/audio/${agentAudioFile}</Play>`;
    }

    twiml += `<Gather input="speech" action="${baseUrl}/voice/conversation" language="en-ZA" speechTimeout="auto">`;
    twiml += '<Say voice="Polly.Joanna" language="en-ZA"></Say>';
    twiml += '</Gather>';
    twiml += '</Response>';

    return res.type('text/xml').send(twiml);
  }

  // Check for goodbye
  if (/goodbye|bye|thank you|thanks/i.test(speechResult)) {
    const audioFile = await generateSpeech(aiResponse, `${callSid}-goodbye.mp3`, AGENT_VOICES[state.agent]);

    const baseUrl = getBaseUrl(req);
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (audioFile) {
      twiml += `<Play>${baseUrl}/audio/${audioFile}</Play>`;
    }

    twiml += '<Hangup/></Response>';

    callStates.delete(callSid);
    return res.type('text/xml').send(twiml);
  }

  // Continue conversation
  const audioFile = await generateSpeech(aiResponse, `${callSid}-${Date.now()}.mp3`, AGENT_VOICES[state.agent]);

  const twiml = createTwiML(aiResponse, audioFile, '/voice/conversation', req);
  res.type('text/xml').send(twiml);
});

app.post('/voice/status', async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;

  if (callStatus === 'completed') {
    const state = callStates.get(callSid);

    // Save transcript before deleting
    if (state && state.transcript && state.transcript.length > 0) {
      const transcriptData = {
        callSid,
        from: state.from,
        startTime: state.startTime,
        endTime: new Date(),
        duration: state.startTime ? Math.floor((new Date() - state.startTime) / 1000) : 0,
        agent: state.agent,
        transcript: state.transcript
      };

      // Save to file
      const filename = `${callSid}-${Date.now()}.json`;
      const filepath = path.join(transcriptsDir, filename);
      await fs.writeFile(filepath, JSON.stringify(transcriptData, null, 2));

      // Store in memory for quick access
      callTranscripts.set(callSid, transcriptData);

      console.log(`📝 Transcript saved: ${filename}`);
    }

    callStates.delete(callSid);
  }

  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  MULTI-AGENT WITH REAL-TIME SEARCH!');
  console.log('========================================');
  console.log(`  Port: ${PORT}`);
  console.log('');
  console.log(`  ✅ Database: ${productCount} products available`);
  console.log('  ✅ Real-time product search enabled');
  console.log('  ✅ Full catalog access (15,000+ products)');
  console.log('  ✅ Call transcription enabled');
  console.log('');
  console.log('  Voice IDs:');
  for (const [agent, voiceId] of Object.entries(AGENT_VOICES)) {
    console.log(`  - ${agent}: ${voiceId}`);
  }
  console.log('');
  console.log('  Ready for calls!');
  console.log('========================================');
});
