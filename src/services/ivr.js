import { config } from '../config/config.js';
import { llmService } from './llm.js';
import { telephonyService } from './telephony.js';

/**
 * IVR (Interactive Voice Response) service for call routing
 */
export class IVRService {
  constructor() {
    this.menuOptions = config.ivr.options;
    this.callState = new Map(); // Track state of each call
  }

  /**
   * Initialize call state
   * @param {string} callSid - Call identifier
   * @param {object} callerInfo - Caller information from Twilio
   */
  initializeCall(callSid, callerInfo) {
    this.callState.set(callSid, {
      callSid,
      callerNumber: callerInfo.from,
      callerCity: callerInfo.fromCity,
      callerState: callerInfo.fromState,
      callerCountry: callerInfo.fromCountry,
      startTime: new Date(),
      currentState: 'greeting',
      selectedDepartment: null,
      intent: null,
      transferAttempts: 0,
      conversationTurns: 0,
    });

    console.log('[IVR] Call initialized:', callSid);
  }

  /**
   * Get call state
   * @param {string} callSid - Call identifier
   * @returns {object} - Call state
   */
  getCallState(callSid) {
    return this.callState.get(callSid);
  }

  /**
   * Update call state
   * @param {string} callSid - Call identifier
   * @param {object} updates - State updates
   */
  updateCallState(callSid, updates) {
    const state = this.callState.get(callSid);
    if (state) {
      Object.assign(state, updates);
      this.callState.set(callSid, state);
    }
  }

  /**
   * Process IVR menu selection
   * @param {string} callSid - Call identifier
   * @param {string} selection - User's menu selection (DTMF or speech)
   * @returns {object} - Routing decision
   */
  async processMenuSelection(callSid, selection) {
    console.log('[IVR] Processing menu selection:', selection, 'for call:', callSid);

    const state = this.getCallState(callSid);

    // Normalize selection (could be digit or spoken word)
    const normalizedSelection = this.normalizeSelection(selection);

    if (!this.menuOptions[normalizedSelection]) {
      console.log('[IVR] Invalid selection:', normalizedSelection);
      return {
        action: 'repeat_menu',
        message: 'Sorry, I did not understand your selection. Let me repeat the menu.',
      };
    }

    const option = this.menuOptions[normalizedSelection];

    // Update call state
    this.updateCallState(callSid, {
      selectedDepartment: option.name,
      currentState: 'department_selected',
    });

    console.log('[IVR] Routed to department:', option.name);

    return {
      action: 'route_to_department',
      department: option.name,
      message: `You have selected ${option.name}. Let me connect you with an agent.`,
    };
  }

  /**
   * Normalize menu selection (handle both DTMF and speech input)
   * @param {string} selection - Raw selection
   * @returns {string} - Normalized selection (digit)
   */
  normalizeSelection(selection) {
    const lowerSelection = selection.toLowerCase().trim();

    // Map spoken words to digits
    const speechMap = {
      'sales': '1',
      'one': '1',
      'shipping': '2',
      'two': '2',
      'track': '2',
      'support': '3',
      'three': '3',
      'technical': '3',
      'accounts': '4',
      'four': '4',
      'billing': '4',
      'operator': '0',
      'zero': '0',
      'human': '0',
    };

    // Check if it's already a digit
    if (/^[0-9]$/.test(lowerSelection)) {
      return lowerSelection;
    }

    // Try to map speech to digit
    for (const [keyword, digit] of Object.entries(speechMap)) {
      if (lowerSelection.includes(keyword)) {
        return digit;
      }
    }

    return null; // Invalid selection
  }

  /**
   * Determine if call should be routed to AI agent or human
   * @param {string} callSid - Call identifier
   * @param {string} department - Selected department
   * @returns {Promise<object>} - Routing decision
   */
  async determineRouting(callSid, department) {
    const state = this.getCallState(callSid);

    // Check if AI can handle this based on department and call history
    const canAIHandle = await this.canAIHandle(callSid, department);

    if (canAIHandle) {
      console.log('[IVR] Routing to AI agent for department:', department);
      return {
        routeType: 'ai',
        department,
        message: `I'll be happy to help you with your ${department.toLowerCase()} inquiry.`,
      };
    } else {
      console.log('[IVR] Routing to human agent for department:', department);
      return {
        routeType: 'human',
        department,
        agentNumber: this.getAgentNumber(department),
        message: `Let me connect you with a ${department.toLowerCase()} specialist.`,
      };
    }
  }

  /**
   * Check if AI can handle the call
   * @param {string} callSid - Call identifier
   * @param {string} department - Department
   * @returns {Promise<boolean>}
   */
  async canAIHandle(callSid, department) {
    const state = this.getCallState(callSid);

    // AI handles ALL departments (Sales, Shipping, Support, Accounts)
    // Only transfer to human if explicitly requested or after AI fails

    // If customer already tried AI multiple times, escalate
    if (state.transferAttempts > 2) {
      return false; // After 3 AI attempts, go to human
    }

    // AI tries first for ALL departments (including Operator)
    return true;
  }

