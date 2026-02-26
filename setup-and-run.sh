#!/bin/bash

echo "========================================="
echo "  🌟 AURA 平台完整安装和启动脚本"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check and install Homebrew
echo "📦 步骤 1/4: 检查 Homebrew..."
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}Homebrew 未安装，正在安装...${NC}"
    echo "请在提示时输入你的 Mac 密码"
    /bin/bash -c "$(curl -fsSL https://gitee.com/ineo6/homebrew-install/raw/master/install.sh)"
    
    # Add Homebrew to PATH
    echo ""
    echo -e "${YELLOW}配置 Homebrew 环境变量...${NC}"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    echo -e "${GREEN}✅ Homebrew 已安装${NC}"
fi

# Step 2: Check and install Node.js
echo ""
echo "📦 步骤 2/4: 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js 未安装，正在安装...${NC}"
    brew install node
else
    echo -e "${GREEN}✅ Node.js 已安装: $(node -v)${NC}"
fi

# Verify installations
echo ""
echo "🔍 验证安装..."
echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# Step 3: Install frontend dependencies
echo ""
echo "📦 步骤 3/4: 安装前端依赖..."
cd ~/Desktop/aura-platform/vite-app

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}正在安装依赖（这可能需要 1-2 分钟）...${NC}"
    npm install
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi

# Step 4: Start development server
echo ""
echo "🚀 步骤 4/4: 启动开发服务器..."
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  AURA 平台正在启动...${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "访问地址: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

npm run dev
