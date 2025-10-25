import express from 'express';
import { crmService } from '../services/crm.js';
import { ivrService } from '../services/ivr.js';

const router = express.Router();

/**
 * GET /analytics/calls
 * Get call analytics and logs
 */
router.get('/calls', (req, res) => {
  try {
    const logs = crmService.getAllCallLogs();

    // Calculate statistics
    const stats = {
      totalCalls: logs.length,
      averageDuration: logs.reduce((sum, log) => sum + (log.duration || 0), 0) / logs.length || 0,
      byDepartment: {},
      bySentiment: {},
      byUrgency: {},
      resolvedCalls: logs.filter(log => log.resolved).length,
      unresolvedCalls: logs.filter(log => !log.resolved).length,
    };

    // Count by department
    logs.forEach(log => {
      const dept = log.department || 'Unknown';
      stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;

      const sentiment = log.sentiment || 'unknown';
      stats.bySentiment[sentiment] = (stats.bySentiment[sentiment] || 0) + 1;

      const urgency = log.urgency || 'unknown';
      stats.byUrgency[urgency] = (stats.byUrgency[urgency] || 0) + 1;
    });

    res.json({
      success: true,
      stats,
      recentCalls: logs.slice(-10).reverse(), // Last 10 calls
    });
  } catch (error) {
    console.error('[Analytics] Error fetching call analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /analytics/calls/:callSid
 * Get details for a specific call
 */
router.get('/calls/:callSid', (req, res) => {
  try {
    const { callSid } = req.params;
    const logs = crmService.getAllCallLogs();
    const call = logs.find(log => log.id === callSid);

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found',
      });
    }

    res.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error('[Analytics] Error fetching call details:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /analytics/dashboard
 * Get dashboard data
 */
router.get('/dashboard', (req, res) => {
  try {
    const logs = crmService.getAllCallLogs();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calls today
    const callsToday = logs.filter(log => new Date(log.timestamp) >= today);

    // Average response time (mock for now)
    const avgResponseTime = 12; // seconds

    // Customer satisfaction (mock - would come from post-call surveys)
    const satisfactionScore = 4.5; // out of 5

    const dashboard = {
      callsToday: callsToday.length,
      callsThisWeek: logs.filter(log => {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return new Date(log.timestamp) >= weekAgo;
      }).length,
      callsThisMonth: logs.filter(log => {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return new Date(log.timestamp) >= monthAgo;
      }).length,
      avgResponseTime,
      satisfactionScore,
      activeCalls: Array.from(ivrService.callState.keys()).length,
      topDepartments: getTopDepartments(logs),
      recentActivity: logs.slice(-5).reverse(),
    };

    res.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error('[Analytics] Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Helper function to get top departments
 */
function getTopDepartments(logs) {
  const deptCounts = {};

  logs.forEach(log => {
    const dept = log.department || 'Unknown';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  return Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dept, count]) => ({ department: dept, count }));
}

/**
 * GET /analytics/performance
 * Get performance metrics
 */
router.get('/performance', (req, res) => {
  try {
    const logs = crmService.getAllCallLogs();

    const performance = {
      totalCalls: logs.length,
      aiResolutionRate: (logs.filter(log => log.resolved && !log.transferredToHuman).length / logs.length * 100).toFixed(2),
      transferRate: (logs.filter(log => log.transferredToHuman).length / logs.length * 100).toFixed(2),
      averageCallDuration: (logs.reduce((sum, log) => sum + (log.duration || 0), 0) / logs.length / 1000 / 60).toFixed(2), // minutes
      sentimentDistribution: getSentimentDistribution(logs),
      urgencyDistribution: getUrgencyDistribution(logs),
    };

    res.json({
      success: true,
      performance,
    });
  } catch (error) {
    console.error('[Analytics] Error fetching performance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

function getSentimentDistribution(logs) {
  const dist = { positive: 0, neutral: 0, negative: 0 };
  logs.forEach(log => {
    const sentiment = log.sentiment || 'neutral';
    dist[sentiment] = (dist[sentiment] || 0) + 1;
  });
  return dist;
}

function getUrgencyDistribution(logs) {
  const dist = { low: 0, medium: 0, high: 0, critical: 0 };
  logs.forEach(log => {
    const urgency = log.urgency || 'medium';
    dist[urgency] = (dist[urgency] || 0) + 1;
  });
  return dist;
}

export default router;
