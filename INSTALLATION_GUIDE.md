# 🚀 AURA 平台安装指南

## 📋 前置要求

在开始之前，你需要安装以下工具：

## 1️⃣ 安装 Homebrew（Mac 包管理器）

在终端运行：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**中国用户可以使用国内镜像：**

```bash
/bin/bash -c "$(curl -fsSL https://gitee.com/ineo6/homebrew-install/raw/master/install.sh)"
```

安装完成后，根据提示将 Homebrew 添加到 PATH：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

验证安装：
```bash
brew --version
```

## 2️⃣ 安装 Node.js 和 npm

```bash
brew install node
```

验证安装：
```bash
node -v  # 应该显示 v18 或更高
npm -v   # 应该显示 9 或更高
```

## 3️⃣ 安装前端依赖并启动

```bash
# 进入前端目录
cd ~/Desktop/aura-platform/vite-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

**预期输出：**
```
VITE v5.1.0 ready in 200-500ms
➜ Local: http://localhost:3000/
```

浏览器会自动打开，或手动访问 http://localhost:3000

## 4️⃣ 安装 Phantom 钱包（可选）

1. 访问 Chrome 扩展商店
2. 搜索 "Phantom"
3. 点击"添加到 Chrome"
4. 创建或导入钱包
5. 切换到 Devnet
6. 访问 https://faucet.solana.com 获取测试 SOL

## 5️⃣ 智能合约开发（可选）

如果你想开发或部署智能合约，需要安装以下工具：

### 安装 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 安装 Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

添加到 PATH：
```bash
export PATH="/Users/$USER/.local/share/solana/install/active_release/bin:$PATH"
```

### 安装 Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### 构建智能合约

```bash
cd ~/Desktop/aura-platform
anchor build
```

## ✅ 验证安装

运行以下命令验证所有工具已正确安装：

```bash
# 基础工具
brew --version
node -v
npm -v

# 智能合约工具（如果已安装）
rustc --version
solana --version
anchor --version
```

## 🎉 开始使用

### 快速启动（推荐）

使用提供的启动脚本：

```bash
cd ~/Desktop/aura-platform
./scripts/start.sh
```

### 手动启动

```bash
cd ~/Desktop/aura-platform/vite-app
npm run dev
```

## 🐛 常见问题

### Q: npm: command not found
**A:** Node.js 未正确安装或未添加到 PATH。重新安装 Node.js。

### Q: 端口 3000 被占用
**A:** 运行 `lsof -i :3000` 查看占用进程，或使用其他端口。

### Q: 依赖安装失败
**A:** 删除 `node_modules` 和 `package-lock.json`，重新运行 `npm install`。

### Q: Vite 启动慢
**A:** 这是正常的首次启动。后续启动会很快（200-500ms）。

## 📞 需要帮助？

查看更多文档：
- [README.md](README.md) - 项目概述
- [AURA_PROJECT_COMPLETE_GUIDE.md](AURA_PROJECT_COMPLETE_GUIDE.md) - 完整指南
- [MAC_SETUP_GUIDE.md](MAC_SETUP_GUIDE.md) - Mac 设置详解

---

**祝你使用愉快！** 🚀
