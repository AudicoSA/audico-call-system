#!/bin/bash

# Quick start script for Audico Call System

echo "🚀 Audico Call System - Quick Start"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "❗ IMPORTANT: Edit .env and add your API keys:"
    echo "   - TWILIO_ACCOUNT_SID"
    echo "   - TWILIO_AUTH_TOKEN"
    echo "   - TWILIO_PHONE_NUMBER"
    echo "   - OPENAI_API_KEY"
    echo "   - ELEVENLABS_API_KEY"
    echo "   - ELEVENLABS_VOICE_ID"
    echo "   - ANTHROPIC_API_KEY"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ Found .env file"
echo ""

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Test services
echo "🧪 Testing services configuration..."
node scripts/test-services.js

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Service test failed. Please check your configuration."
    exit 1
fi

echo ""
echo "======================================"
echo "✅ All systems ready!"
echo ""
echo "Starting server..."
echo ""

npm start
