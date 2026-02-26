# ⚡ AURA 快速开始指南

**5 分钟启动你的 AURA 平台！**

---

## 📋 你需要什么

- ✅ Mac 电脑（macOS 12.0+）
- ✅ 终端（Terminal）
- ✅ 5-10 分钟时间

---

## 🚀 三步启动

### 步骤 1: 安装 Homebrew 和 Node.js

在终端运行以下命令：

```bash
# 安装 Homebrew（中国镜像，速度更快）
/bin/bash -c "$(curl -fsSL https://gitee.com/ineo6/homebrew-install/raw/master/install.sh)"

# 安装 Homebrew 后，需要将其添加到 PATH
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# 安装 Node.js
brew install node
```

**预计时间**: 3-5 分钟

### 步骤 2: 安装前端依赖

```bash
# 进入前端目录
cd ~/Desktop/aura-platform/vite-app

# 安装依赖
npm install
```

**预计时间**: 1-2 分钟

### 步骤 3: 启动开发服务器

```bash
# 启动
npm run dev
```

**预计时间**: 1-2 秒

---

## 🎉 成功！

当你看到以下输出时，说明成功了：

```
VITE v5.1.0 ready in 207ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.x.x:3000/
```

浏览器会自动打开，或者手动访问 http://localhost:3000

---

## 🌟 你会看到什么

### 首页
- ✅ 渐变动画标题："定格你的灵光"
- ✅ 8 个核心特性展示
- ✅ $ORA 代币经济介绍
- ✅ 响应式设计

### 探索页
- ✅ 内容筛选（文本/图片/视频/音频）
- ✅ 排序功能（最新/最热/浏览量）
- ✅ 模拟内容展示
- ✅ 卡片式布局

### 创作页
- ✅ 内容发布表单
- ✅ 文件上传区域
- ✅ 访问控制选择
- ✅ 付费内容定价

---

## 🔗 连接钱包（可选）

1. 安装 Phantom 钱包扩展
2. 创建或导入钱包
3. 切换到 Devnet
4. 在 AURA 平台点击 "Select Wallet"
5. 选择 Phantom 并连接

---

## 📚 下一步

### 学习更多
- [README.md](README.md) - 项目概述
- [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) - 详细安装
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - 开发状态

### 开发智能合约
查看 [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) 的第 5 节

### 部署
- 前端: `npm run build` + Vercel
- 合约: `anchor build` + `anchor deploy`

---

## 🐛 遇到问题？

### Node.js 未找到
```bash
brew install node
```

### 端口被占用
```bash
# 查看占用
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

### 依赖安装失败
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 💡 专业提示

### 使用启动脚本
```bash
cd ~/Desktop/aura-platform
./scripts/start.sh
```

### 开发时的热更新
保存文件后，浏览器会自动刷新（<100ms）

### 查看控制台
按 `Cmd + Option + I` 打开浏览器开发者工具

---

## 📊 项目统计

- 📝 智能合约: ~1200 行 Rust
- 🎨 前端代码: ~800 行 TypeScript/React
- 📚 文档: ~2000 行 Markdown
- ⚡ 启动速度: 200-500ms
- 🔥 热更新: <100ms

---

## 🎯 核心功能

✅ **已实现**
- Solana 钱包连接
- 响应式设计
- 完整的页面导航
- 模拟数据展示

⏳ **待集成**
- Arweave 文件上传
- 智能合约交互
- Supabase 数据索引
- 实际的内容发布

---

## 🌈 设计系统

### 颜色
- 紫色: `#8B5CF6`
- 粉色: `#EC4899`
- 橙色: `#F97316`

### 渐变
```css
background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F97316 100%)
```

### 字体
- 系统默认字体栈
- 支持中英文

---

## ✅ 检查清单

在启动前，确保：

- [ ] Mac 电脑
- [ ] 已安装 Homebrew
- [ ] 已安装 Node.js
- [ ] 已进入 vite-app 目录
- [ ] 已运行 npm install
- [ ] 已运行 npm run dev
- [ ] 浏览器已打开 localhost:3000

---

## 🎊 祝贺！

你现在已经成功运行了 AURA 平台！

**接下来你可以：**
- 🎨 浏览所有页面
- 🔗 连接 Phantom 钱包
- 📝 查看创作表单
- 🔍 探索内容列表
- 💻 查看代码实现
- 📚 阅读完整文档

---

**Built with ❤️ for creators, by creators.**

🚀 **开始你的创作之旅吧！**
