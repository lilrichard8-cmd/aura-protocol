#!/bin/bash

echo "========================================="
echo "  🌟 AURA Platform - One-Click Launcher"
echo "========================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not installed"
    echo "Run: brew install node"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"

# Navigate to vite-app directory
cd vite-app

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start development server
echo "🚀 Starting dev server..."
npm run dev
