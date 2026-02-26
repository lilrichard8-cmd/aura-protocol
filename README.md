# 🌟 AURA (灵光) - 去中心化创作者平台

**定格你的灵光 · 真正的所有权 · 公平的经济**

AURA 是一个基于 Solana 和 Arweave 的去中心化创作者平台，旨在对抗中心化平台的审查和剥削。

## ✨ 核心特性

- 🔒 **永久存储** - 基于 Arweave，内容永不丢失，无人可删除
- 💰 **95% 收益** - 创作者获得 95% 收益，平台仅收取 5% 手续费
- 🗳️ **DAO 治理** - 5 个专业委员会管理，3-5 年后完全去中心化
- ⚡ **高性能** - 基于 Solana，TPS 3000+，交易费用低廉
- 🎨 **NFT 市场** - 一键铸造 NFT，支持多种交易方式
- 🛡️ **版权保护** - 7 天收益锁定期，可追回被盗内容收益
- 📺 **广告分成** - 50% 广告费给观众，革命性注意力经济
- 🔗 **二创许可** - 自动分账系统，原创和二创者共同受益

## 🚀 快速开始

### 前端应用（推荐：Mac 环境）

```bash
# 1. 安装依赖
cd vite-app
npm install

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器
open http://localhost:3000
```

### 智能合约开发

```bash
# 1. 安装 Rust 和 Solana CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# 2. 安装 Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# 3. 构建所有程序
anchor build

# 4. 运行测试
anchor test

# 5. 部署到 Devnet
solana config set --url devnet
anchor deploy
```

## 📂 项目结构

```
aura-platform/
├── programs/                    # Solana 智能合约
│   ├── core/                    # 用户和内容管理
│   ├── vault/                   # 金库和 7 天锁仓
│   ├── governance/              # DAO 治理系统
│   └── market/                  # NFT 市场和交易
├── vite-app/                    # Vite 前端（推荐）
│   ├── src/
│   │   ├── components/          # React 组件
│   │   ├── pages/               # 页面
│   │   └── hooks/               # 自定义 hooks
│   └── package.json
├── docs/                        # 项目文档
├── scripts/                     # 部署脚本
├── Anchor.toml                  # Anchor 配置
├── Cargo.toml                   # Rust 工作空间
└── README.md                    # 本文件
```

## 💰 $ORA 代币经济

- **总供应量**: 20 亿（软顶）
- **分发模式**: 对数递减，早期创作者获益更多
- **销毁机制**: 
  - NFT 铸造费 100%
  - 交易费 2.5%
  - 广告费 50%
- **质押**: 100+ $ORA 可参与治理

## 🏛️ 治理架构

5 个专业委员会：

1. **发展委员会** - 外部合作（前 5 年团队管理）
2. **内容委员会** - 内容政策制定
3. **运营委员会** - 年度 5000 万 $ORA 预算
4. **仲裁委员会** - 争议解决（7 人随机小组）
5. **技术委员会** - 代码审计和升级

## 🛠️ 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 区块链 | Solana | 高性能 L1 |
| 智能合约 | Anchor (Rust) | 安全的合约框架 |
| 存储 | Arweave + Irys | 永久去中心化存储 |
| 前端 | Vite + React + TypeScript | 快速开发 |
| 样式 | Tailwind CSS | 响应式设计 |
| 钱包 | Solana Wallet Adapter | 多钱包支持 |

## 📚 文档

- [完整项目指南](AURA_PROJECT_COMPLETE_GUIDE.md)
- [Mac 设置指南](MAC_SETUP_GUIDE.md)
- [快速开始](📘_START_ON_MAC.md)
- [技术架构](docs/ARCHITECTURE.md)
- [治理模型](docs/GOVERNANCE.md)
- [代币经济](docs/TOKENOMICS.md)

## 🔧 环境要求

### 前端开发
- Node.js 18+
- npm 9+
- 现代浏览器（Chrome/Brave/Firefox）
- Phantom 钱包扩展

### 智能合约开发
- Rust 1.70+
- Solana CLI 1.16+
- Anchor 0.29+

## 🌐 部署

### 前端（Vercel）

```bash
cd vite-app
vercel
```

### 智能合约（Devnet）

```bash
solana config set --url devnet
anchor deploy
```

### 智能合约（Mainnet）

```bash
solana config set --url mainnet-beta
anchor deploy
```

## 🧪 测试

```bash
# 前端测试
cd vite-app
npm test

# 智能合约测试
anchor test
```

## 📦 构建

```bash
# 前端构建
cd vite-app
npm run build

# 智能合约构建
anchor build
```

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 📄 许可证

MIT License

## 📞 联系我们

- Discord: [AURA Community](https://discord.gg/aura)
- Twitter: [@AuraPlatform](https://twitter.com/aura)
- GitHub: [github.com/aura-platform](https://github.com/aura-platform)

## 🎯 路线图

- ✅ Q1 2026: 智能合约开发完成
- ✅ Q2 2026: 前端基础完成
- ⏳ Q2 2026: 前端完善和集成
- ⏳ Q3 2026: 安全审计
- ⏳ Q3 2026: Mainnet 上线
- ⏳ Q4 2026: 移动应用
- ⏳ 2027: 完全去中心化

## ⚡ 开发状态

- 智能合约: ✅ 100%
- 前端基础: ✅ 40%
- 集成测试: ⏳ 待完成
- 安全审计: ⏳ 待完成

---

**Built with ❤️ for creators, by creators.**