  /**
   * Get agent phone number for department
   * @param {string} department - Department name
   * @returns {string} - Agent phone number
   */
  getAgentNumber(department) {
    const departmentMap = {
      'Sales': config.agents.sales,
      'Shipping': config.agents.shipping,
      'Support': config.agents.support,
      'Accounts': config.agents.accounts,
      'Operator': config.agents.operator,
    };

    return departmentMap[department] || config.agents.operator;
  }

  /**
   * Analyze customer intent from speech
   * @param {string} callSid - Call identifier
   * @param {string} speechInput - Customer's speech
   * @returns {Promise<object>} - Intent analysis
   */
  async analyzeIntent(callSid, speechInput) {
    console.log('[IVR] Analyzing intent for speech:', speechInput);

    const state = this.getCallState(callSid);

    // Use LLM to analyze intent
    const analysis = await llmService.analyzeIntent(speechInput);

    // Update call state with intent
    this.updateCallState(callSid, {
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      urgency: analysis.urgency,
    });

    // Map intent to department
    const departmentMapping = {
      'sales': 'Sales',
      'shipping': 'Shipping',
      'support': 'Support',
      'accounts': 'Accounts',
      'general_inquiry': 'Operator',
    };

    const department = departmentMapping[analysis.intent] || 'Operator';

    return {
      intent: analysis.intent,
      department,
      urgency: analysis.urgency,
      sentiment: analysis.sentiment,
    };
  }

  /**
   * Check if call should be escalated to human
   * @param {string} callSid - Call identifier
   * @param {string} lastInput - Customer's last speech input (optional)
   * @returns {Promise<boolean>}
   */
  async shouldEscalate(callSid, lastInput = '') {
    const state = this.getCallState(callSid);

    // Check if customer explicitly requested human agent
    if (this.detectsHumanRequest(lastInput)) {
      console.log('[IVR] Escalating due to explicit human request');
      this.updateCallState(callSid, { escalationReason: 'customer_requested_human' });
      return true;
    }

    // Check if marked for escalation in state
    if (state.requestedHuman) {
      console.log('[IVR] Escalating due to previous human request flag');
      return true;
    }

    // Escalation criteria
    if (state.conversationTurns > 10) {
      console.log('[IVR] Escalating due to long conversation');
      this.updateCallState(callSid, { escalationReason: 'long_conversation' });
      return true;
    }

    if (state.sentiment === 'negative' && state.conversationTurns > 3) {
      console.log('[IVR] Escalating due to negative sentiment');
      this.updateCallState(callSid, { escalationReason: 'negative_sentiment' });
      return true;
    }

    if (state.urgency === 'critical' || state.urgency === 'high') {
      console.log('[IVR] Escalating due to urgency');
      this.updateCallState(callSid, { escalationReason: 'high_urgency' });
      return true;
    }

    // Check for repeated failed attempts
    if (state.failedAttempts >= 3) {
      console.log('[IVR] Escalating due to repeated failures');
      this.updateCallState(callSid, { escalationReason: 'repeated_failures' });
      return true;
    }

    // Use LLM to determine if transfer needed
    const shouldTransfer = await llmService.shouldTransferToHuman(callSid);

    if (shouldTransfer) {
      console.log('[IVR] LLM recommends escalation');
      this.updateCallState(callSid, { escalationReason: 'ai_recommended' });
      return true;
    }

    return false;
  }

  /**
   * Detect if customer is requesting a human agent
   * @param {string} input - Customer's speech input
   * @returns {boolean}
   */
  detectsHumanRequest(input) {
    if (!input) return false;

    const lowerInput = input.toLowerCase();
    const humanKeywords = [
      'human',
      'person',
      'real person',
      'agent',
      'operator',
      'representative',
      'manager',
      'supervisor',
      'speak to someone',
      'talk to someone',
      'transfer me',
      'transfer to',
      'transfer',
      'connect me',
      'live agent',
      'real agent',
      'customer service',
      'speak with',
      'talk with',
    ];

    return humanKeywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * Generate call summary for handoff to human
   * @param {string} callSid - Call identifier
   * @returns {Promise<object>} - Call summary
   */
  async generateHandoffSummary(callSid) {
    const state = this.getCallState(callSid);
    const conversationSummary = await llmService.generateCallSummary(callSid);

    return {
      callSid,
      callerNumber: state.callerNumber,
      department: state.selectedDepartment,
      intent: state.intent,
      sentiment: state.sentiment,
      urgency: state.urgency,
      conversationTurns: state.conversationTurns,
      duration: Date.now() - state.startTime.getTime(),
      summary: conversationSummary,
    };
  }

  /**
   * Clean up call state after call ends
   * @param {string} callSid - Call identifier
   */
  cleanupCall(callSid) {
    // Generate final summary before cleanup
    const state = this.getCallState(callSid);

    if (state) {
      console.log('[IVR] Call ended:', {
        callSid,
        department: state.selectedDepartment,
        duration: Date.now() - state.startTime.getTime(),
        turns: state.conversationTurns,
      });
    }

    this.callState.delete(callSid);
    llmService.clearHistory(callSid);
  }
}

// Singleton instance
export const ivrService = new IVRService();
