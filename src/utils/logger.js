import fs from 'fs/promises';
import path from 'path';

/**
 * Simple logger utility for call center operations
 * Includes POPIA-compliant logging
 */
class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDir();
  }

  async ensureLogDir() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('[Logger] Error creating log directory:', error);
    }
  }

  /**
   * Get current log file path
   */
  getLogFilePath(type = 'app') {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  /**
   * Write log entry
   */
  async writeLog(message, level = 'INFO', type = 'app') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    try {
      const logFile = this.getLogFilePath(type);
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error('[Logger] Error writing log:', error);
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(logEntry.trim());
    }
  }

  /**
   * Log info message
   */
  async info(message, type = 'app') {
    await this.writeLog(message, 'INFO', type);
  }

  /**
   * Log warning
   */
  async warn(message, type = 'app') {
    await this.writeLog(message, 'WARN', type);
  }

  /**
   * Log error
   */
  async error(message, error = null, type = 'app') {
    const errorMessage = error ? `${message}: ${error.message}\n${error.stack}` : message;
    await this.writeLog(errorMessage, 'ERROR', type);
  }

  /**
   * Log call activity (POPIA compliant)
   */
  async logCall(callData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      callSid: callData.callSid,
      callerNumber: this.maskPhoneNumber(callData.callerNumber), // Masked for privacy
      department: callData.department,
      duration: callData.duration,
      resolved: callData.resolved,
      transferredToHuman: callData.transferredToHuman || false,
    };

    await this.writeLog(JSON.stringify(logEntry), 'INFO', 'calls');
  }

  /**
   * Mask phone number for privacy (POPIA compliance)
   */
  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 4) {
      return '****';
    }
    // Show only last 4 digits
    return '***' + phoneNumber.slice(-4);
  }

  /**
   * Log compliance event
   */
  async logCompliance(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      callSid: event.callSid,
      details: event.details,
    };

    await this.writeLog(JSON.stringify(logEntry), 'COMPLIANCE', 'compliance');
  }

  /**
   * Get logs for date range
   */
  async getLogs(startDate, endDate, type = 'app') {
    const logs = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${type}-${dateStr}.log`);

      try {
        const content = await fs.readFile(logFile, 'utf-8');
        logs.push(...content.split('\n').filter(line => line.trim()));
      } catch (error) {
        // File doesn't exist, skip
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return logs;
  }

  /**
   * Clean up old logs (retention policy)
   */
  async cleanupOldLogs(retentionDays = 90) {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`[Logger] Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('[Logger] Error cleaning up logs:', error);
    }
  }
}

// Singleton instance
export const logger = new Logger();
