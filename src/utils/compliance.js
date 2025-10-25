import { logger } from './logger.js';

/**
 * POPIA (Protection of Personal Information Act) Compliance utilities
 */
export class ComplianceManager {
  constructor() {
    this.consentRecords = new Map();
    this.dataSubjectRequests = new Map();
  }

  /**
   * Record consent for call recording
   * @param {string} callSid - Call identifier
   * @param {string} phoneNumber - Caller's phone number
   * @param {boolean} consentGiven - Whether consent was given
   */
  async recordConsent(callSid, phoneNumber, consentGiven) {
    const consentRecord = {
      callSid,
      phoneNumber,
      consentGiven,
      timestamp: new Date().toISOString(),
      ipAddress: null, // Would capture if web-based
      recordingMethod: 'voice',
    };

    this.consentRecords.set(callSid, consentRecord);

    // Log compliance event
    await logger.logCompliance({
      type: 'CONSENT_RECORDED',
      callSid,
      details: {
        consentGiven,
        timestamp: consentRecord.timestamp,
      },
    });

    console.log('[Compliance] Consent recorded:', callSid, consentGiven);

    return consentRecord;
  }

  /**
   * Check if consent exists for a call
   * @param {string} callSid - Call identifier
   * @returns {boolean} - Whether consent was given
   */
  hasConsent(callSid) {
    const record = this.consentRecords.get(callSid);
    return record && record.consentGiven;
  }

  /**
   * Handle data subject access request (DSAR)
   * Customer has the right to access their data
   * @param {string} phoneNumber - Customer's phone number
   * @returns {Promise<object>} - Customer's data
   */
  async handleAccessRequest(phoneNumber) {
    const requestId = `DSAR-${Date.now()}`;

    const request = {
      requestId,
      type: 'ACCESS',
      phoneNumber,
      requestDate: new Date().toISOString(),
      status: 'pending',
    };

    this.dataSubjectRequests.set(requestId, request);

    await logger.logCompliance({
      type: 'DATA_ACCESS_REQUEST',
      callSid: null,
      details: {
        requestId,
        phoneNumber: logger.maskPhoneNumber(phoneNumber),
      },
    });

    console.log('[Compliance] Data access request received:', requestId);

    // In production, this would query all systems for customer data
    return {
      requestId,
      message: 'Your data access request has been received. We will respond within 30 days as required by POPIA.',
    };
  }

  /**
   * Handle data subject deletion request
   * Customer has the right to request deletion of their data
   * @param {string} phoneNumber - Customer's phone number
   * @returns {Promise<object>} - Deletion request confirmation
   */
  async handleDeletionRequest(phoneNumber) {
    const requestId = `DSR-${Date.now()}`;

    const request = {
      requestId,
      type: 'DELETION',
      phoneNumber,
      requestDate: new Date().toISOString(),
      status: 'pending',
    };

    this.dataSubjectRequests.set(requestId, request);

    await logger.logCompliance({
      type: 'DATA_DELETION_REQUEST',
      callSid: null,
      details: {
        requestId,
        phoneNumber: logger.maskPhoneNumber(phoneNumber),
      },
    });

    console.log('[Compliance] Data deletion request received:', requestId);

    return {
      requestId,
      message: 'Your data deletion request has been received. Please note that we may retain certain data as required by law.',
    };
  }

  /**
   * Handle data subject correction request
   * Customer has the right to correct their data
   * @param {string} phoneNumber - Customer's phone number
   * @param {object} corrections - Data to correct
   * @returns {Promise<object>} - Correction request confirmation
   */
  async handleCorrectionRequest(phoneNumber, corrections) {
    const requestId = `DSCR-${Date.now()}`;

    const request = {
      requestId,
      type: 'CORRECTION',
      phoneNumber,
      corrections,
      requestDate: new Date().toISOString(),
      status: 'pending',
    };

    this.dataSubjectRequests.set(requestId, request);

    await logger.logCompliance({
      type: 'DATA_CORRECTION_REQUEST',
      callSid: null,
      details: {
        requestId,
        phoneNumber: logger.maskPhoneNumber(phoneNumber),
      },
    });

    console.log('[Compliance] Data correction request received:', requestId);

    return {
      requestId,
      message: 'Your data correction request has been received and will be processed.',
    };
  }

