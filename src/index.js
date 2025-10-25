import express from 'express';
import { config, validateConfig } from './config/config.js';
import voiceRoutes from './routes/voice.js';
import analyticsRoutes from './routes/analytics.js';

// Validate configuration before starting
let configError = null;
try {
  validateConfig();
  console.log('[Server] Configuration validated successfully');
} catch (error) {
  console.error('[Server] Configuration error:', error.message);
  console.error('[Server] Please check your .env file and ensure all required variables are set');
  configError = error;
  // Don't exit in serverless environment, handle in routes instead
  if (process.env.VERCEL !== '1') {
    process.exit(1);
  }
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration error middleware (for serverless)
app.use((req, res, next) => {
  if (configError) {
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'Server configuration is invalid. Please check environment variables.',
      details: process.env.NODE_ENV === 'development' ? configError.message : undefined
    });
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// Root endpoint with API information
app.get('/', (req, res) => {
  res.json({
    name: 'Audico Call System',
    version: '1.0.0',
    description: 'AI-powered call center agent with South African voice',
    endpoints: {
      voice: '/voice/*',
      analytics: '/analytics/*',
      health: '/health',
    },
    documentation: 'See README.md for setup instructions',
  });
});

// Mount routes
app.use('/voice', voiceRoutes);
app.use('/analytics', analyticsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'An error occurred',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server (only in non-serverless environment)
if (process.env.VERCEL !== '1') {
  const port = config.port;
  app.listen(port, () => {
    console.log('');
    console.log('================================================');
    console.log('  Audico Call System - AI Voice Agent');
    console.log('================================================');
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Server running on port: ${port}`);
    console.log(`  URL: http://localhost:${port}`);
    console.log('');
    console.log('  Endpoints:');
    console.log(`    - Health Check: http://localhost:${port}/health`);
    console.log(`    - Analytics: http://localhost:${port}/analytics/dashboard`);
    console.log(`    - Voice Webhook: http://localhost:${port}/voice/incoming`);
    console.log('');
    console.log('  Twilio Configuration:');
    console.log(`    - Phone Number: ${config.twilio.phoneNumber || 'Not configured'}`);
    console.log('');
    console.log('  Services:');
    console.log(`    - STT: OpenAI Whisper`);
    console.log(`    - TTS: ElevenLabs (Voice ID: ${config.elevenlabs.voiceId || 'Not configured'})`);
    console.log(`    - LLM: ${config.anthropic.model}`);
    console.log('');
    console.log('  POPIA Compliance:');
    console.log(`    - Call Recording: ${config.recording.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('');
    console.log('================================================');
    console.log('');
    console.log('  Ready to accept calls!');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

// Export for Vercel serverless
export default app;
