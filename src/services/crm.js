import axios from 'axios';
import { config } from '../config/config.js';

/**
 * CRM integration service
 * Provides tool calling capabilities for the AI agent
 */
export class CRMService {
  constructor() {
    this.apiUrl = config.crm.apiUrl;
    this.apiKey = config.crm.apiKey;
    this.callLogs = new Map(); // In-memory storage (replace with database)
  }

  /**
   * Log call information to CRM
   * @param {object} callData - Call information
   * @returns {Promise<object>} - Log result
   */
  async logCall(callData) {
    const logEntry = {
      id: callData.callSid,
      callerNumber: callData.callerNumber,
      department: callData.department,
      intent: callData.intent,
      sentiment: callData.sentiment,
      urgency: callData.urgency,
      duration: callData.duration,
      timestamp: new Date(),
      summary: callData.summary || '',
      resolved: callData.resolved || false,
    };

    // Store locally
    this.callLogs.set(callData.callSid, logEntry);

    // Send to external CRM if configured
    if (this.apiUrl && this.apiKey) {
      try {
        await axios.post(`${this.apiUrl}/calls`, logEntry, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('[CRM] Call logged to external CRM:', callData.callSid);
      } catch (error) {
        console.error('[CRM] Error logging to external CRM:', error.message);
      }
    }

    console.log('[CRM] Call logged:', callData.callSid);
    return logEntry;
  }

  /**
   * Get customer information by phone number
   * @param {string} phoneNumber - Customer phone number
   * @returns {Promise<object|null>} - Customer data
   */
  async getCustomerByPhone(phoneNumber) {
    try {
      if (this.apiUrl && this.apiKey) {
        const response = await axios.get(`${this.apiUrl}/customers`, {
          params: { phone: phoneNumber },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        console.log('[CRM] Customer found:', phoneNumber);
        return response.data;
      }

      // Mock data for development
      console.log('[CRM] Using mock customer data');
      return {
        id: 'mock-customer-123',
        name: 'John Doe',
        phone: phoneNumber,
        email: 'john.doe@example.com',
        accountStatus: 'active',
        recentOrders: [],
      };
    } catch (error) {
      console.error('[CRM] Error fetching customer:', error.message);
      return null;
    }
  }

  /**
   * Get order status
   * @param {string} orderNumber - Order number
   * @returns {Promise<object|null>} - Order data
   */
  async getOrderStatus(orderNumber) {
    try {
      if (this.apiUrl && this.apiKey) {
        const response = await axios.get(`${this.apiUrl}/orders/${orderNumber}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        console.log('[CRM] Order found:', orderNumber);
        return response.data;
      }

      // Mock data for development
      console.log('[CRM] Using mock order data');
      return {
        orderNumber,
        status: 'In Transit',
        trackingNumber: 'TRK123456789',
        estimatedDelivery: '2025-10-28',
        items: ['Product A', 'Product B'],
      };
    } catch (error) {
      console.error('[CRM] Error fetching order:', error.message);
      return null;
    }
  }

  /**
   * Create a support ticket
   * @param {object} ticketData - Ticket information
   * @returns {Promise<object>} - Created ticket
   */
  async createSupportTicket(ticketData) {
    const ticket = {
      id: `TICKET-${Date.now()}`,
      customerId: ticketData.customerId,
      subject: ticketData.subject,
      description: ticketData.description,
      priority: ticketData.priority || 'medium',
      status: 'open',
      createdAt: new Date(),
      callSid: ticketData.callSid,
    };

    try {
      if (this.apiUrl && this.apiKey) {
        const response = await axios.post(`${this.apiUrl}/tickets`, ticket, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('[CRM] Ticket created:', response.data.id);
        return response.data;
      }

      console.log('[CRM] Mock ticket created:', ticket.id);
      return ticket;
    } catch (error) {
      console.error('[CRM] Error creating ticket:', error.message);
      return ticket; // Return mock ticket on error
    }
  }

  /**
   * Update customer information
   * @param {string} customerId - Customer ID
   * @param {object} updates - Customer data updates
   * @returns {Promise<object>} - Updated customer
   */
  async updateCustomer(customerId, updates) {
    try {
      if (this.apiUrl && this.apiKey) {
        const response = await axios.patch(`${this.apiUrl}/customers/${customerId}`, updates, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('[CRM] Customer updated:', customerId);
        return response.data;
      }

      console.log('[CRM] Mock customer update:', customerId);
      return { id: customerId, ...updates };
    } catch (error) {
      console.error('[CRM] Error updating customer:', error.message);
      throw error;
    }
  }

  /**
   * Schedule a callback
   * @param {object} callbackData - Callback information
   * @returns {Promise<object>} - Scheduled callback
   */
  async scheduleCallback(callbackData) {
    const callback = {
      id: `CB-${Date.now()}`,
      customerId: callbackData.customerId,
      phoneNumber: callbackData.phoneNumber,
      department: callbackData.department,
      requestedTime: callbackData.requestedTime,
      reason: callbackData.reason,
      status: 'scheduled',
      createdAt: new Date(),
    };

    try {
      if (this.apiUrl && this.apiKey) {
        const response = await axios.post(`${this.apiUrl}/callbacks`, callback, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('[CRM] Callback scheduled:', response.data.id);
        return response.data;
      }

      console.log('[CRM] Mock callback scheduled:', callback.id);
      return callback;
    } catch (error) {
      console.error('[CRM] Error scheduling callback:', error.message);
      return callback;
    }
  }

  /**
   * Get account balance
   * @param {string} customerId - Customer ID
   * @returns {Promise<object>} - Account balance information
   */
  async getAccountBalance(customerId) {
    try {
      if (this.apiUrl && this.apiKey) {
        const response = await axios.get(`${this.apiUrl}/customers/${customerId}/balance`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        console.log('[CRM] Account balance retrieved:', customerId);
        return response.data;
      }

      // Mock data
      console.log('[CRM] Using mock balance data');
      return {
        customerId,
        balance: 1250.50,
        currency: 'ZAR',
        dueDate: '2025-11-15',
        status: 'current',
      };
    } catch (error) {
      console.error('[CRM] Error fetching balance:', error.message);
      return null;
    }
  }

  /**
   * Generate payment link
   * @param {object} paymentData - Payment information
   * @returns {Promise<string>} - Payment link URL
   */
  async generatePaymentLink(paymentData) {
    try {
      if (this.apiUrl && this.apiKey) {
        const response = await axios.post(`${this.apiUrl}/payments/link`, paymentData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('[CRM] Payment link generated');
        return response.data.paymentUrl;
      }

      // Mock payment link
      const mockLink = `https://pay.audico.co.za/pay/${Date.now()}`;
      console.log('[CRM] Mock payment link:', mockLink);
      return mockLink;
    } catch (error) {
      console.error('[CRM] Error generating payment link:', error.message);
      return null;
    }
  }

  /**
   * Get all call logs (for analytics)
   * @returns {Array} - Array of call logs
   */
  getAllCallLogs() {
    return Array.from(this.callLogs.values());
  }

  /**
   * Get tools definition for LLM function calling
   * @returns {Array} - Array of tool definitions
   */
  getToolDefinitions() {
    return [
      {
        name: 'get_customer_info',
        description: 'Retrieve customer information by phone number',
        input_schema: {
          type: 'object',
          properties: {
            phone_number: {
              type: 'string',
              description: 'Customer phone number',
            },
          },
          required: ['phone_number'],
        },
      },
      {
        name: 'get_order_status',
        description: 'Get the status of an order by order number',
        input_schema: {
          type: 'object',
          properties: {
            order_number: {
              type: 'string',
              description: 'Order number or tracking number',
            },
          },
          required: ['order_number'],
        },
      },
      {
        name: 'create_support_ticket',
        description: 'Create a support ticket for the customer',
        input_schema: {
          type: 'object',
          properties: {
            customer_id: {
              type: 'string',
              description: 'Customer ID',
            },
            subject: {
              type: 'string',
              description: 'Ticket subject',
            },
            description: {
              type: 'string',
              description: 'Detailed description of the issue',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Ticket priority',
            },
          },
          required: ['customer_id', 'subject', 'description'],
        },
      },
      {
        name: 'schedule_callback',
        description: 'Schedule a callback for the customer',
        input_schema: {
          type: 'object',
          properties: {
            customer_id: {
              type: 'string',
              description: 'Customer ID',
            },
            phone_number: {
              type: 'string',
              description: 'Phone number for callback',
            },
            department: {
              type: 'string',
              description: 'Department to handle the callback',
            },
            requested_time: {
              type: 'string',
              description: 'Requested callback time',
            },
            reason: {
              type: 'string',
              description: 'Reason for callback',
            },
          },
          required: ['customer_id', 'phone_number', 'department'],
        },
      },
      {
        name: 'get_account_balance',
        description: 'Get customer account balance',
        input_schema: {
          type: 'object',
          properties: {
            customer_id: {
              type: 'string',
              description: 'Customer ID',
            },
          },
          required: ['customer_id'],
        },
      },
    ];
  }

  /**
   * Execute a tool call
   * @param {string} toolName - Tool name
   * @param {object} parameters - Tool parameters
   * @returns {Promise<any>} - Tool execution result
   */
  async executeTool(toolName, parameters) {
    console.log('[CRM] Executing tool:', toolName, parameters);

    switch (toolName) {
      case 'get_customer_info':
        return await this.getCustomerByPhone(parameters.phone_number);

      case 'get_order_status':
        return await this.getOrderStatus(parameters.order_number);

      case 'create_support_ticket':
        return await this.createSupportTicket(parameters);

      case 'schedule_callback':
        return await this.scheduleCallback(parameters);

      case 'get_account_balance':
        return await this.getAccountBalance(parameters.customer_id);

      default:
        console.error('[CRM] Unknown tool:', toolName);
        return null;
    }
  }
}

// Singleton instance
export const crmService = new CRMService();