  /**
   * Record marketing consent
   * Section 69 of POPIA requires explicit opt-in for direct marketing
   * @param {string} phoneNumber - Customer's phone number
   * @param {boolean} consentGiven - Whether consent was given
   * @param {string} channel - Marketing channel (voice, sms, email)
   */
  async recordMarketingConsent(phoneNumber, consentGiven, channel) {
    const consentRecord = {
      phoneNumber,
      channel,
      consentGiven,
      timestamp: new Date().toISOString(),
    };

    await logger.logCompliance({
      type: 'MARKETING_CONSENT',
      callSid: null,
      details: consentRecord,
    });

    console.log('[Compliance] Marketing consent recorded:', phoneNumber, channel, consentGiven);

    return consentRecord;
  }

  /**
   * Check do-not-call list
   * @param {string} phoneNumber - Phone number to check
   * @returns {boolean} - Whether number is on DNC list
   */
  isOnDoNotCallList(phoneNumber) {
    // In production, this would check against the national DNC registry
    // and your internal DNC list
    console.log('[Compliance] Checking DNC list for:', phoneNumber);
    return false; // Mock implementation
  }

  /**
   * Add to do-not-call list
   * @param {string} phoneNumber - Phone number to add
   * @param {string} reason - Reason for adding
   */
  async addToDoNotCallList(phoneNumber, reason) {
    await logger.logCompliance({
      type: 'DNC_LIST_ADD',
      callSid: null,
      details: {
        phoneNumber: logger.maskPhoneNumber(phoneNumber),
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    console.log('[Compliance] Added to DNC list:', phoneNumber);
  }

  /**
   * Generate compliance report
   * @param {Date} startDate - Report start date
   * @param {Date} endDate - Report end date
   * @returns {Promise<object>} - Compliance report
   */
  async generateComplianceReport(startDate, endDate) {
    const logs = await logger.getLogs(startDate, endDate, 'compliance');

    const report = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalConsentRecorded: 0,
      dataSubjectRequests: {
        access: 0,
        deletion: 0,
        correction: 0,
      },
      marketingConsents: {
        granted: 0,
        denied: 0,
      },
      dncListAdditions: 0,
    };

    // Parse logs and generate statistics
    logs.forEach(log => {
      try {
        const entry = JSON.parse(log.split('] ')[2]); // Extract JSON part

        switch (entry.eventType) {
          case 'CONSENT_RECORDED':
            report.totalConsentRecorded++;
            break;
          case 'DATA_ACCESS_REQUEST':
            report.dataSubjectRequests.access++;
            break;
          case 'DATA_DELETION_REQUEST':
            report.dataSubjectRequests.deletion++;
            break;
          case 'DATA_CORRECTION_REQUEST':
            report.dataSubjectRequests.correction++;
            break;
          case 'MARKETING_CONSENT':
            if (entry.details.consentGiven) {
              report.marketingConsents.granted++;
            } else {
              report.marketingConsents.denied++;
            }
            break;
          case 'DNC_LIST_ADD':
            report.dncListAdditions++;
            break;
        }
      } catch (error) {
        // Skip malformed log entries
      }
    });

    console.log('[Compliance] Report generated for period:', startDate, 'to', endDate);

    return report;
  }

  /**
   * Anonymize personal data
   * Used for analytics while protecting privacy
   * @param {object} data - Data to anonymize
   * @returns {object} - Anonymized data
   */
  anonymizeData(data) {
    const anonymized = { ...data };

    // Remove or mask personal identifiers
    if (anonymized.phoneNumber) {
      anonymized.phoneNumber = logger.maskPhoneNumber(anonymized.phoneNumber);
    }

    if (anonymized.email) {
      const [username, domain] = anonymized.email.split('@');
      anonymized.email = `${username.substring(0, 2)}***@${domain}`;
    }

    if (anonymized.name) {
      anonymized.name = anonymized.name
        .split(' ')
        .map(part => part.charAt(0) + '***')
        .join(' ');
    }

    // Remove sensitive fields
    delete anonymized.identificationNumber;
    delete anonymized.accountNumber;

    return anonymized;
  }
}

// Singleton instance
export const complianceManager = new ComplianceManager();
