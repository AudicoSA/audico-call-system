import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config/config.js';
import { productService } from './product.js';
import { orderTrackingService } from './order-tracking.js';

/**
 * LLM service for conversation handling
 * Supports both Claude and GPT models
 */
export class LLMService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });

    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.conversationHistory = new Map();
  }

  /**
   * Generate a response using Claude
   * @param {string} userMessage - User's message
   * @param {string} callSid - Unique call identifier
   * @param {object} context - Additional context (caller info, intent, etc.)
   * @returns {Promise<string>} - AI response
   */
  async generateResponse(userMessage, callSid, context = {}) {
    try {
      // Get or create conversation history
      if (!this.conversationHistory.has(callSid)) {
        this.conversationHistory.set(callSid, []);
      }

      const history = this.conversationHistory.get(callSid);

      // Build system prompt based on context
      const systemPrompt = this.buildSystemPrompt(context);

      // Add user message to history
      history.push({
        role: 'user',
        content: userMessage,
      });

      console.log('[LLM] Generating response for:', userMessage);

      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
      });

      const assistantMessage = response.content[0].text;

      // Add assistant response to history
      history.push({
        role: 'assistant',
        content: assistantMessage,
      });

      console.log('[LLM] Response generated:', assistantMessage.substring(0, 100) + '...');

      return assistantMessage;
    } catch (error) {
      console.error('[LLM] Error generating response:', error.message);
      throw new Error(`LLM response generation failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt based on context
   * @param {object} context - Context information
   * @returns {string} - System prompt
   */
  buildSystemPrompt(context) {
    const { intent, callerInfo, department, productKnowledge } = context;

    // Base prompt (shared across all departments)
    const basePrompt = `You are a friendly and professional South African AI agent for Audico.
Use South African English expressions naturally (e.g., "howzit", "lekker", "just now").
Be concise but friendly - customers are on the phone.
Always confirm important details back to the customer.

Product Knowledge:
- You have access to our complete product catalogue via the get_product_info tool
- When customers ask about products, use the tool to look up accurate information
- Provide specific details like price, availability, and features
- Suggest alternatives if a product is out of stock`;

    // Department-specific prompts (specialized AI agents)
    const departmentPrompts = {
      'Sales': `\n\n🛍️ SALES AGENT:
You are Audico's Sales AI agent. Your expertise is helping customers find and purchase products.

Your capabilities:
- Recommend products based on customer needs and budget
- Explain product features, specifications, and benefits
- Compare different models and brands
- Provide pricing information and current promotions
- Check stock availability
- Process sales inquiries and prepare quotes
- Upsell and cross-sell complementary products

When a customer is ready to buy:
- Collect: Name, phone number, email, delivery address
- Confirm product details and total price
- Explain delivery options and timeframes
- Provide order summary and next steps`,

      'Shipping': `\n\n📦 SHIPPING AGENT:
You are Audico's Shipping & Logistics AI agent. Your expertise is order tracking and delivery.

Your capabilities:
- Track order status and delivery progress
- Provide estimated delivery dates
- Explain shipping methods and costs
- Handle delivery address changes (before dispatch)
- Resolve delivery issues and delays
- Arrange re-delivery or collection
- Process returns and exchanges

When helping customers:
- Ask for order number or email address
- Use track_order tool to get real-time status
- Explain current shipment location clearly
- Set realistic delivery expectations
- Offer solutions for any shipping problems`,

      'Support': `\n\n🔧 TECHNICAL SUPPORT AGENT:
You are Audico's Technical Support AI agent. Your expertise is troubleshooting and technical assistance.

Your capabilities:
- Diagnose technical problems with products
- Provide step-by-step troubleshooting guides
- Explain product setup and installation
- Answer technical specifications questions
- Handle warranty claims and repairs
- Recommend solutions for technical issues
- Guide customers through product features

When troubleshooting:
- Ask clarifying questions about the issue
- Get product model number and purchase date
- Guide through basic troubleshooting steps
- Determine if product needs repair or replacement
- Explain warranty coverage clearly
- Create support tickets when needed`,

      'Accounts': `\n\n💳 ACCOUNTS AGENT:
You are Audico's Accounts & Billing AI agent. Your expertise is financial inquiries.

Your capabilities:
- Explain invoices and billing statements
- Check payment status and history
- Process payment inquiries
- Handle account balance questions
- Resolve billing disputes
- Explain payment methods and terms
- Update account information

When handling financial matters:
- Verify customer identity (name, account number, email)
- Explain charges clearly and transparently
- Provide payment options and instructions
- Handle sensitive information professionally
- Escalate fraud or security concerns to human immediately`,

      'Operator': `\n\n📞 GENERAL ASSISTANT:
You are Audico's General AI assistant. You can help with any inquiry.

Your capabilities:
- Route inquiries to appropriate topics
- Provide general company information
- Answer basic questions about products and services
- Direct customers to the right department if needed
- Handle general inquiries professionally

If customer has a specific need, guide them:
- Sales questions → Use product search tools
- Order tracking → Ask for order number
- Technical issues → Begin troubleshooting
- Billing questions → Ask for account details`
    };

    // Build the final prompt
    let prompt = basePrompt;

    // Add department-specific section
    if (department && departmentPrompts[department]) {
      prompt += departmentPrompts[department];
    } else if (department) {
      prompt += `\n\nCurrent department: ${department}`;
    }

    if (intent) {
      prompt += `\n\nCustomer intent: ${intent}`;
    }

    if (callerInfo) {
      prompt += `\n\nCaller information: ${JSON.stringify(callerInfo)}`;
    }

    if (productKnowledge) {
      prompt += `\n\nProduct Context: ${productKnowledge}`;
    }

    // Important: AI should NOT auto-transfer to human
    prompt += `\n\n⚠️ IMPORTANT: You are an AI agent. Handle ALL customer inquiries yourself.
Only mention transferring to a human if the customer EXPLICITLY asks for one.
You are capable and empowered to resolve any issue.`;

    return prompt;
  }

  /**
   * Analyze customer intent from their message
   * @param {string} message - Customer message
   * @returns {Promise<object>} - Intent analysis result
   */
  async analyzeIntent(message) {
    try {
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 512,
        system: `You are an intent classifier for a call center. Analyze the customer's message and determine:
1. Primary intent (sales, shipping, support, accounts, general_inquiry)
2. Urgency level (low, medium, high, critical)
3. Sentiment (positive, neutral, negative)
4. Key entities (product names, order numbers, account numbers, etc.)

Respond in JSON format only.`,
        messages: [{
          role: 'user',
          content: `Analyze this customer message: "${message}"`,
        }],
      });

      const analysis = JSON.parse(response.content[0].text);
      console.log('[LLM] Intent analysis:', analysis);

      return analysis;
    } catch (error) {
      console.error('[LLM] Intent analysis error:', error.message);
      // Return default intent on error
      return {
        intent: 'general_inquiry',
        urgency: 'medium',
        sentiment: 'neutral',
        entities: {},
      };
    }
  }

  /**
   * Generate a summary of the call for human agents
   * @param {string} callSid - Call identifier
   * @returns {Promise<string>} - Call summary
   */
  async generateCallSummary(callSid) {
    try {
      const history = this.conversationHistory.get(callSid);

      if (!history || history.length === 0) {
        return 'No conversation history available.';
      }

      const conversationText = history
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');

      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 512,
        system: `You are a call center supervisor. Summarize the following conversation concisely for human agents. Include:
- Customer's main issue/request
- Key information collected
- Actions taken
- Whether the issue was resolved or needs escalation
- Recommended next steps`,
        messages: [{
          role: 'user',
          content: `Summarize this call:\n\n${conversationText}`,
        }],
      });

      const summary = response.content[0].text;
      console.log('[LLM] Call summary generated');

      return summary;
    } catch (error) {
      console.error('[LLM] Summary generation error:', error.message);
      return 'Error generating call summary.';
    }
  }

  /**
   * Clear conversation history for a call
   * @param {string} callSid - Call identifier
   */
  clearHistory(callSid) {
    this.conversationHistory.delete(callSid);
    console.log('[LLM] Conversation history cleared for call:', callSid);
  }

  /**
   * Check if transfer to human is needed based on conversation
   * @param {string} callSid - Call identifier
   * @returns {Promise<boolean>} - Whether transfer is needed
   */
  async shouldTransferToHuman(callSid) {
    try {
      const history = this.conversationHistory.get(callSid);

      if (!history || history.length === 0) {
        return false;
      }

      const conversationText = history
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');

      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 100,
        system: `Analyze if this conversation needs to be transferred to a human agent.
Consider factors like: customer frustration, complex issues, explicit request for human,
inability to resolve the issue. Respond with only "YES" or "NO".`,
        messages: [{
          role: 'user',
          content: conversationText,
        }],
      });

      const decision = response.content[0].text.trim().toUpperCase();
      return decision === 'YES';
    } catch (error) {
      console.error('[LLM] Transfer decision error:', error.message);
      return false;
    }
  }

  /**
   * Get tool definitions for Claude tool calling (department-specific)
   * @param {string} department - Department name
   * @returns {Array} - Tool definitions
   */
  getTools(department = null) {
    // Base product tools (available to all departments)
    const productTools = [
      {
        name: 'get_product_info',
        description: 'Search for product information by name, SKU, or general description. Use this when customers ask about products, pricing, or availability.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Product name, SKU, or description to search for (e.g., "Sony 55-inch TV", "SKU12345", "latest Samsung phone")',
            },
            search_type: {
              type: 'string',
              enum: ['name', 'sku', 'semantic'],
              description: 'Type of search: "name" for exact name match, "sku" for SKU lookup, "semantic" for flexible natural language search',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'check_product_availability',
        description: 'Check if a specific product is in stock and get stock levels',
        input_schema: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: 'Product ID to check availability',
            },
          },
          required: ['product_id'],
        },
      },
      {
        name: 'get_product_recommendations',
        description: 'Get product recommendations similar to a given product',
        input_schema: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: 'Product ID to base recommendations on',
            },
            limit: {
              type: 'number',
              description: 'Number of recommendations to return (default: 3)',
            },
          },
          required: ['product_id'],
        },
      },
    ];

    // Shipping-specific tools (order tracking)
    const shippingTools = [
      {
        name: 'track_order',
        description: 'Track an order by order number or invoice number. Returns order status, tracking information, and delivery estimates.',
        input_schema: {
          type: 'object',
          properties: {
            order_number: {
              type: 'string',
              description: 'Order number or invoice number to track',
            },
          },
          required: ['order_number'],
        },
      },
      {
        name: 'find_orders_by_email',
        description: 'Find all orders associated with a customer email address. Useful when customer does not have order number.',
        input_schema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Customer email address',
            },
          },
          required: ['email'],
        },
      },
    ];

    // Return department-specific tools
    if (department === 'Shipping') {
      return [...productTools, ...shippingTools];
    }

    // All other departments get product tools
    return productTools;
  }

  /**
   * Legacy method for backward compatibility
   */
  getProductTools() {
    return this.getTools();
  }

  /**
   * Execute a tool call (products, orders, etc.)
   * @param {string} toolName - Tool name
   * @param {object} parameters - Tool parameters
   * @returns {Promise<any>} - Tool result
   */
  async executeTool(toolName, parameters) {
    console.log('[LLM] Executing tool:', toolName, parameters);

    try {
      switch (toolName) {
        // Product tools
        case 'get_product_info': {
          const { query, search_type = 'semantic' } = parameters;

          if (search_type === 'sku') {
            const product = await productService.findProductBySKU(query);
            return product ? productService.formatProductInfo(product) : 'Product not found';
          } else if (search_type === 'name') {
            const products = await productService.findProductByName(query);
            if (products.length === 0) return 'No products found';
            if (products.length === 1) return productService.formatProductInfo(products[0]);
            return `Found ${products.length} products:\n` + products.map(p => `- ${p.name} (${p.sku})`).join('\n');
          } else {
            // Semantic search
            const products = await productService.semanticSearch(query, 3);
            if (products.length === 0) return 'No products found matching your query';
            if (products.length === 1) return productService.formatProductInfo(products[0]);
            return `Found ${products.length} products:\n` + products.map(p => productService.formatProductInfo(p)).join('\n\n');
          }
        }

        case 'check_product_availability': {
          const { product_id } = parameters;
          const availability = await productService.checkAvailability(product_id);
          return JSON.stringify(availability);
        }

        case 'get_product_recommendations': {
          const { product_id, limit = 3 } = parameters;
          const recommendations = await productService.getRecommendations(product_id, limit);
          if (recommendations.length === 0) return 'No recommendations available';
          return 'Recommended products:\n' + recommendations.map(p => productService.formatProductInfo(p)).join('\n\n');
        }

        // Order tracking tools (Shipping department)
        case 'track_order': {
          const { order_number } = parameters;
          const orderInfo = await orderTrackingService.trackOrder(order_number);
          return orderTrackingService.formatOrderInfo(orderInfo);
        }

        case 'find_orders_by_email': {
          const { email } = parameters;
          const ordersInfo = await orderTrackingService.findOrdersByEmail(email);
          return orderTrackingService.formatOrderList(ordersInfo);
        }

        default:
          return 'Unknown tool';
      }
    } catch (error) {
      console.error('[LLM] Tool execution error:', error.message);
      return `Error executing tool: ${error.message}`;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async executeProductTool(toolName, parameters) {
    return this.executeTool(toolName, parameters);
  }

  /**
   * Generate response with tool calling support (RAG)
   * @param {string} userMessage - User's message
   * @param {string} callSid - Call identifier
   * @param {object} context - Context
   * @returns {Promise<string>} - AI response
   */
  async generateResponseWithTools(userMessage, callSid, context = {}) {
    try {
      // Get or create conversation history
      if (!this.conversationHistory.has(callSid)) {
        this.conversationHistory.set(callSid, []);
      }

      const history = this.conversationHistory.get(callSid);
      const systemPrompt = this.buildSystemPrompt(context);

      // Add user message to history
      history.push({
        role: 'user',
        content: userMessage,
      });

      console.log('[LLM] Generating response with tool support for:', userMessage);

      // Get department-specific tools
      const tools = this.getTools(context.department);
      console.log(`[LLM] Using tools for department: ${context.department || 'General'} (${tools.length} tools available)`);

      // First call to Claude with tools
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
        tools: tools,
      });

      // Check if Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        console.log('[LLM] Tool use detected');

        // Execute all tool calls
        const toolResults = [];
        for (const content of response.content) {
          if (content.type === 'tool_use') {
            const result = await this.executeTool(content.name, content.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: content.id,
              content: result,
            });
          }
        }

        // Add assistant's tool use to history
        history.push({
          role: 'assistant',
          content: response.content,
        });

        // Add tool results to history
        history.push({
          role: 'user',
          content: toolResults,
        });

        // Call Claude again with tool results
        const finalResponse = await this.anthropic.messages.create({
          model: config.anthropic.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: history,
          tools: tools,
        });

        const assistantMessage = finalResponse.content.find(c => c.type === 'text')?.text || 'I apologize, I could not process that information.';

        // Add final response to history
        history.push({
          role: 'assistant',
          content: assistantMessage,
        });

        console.log('[LLM] Response with tools generated:', assistantMessage.substring(0, 100) + '...');
        return assistantMessage;
      }

      // No tool use, just return the text response
      const assistantMessage = response.content[0].text;

      history.push({
        role: 'assistant',
        content: assistantMessage,
      });

      console.log('[LLM] Response generated:', assistantMessage.substring(0, 100) + '...');
      return assistantMessage;
    } catch (error) {
      console.error('[LLM] Error generating response with tools:', error.message);
      throw new Error(`LLM response generation failed: ${error.message}`);
    }
  }
}

// Singleton instance
export const llmService = new LLMService();
