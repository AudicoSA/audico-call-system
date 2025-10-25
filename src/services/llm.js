import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config/config.js';
import { productService } from './product.js';

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

    let prompt = `You are a friendly and professional South African call center agent for Audico.
Your role is to assist customers with their inquiries in a warm, helpful manner.

Guidelines:
- Use South African English expressions naturally (e.g., "howzit", "lekker", "just now")
- Be concise but friendly - customers are on the phone
- Ask clarifying questions if needed
- Collect necessary information: name, contact details, issue description
- If you cannot resolve the issue, prepare to transfer to a human agent
- Always confirm important details back to the customer

Product Knowledge:
- You have access to our complete product catalogue via the get_product_info tool
- When customers ask about products, use the tool to look up accurate information
- Provide specific details like price, availability, and features
- Suggest alternatives if a product is out of stock
- You can search by product name, SKU, or category`;

    if (department) {
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
   * Get product tool definitions for Claude tool calling
   * @returns {Array} - Tool definitions
   */
  getProductTools() {
    return [
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
  }

  /**
   * Execute a product tool call
   * @param {string} toolName - Tool name
   * @param {object} parameters - Tool parameters
   * @returns {Promise<any>} - Tool result
   */
  async executeProductTool(toolName, parameters) {
    console.log('[LLM] Executing product tool:', toolName, parameters);

    try {
      switch (toolName) {
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

        default:
          return 'Unknown tool';
      }
    } catch (error) {
      console.error('[LLM] Tool execution error:', error.message);
      return `Error executing tool: ${error.message}`;
    }
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

      // First call to Claude with tools
      const response = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
        tools: this.getProductTools(),
      });

      // Check if Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        console.log('[LLM] Tool use detected');

        // Execute all tool calls
        const toolResults = [];
        for (const content of response.content) {
          if (content.type === 'tool_use') {
            const result = await this.executeProductTool(content.name, content.input);
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
          tools: this.getProductTools(),
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
