/**
 * Sync Routes
 * API endpoints for automated product sync
 */

import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Secret token to protect endpoint
const SYNC_TOKEN = process.env.SYNC_TOKEN || 'audico-sync-2024-secure-token';

/**
 * Daily product sync endpoint
 * Call this from cron-job.org or other cron services
 */
router.post('/api/sync/daily', (req, res) => {
  // Check authorization
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (token !== SYNC_TOKEN) {
    console.error('[Sync] Unauthorized sync attempt');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization token'
    });
  }

  console.log('[Sync] Daily sync triggered via API');

  try {
    // Get project root directory
    const projectRoot = path.join(__dirname, '..', '..');

    // Run sync in background
    const sync = spawn('node', ['scripts/daily-sync.js'], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore'
    });

    sync.unref();

    res.json({
      success: true,
      message: 'Daily sync started in background',
      timestamp: new Date().toISOString()
    });

    console.log('[Sync] Daily sync process started');

  } catch (error) {
    console.error('[Sync] Error starting sync:', error.message);
    res.status(500).json({
      error: 'Failed to start sync',
      message: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/api/sync/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Product Sync API',
    timestamp: new Date().toISOString()
  });
});

export default router;
