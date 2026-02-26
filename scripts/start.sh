#!/bin/bash

echo "========================================="
echo "  🌟 AURA 平台 - 一键启动脚本"
echo "========================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未安装 Node.js"
    echo "请运行: brew install node"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"

# Navigate to vite-app directory
cd vite-app

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
fi

# Start development server
echo "🚀 启动开发服务器..."
npm run dev
