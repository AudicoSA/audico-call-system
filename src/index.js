/**
 * WORKING SIMPLE MULTI-AGENT SYSTEM
 *
 * Forget complex RAG - use Claude's intelligence with product context!
 * Claude is EXCELLENT at understanding products and answering questions.
 */

import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import syncRoutes from './routes/sync.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenCart MySQL Database Connection
const mysqlPool = mysql.createPool({
  host: process.env.OPENCART_DB_HOST,
  port: parseInt(process.env.OPENCART_DB_PORT || '3306'),
  user: process.env.OPENCART_DB_USER,
  password: process.env.OPENCART_DB_PASSWORD,
  database: process.env.OPENCART_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false,
});

const TABLE_PREFIX = process.env.OPENCART_TABLE_PREFIX || 'oc_';

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

// Register sync routes for automated daily product sync
app.use(syncRoutes);

// ============================================
// SHIPLOGIC WEBHOOK HANDLER
// ============================================

/**
 * ShipLogic webhook endpoint
 * Receives notifications when shipments are created/updated
 * Stores tracking info in OpenCart database
 */
app.post('/webhooks/shiplogic', async (req, res) => {
  try {
    console.log('📦 [SHIPLOGIC WEBHOOK] Received:', JSON.stringify(req.body, null, 2));

    // ShipLogic sends data directly at root level, not wrapped in {event, shipment}
    const shipment = req.body;

    if (!shipment || !shipment.shipment_id) {
      console.log('⚠️  [SHIPLOGIC WEBHOOK] No shipment data in request');
      return res.status(400).json({ error: 'No shipment data provided' });
    }

    // Extract order number from custom_tracking_reference (TCG waybill)
    // Format: "TCG28630" or "TCG28630/1"
    let orderNumber = null;

    if (shipment.custom_tracking_reference) {
      const orderMatch = shipment.custom_tracking_reference.match(/TCG(\d+)/i);
      if (orderMatch) {
        orderNumber = orderMatch[1];
      }
    }

    // Look up order in OpenCart
    let orderId = null;
    if (orderNumber) {
      const [rows] = await mysqlPool.execute(
        `SELECT order_id FROM ${TABLE_PREFIX}order WHERE order_id = ? LIMIT 1`,
        [parseInt(orderNumber)]
      );

      if (rows.length > 0) {
        orderId = rows[0].order_id;
        console.log(`✅ [SHIPLOGIC WEBHOOK] Matched to OpenCart order ${orderId}`);
      } else {
        console.log(`⚠️  [SHIPLOGIC WEBHOOK] Order ${orderNumber} not found in OpenCart`);
      }
    }

    // Store tracking information
    // Map ShipLogic fields to our database fields
    const trackingData = {
      order_id: orderId,
      order_number: orderNumber || 'UNKNOWN',
      shiplogic_shipment_id: shipment.shipment_id,
      shiplogic_reference: shipment.short_tracking_reference || shipment.shipment_id,
      tcg_waybill: shipment.custom_tracking_reference || null,
      tcg_order_reference: shipment.custom_tracking_reference || null,
      parcel_tracking_reference: shipment.parcel_tracking_references ? shipment.parcel_tracking_references[0] : null,
      status: shipment.status || 'pending',
      status_message: shipment.update_type || null,
      shipment_created_at: shipment.shipment_time_created || new Date(),
      last_updated_at: new Date(),
      webhook_received_at: new Date(),
      webhook_payload: JSON.stringify(shipment)
    };

    // Insert or update tracking record
    const query = `
      INSERT INTO oc_order_shiplogic_tracking (
        order_id, order_number, shiplogic_shipment_id,
        shiplogic_reference, tcg_waybill, tcg_order_reference,
        parcel_tracking_reference, status, status_message,
        shipment_created_at, last_updated_at, webhook_received_at,
        webhook_payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        tcg_waybill = VALUES(tcg_waybill),
        status = VALUES(status),
        status_message = VALUES(status_message),
        last_updated_at = VALUES(last_updated_at),
        webhook_payload = VALUES(webhook_payload)
    `;

    await mysqlPool.execute(query, [
      trackingData.order_id,
      trackingData.order_number,
      trackingData.shiplogic_shipment_id,
      trackingData.shiplogic_reference,
      trackingData.tcg_waybill,
      trackingData.tcg_order_reference,
      trackingData.parcel_tracking_reference,
      trackingData.status,
      trackingData.status_message,
      trackingData.shipment_created_at,
      trackingData.last_updated_at,
      trackingData.webhook_received_at,
      trackingData.webhook_payload
    ]);

    // Also insert status history
    if (orderId && shipment.status) {
      const historyQuery = `
        INSERT INTO oc_order_shiplogic_tracking_history (
          tracking_id, status, status_message, changed_at
        ) VALUES (
          (SELECT id FROM oc_order_shiplogic_tracking WHERE shiplogic_shipment_id = ?),
          ?, ?, ?
        )
      `;

      await mysqlPool.execute(historyQuery, [
        trackingData.shiplogic_shipment_id,
        shipment.status,
        shipment.status_message || null,
        new Date()
      ]);
    }

    // ============================================
    // UPDATE OPENCART ORDER STATUS & HISTORY
    // ============================================
    if (orderId) {
      // Determine OpenCart order status based on ShipLogic status
      let newOrderStatus = null;
      let statusComment = '';

      const shipStatus = (shipment.status || '').toLowerCase();

      if (shipStatus === 'submitted' || shipStatus === 'collection-assigned') {
        // New booking - set to "Courier Booked" (18)
        newOrderStatus = 18;
        statusComment = `Courier booked with The Courier Guy. Tracking: ${shipment.custom_tracking_reference || 'Pending'}. Reference: ${shipment.short_tracking_reference || ''}`;
      } else if (shipStatus === 'collected' || shipStatus === 'in-transit' || shipStatus === 'out-for-delivery') {
        // Shipped - set to "Shipped" (3)
        newOrderStatus = 3;
        statusComment = `Shipment ${shipStatus}. Tracking: ${shipment.custom_tracking_reference}. Current location: ${shipment.collection_hub || 'In transit'} → ${shipment.delivery_hub || 'Destination'}`;
      } else if (shipStatus === 'delivered') {
        // Delivered - set to "Complete" (5)
        newOrderStatus = 5;
        statusComment = `Order delivered successfully. Tracking: ${shipment.custom_tracking_reference}. Delivered on ${shipment.shipment_delivered_date || 'today'}.`;
      }

      if (newOrderStatus) {
        // Check current order status
        const [currentStatus] = await mysqlPool.execute(
          `SELECT order_status_id FROM ${TABLE_PREFIX}order WHERE order_id = ?`,
          [orderId]
        );

        const currentOrderStatus = currentStatus[0]?.order_status_id;

        // Only update if status has changed
        if (currentOrderStatus !== newOrderStatus) {
          // Update order status in oc_order table
          await mysqlPool.execute(
            `UPDATE ${TABLE_PREFIX}order SET order_status_id = ? WHERE order_id = ?`,
            [newOrderStatus, orderId]
          );

          // Add entry to oc_order_history
          await mysqlPool.execute(
            `INSERT INTO ${TABLE_PREFIX}order_history (order_id, order_status_id, notify, comment, date_added)
             VALUES (?, ?, 1, ?, NOW())`,
            [orderId, newOrderStatus, statusComment]
          );

          console.log(`✅ [OPENCART UPDATE] Order ${orderId} status updated to ${newOrderStatus}`);
          console.log(`   Comment: ${statusComment}`);
        } else {
          console.log(`ℹ️  [OPENCART UPDATE] Order ${orderId} already at status ${newOrderStatus}, skipping update`);
        }
      }
    }

    console.log(`✅ [SHIPLOGIC WEBHOOK] Tracking stored for order ${orderNumber || 'UNKNOWN'}`);
    console.log(`   ShipLogic ID: ${shipment.shipment_id}`);
    console.log(`   TCG Waybill: ${shipment.custom_tracking_reference || 'Not yet assigned'}`);
    console.log(`   Status: ${shipment.status || 'pending'}`);

    res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
      order_number: orderNumber,
      shiplogic_id: shipment.shipment_id
    });

  } catch (error) {
    console.error('❌ [SHIPLOGIC WEBHOOK] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test webhook endpoint (for manual testing)
app.get('/webhooks/shiplogic/test', async (req, res) => {
  res.json({
    status: 'ready',
    message: 'ShipLogic webhook endpoint is active',
    webhook_url: `${getBaseUrl(req)}/webhooks/shiplogic`,
    instructions: 'Configure this URL in ShipLogic webhook settings'
  });
});

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

/** Look up OpenCart order by ID */
async function lookupOrder(orderId) {
  console.log(`[OPENCART] Looking up order ${orderId}`);

  const [rows] = await mysqlPool.execute(
    `SELECT order_id, customer_id, firstname, lastname, email, telephone,
            order_status_id, total, currency_code, date_added, shipping_method
     FROM ${TABLE_PREFIX}order
     WHERE order_id = ?
     LIMIT 1`,
    [parseInt(orderId)]
  );

  if (rows.length === 0) {
    console.log(`[OPENCART] Order ${orderId} not found`);
    return null;
  }

  console.log(`[OPENCART] Order ${orderId} found`);
  return rows[0];
}

/** Get order products */
async function getOrderProducts(orderId) {
  const [rows] = await mysqlPool.execute(
    `SELECT order_product_id, product_id, name, model, quantity, price, total
     FROM ${TABLE_PREFIX}order_product
     WHERE order_id = ?`,
    [parseInt(orderId)]
  );

  console.log(`[OPENCART] Found ${rows.length} products for order ${orderId}`);
  return rows;
}

/** Get order history */
async function getOrderHistory(orderId) {
  const [rows] = await mysqlPool.execute(
    `SELECT order_history_id, order_status_id, notify, comment, date_added
     FROM ${TABLE_PREFIX}order_history
     WHERE order_id = ?
     ORDER BY date_added DESC`,
    [parseInt(orderId)]
  );

  console.log(`[OPENCART] Found ${rows.length} history entries for order ${orderId}`);
  return rows;
}

/** Extract tracking number from order history */
function extractTrackingNumber(history) {
  if (!history || history.length === 0) return null;

  for (const entry of history) {
    if (!entry.comment) continue;

    // Check for tracking URLs
    const urlMatch = entry.comment.match(/https?:\/\/[^\s]+/);
    if (urlMatch) return urlMatch[0];

    // Check for tracking ref numbers
    const refMatch = entry.comment.match(/ref[=:]\s*([A-Z0-9\-]+)/i);
    if (refMatch) return refMatch[1];
  }

  return null;
}

/** Check if order needs shipping update (>2 days old without tracking) */
function needsShippingUpdate(order, history) {
  if (!order || !order.date_added) return false;

  const orderDate = new Date(order.date_added);
  const now = new Date();
  const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);

  if (daysDiff < 2) return false;

  const hasTracking = extractTrackingNumber(history) !== null;
  return !hasTracking;
}

/** Format comprehensive shipping response */
function formatShippingResponse(order, products, history) {
  if (!order) {
    return { text: 'Order not found', needsUpdate: false };
  }

  const orderId = order.order_id;
  const orderDate = new Date(order.date_added);
  const dateStr = orderDate.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const total = `R${parseFloat(order.total || 0).toFixed(2)}`;

  const trackingInfo = extractTrackingNumber(history);
  const needsUpdate = needsShippingUpdate(order, history);

  let response = 'Let me check that for you. ';

  // Confirm product
  if (products && products.length > 0) {
    const productNames = products.map(p => `${p.name} quantity ${p.quantity}`).join(', ');
    response += `I can confirm your order for ${productNames}. `;
  }

  response += `This order was placed on ${dateStr} with a total of ${total}. `;

  // Status
  const statusMap = {
    1: 'pending payment',
    2: 'being processed',
    3: 'shipped',
    5: 'complete',
    7: 'cancelled',
    10: 'failed',
    11: 'refunded',
    18: 'shipped',
    29: 'awaiting collection',
  };

  const statusName = statusMap[order.order_status_id] || 'being processed';
  response += `The current status is ${statusName}. `;

  // Tracking
  if (trackingInfo) {
    if (trackingInfo.startsWith('http')) {
      // Extract tracking number from URL (after ref= or ref:)
      const refMatch = trackingInfo.match(/ref[=:]([A-Z0-9\-]+)/i);
      if (refMatch) {
        response += `Shipped with The Courier Guy. Tracking ${refMatch[1]}. `;
      } else {
        response += `Your tracking information is available at: ${trackingInfo}. `;
      }
    } else {
      response += `Tracking reference ${trackingInfo}. `;
    }
  }

  // Check if needs update
  if (needsUpdate) {
    response += `I notice this order is more than 2 days old and doesn't have shipping information yet. I will request an immediate update from our logistics team and have them send you the tracking details as soon as possible. `;
  }

  return { text: response, needsUpdate, tracking: trackingInfo };
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

    shipping: `You are a shipping specialist for Audico, a South African electronics retailer.

When a customer asks about their order, follow this EXACT sequence:

1. IMMEDIATELY say: "Let me login to our system"
2. Ask for: order number (if not already provided)
3. Use the track_order tool to look up the order in OpenCart database
4. Read the tool result CAREFULLY - it contains the REAL order information
5. Repeat back ONLY what the tool result says - do not make up ANY information
6. DO NOT invent delivery dates, signed-for names, or tracking numbers
7. If the tool says "Order not found", tell the customer exactly that

CRITICAL: NEVER make up information. ONLY say what the track_order tool returns.

Keep responses SHORT and based ONLY on the tool result.`,

    support: `You are a technical support specialist for Audico.
Help with product troubleshooting and technical questions.
Keep responses SHORT (2-3 sentences).`,

    accounts: `You are an accounts specialist for Audico.
Help with billing and payment questions.
Keep responses SHORT (2-3 sentences).`
  };

  // Define tools based on agent type (OpenAI format)
  let tools = undefined;

  if (agentType === 'sales') {
    tools = [
      {
        type: 'function',
        function: {
          name: 'search_products',
          description: 'Search Audico product catalog in real-time. Use this EVERY TIME a customer asks about a product. Search by brand name, model number, product type, or SKU.',
          parameters: {
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
      }
    ];
  } else if (agentType === 'shipping') {
    tools = [
      {
        type: 'function',
        function: {
          name: 'track_order',
          description: 'Look up an order in OpenCart database by order ID. Returns REAL order information including products, date, status, and tracking number. DO NOT make up information - only use what this tool returns.',
          parameters: {
            type: 'object',
            properties: {
              order_id: {
                type: 'string',
                description: 'Order ID number (e.g., "28630", "28645")'
              }
            },
            required: ['order_id']
          }
        }
      }
    ];
  }

  try {
    // Prepare messages with system prompt
    const messages = [
      { role: 'system', content: systemPrompts[agentType] || systemPrompts.receptionist },
      ...history
    ];

    let response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: messages,
      tools: tools,
      tool_choice: tools ? 'auto' : undefined,
    });

    const message = response.choices[0].message;

    // Handle tool calls (OpenAI format)
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`[TOOL CALLS] ${message.tool_calls.length} tool(s) called`);

      // Add assistant message with tool calls to history
      history.push(message);

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[TOOL CALL] ${functionName} with:`, functionArgs);

        let toolResult;

        if (functionName === 'search_products') {
          const products = await searchProducts(functionArgs.query, functionArgs.limit || 10);
          toolResult = products.length > 0 ? products : [{ message: 'No products found matching that search' }];
        } else if (functionName === 'track_order') {
          const orderId = functionArgs.order_id;
          const order = await lookupOrder(orderId);

          if (!order) {
            toolResult = { error: `Order ${orderId} not found in our system` };
          } else {
            const products = await getOrderProducts(orderId);
            const orderHistory = await getOrderHistory(orderId);

            // Check ShipLogic tracking database first
            const [trackingRows] = await mysqlPool.execute(
              `SELECT tcg_waybill, shiplogic_reference, status, status_message, last_updated_at
               FROM oc_order_shiplogic_tracking
               WHERE order_id = ?
               ORDER BY last_updated_at DESC
               LIMIT 1`,
              [parseInt(orderId)]
            );

            // If we have ShipLogic tracking, add it to the response
            if (trackingRows.length > 0) {
              const tracking = trackingRows[0];
              console.log(`✅ [TRACKING] Found ShipLogic tracking for order ${orderId}: ${tracking.tcg_waybill || tracking.shiplogic_reference}`);

              // Add tracking to history for the formatter
              if (tracking.tcg_waybill) {
                orderHistory.unshift({
                  comment: `Tracking: ${tracking.tcg_waybill} - Status: ${tracking.status || 'pending'}`,
                  date_added: tracking.last_updated_at
                });
              }
            }

            const shippingResponse = formatShippingResponse(order, products, orderHistory);
            toolResult = shippingResponse;
          }
        }

        // Add tool result to history
        history.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(toolResult, null, 2)
        });
      }

      // Get final response with tool results
      const finalMessages = [
        { role: 'system', content: systemPrompts[agentType] || systemPrompts.receptionist },
        ...history
      ];

      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: finalMessages,
        tools: tools,
        tool_choice: 'none', // Don't call tools again
      });
    }

    const aiMessage = response.choices[0].message.content;

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
    return 'Sorry, I did not catch that. Could you please repeat?';
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
    twiml += `<Say voice="Polly.Ayanda" language="en-ZA">${message}</Say>`;
  }

  twiml += `<Gather input="speech" action="${baseUrl}${nextUrl}" language="en-ZA" speechTimeout="auto">`;
  twiml += '<Say voice="Polly.Ayanda" language="en-ZA"></Say>';
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
    twiml += '<Say voice="Polly.Ayanda" language="en-ZA"></Say>';
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
