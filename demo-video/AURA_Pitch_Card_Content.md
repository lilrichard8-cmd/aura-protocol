# AURA Pitch Video · Card Content Brief
**v1 → v2 内容填充清单**
*Created 2026-05-11 凌晨，明早编辑视频时把每段卡片按这里抄进 .tsx*

---

## 设计原则

每张卡片要让评委 **3 秒读完一个事实，5 秒记住一个数字**。所有内容来自 Litepaper / Whitepaper v1.1 §3-§5，不杜撰。

字数控制：
- 每个 stat：1-2 行 × 18-22 字符
- 每个 bullet：3-5 词
- 标题永远 1-3 词，副标题 5-8 词

---

## 🎬 Act 2 · Problem（4 张 borrow 卡）

每张卡再加 **1 个具体数字 + 1 个 micro-stat 行**，目前只有 verb + sub。

### Card 1 · Audiences (rented)
```
👥
AUDIENCES
rented from platforms

  85%
  of creators say their account
  could vanish overnight

— Source: Patreon Creator Census 2024
```

### Card 2 · Reach (gated)
```
📊
REACH
gated by an algorithm black box

  −40%
  YoY drop in organic CPM
  across major platforms

— Source: Influencer Marketing Hub 2025
```

### Card 3 · Identity (lost)
```
🔒
IDENTITY
one ban erases a decade

  10+ years
  of audience-building
  reset on platform terms

— Source: 2024 mass-deplatforming reports
```

### Card 4 · Upside (extracted)
```
💸
UPSIDE
flows to the platform, not the maker

  <5%
  of total creator economy revenue
  reaches the creator

— Source: $130B "creator economy" disaggregated
```

---

## 🎬 Act 3 · Insight（5 个 primitive chip）

每个 chip 现在只有一个图标 + 一个词。**加一个 mono-font 描述**：

| Chip | 现在 | 加上 |
|---|---|---|
| 🆔 Identity   | "Identity"   | `wallet · MPC · email-login` |
| 🪙 Tokens      | "Tokens"     | `ORA · Creator Coins · SPL` |
| 📦 Storage     | "Storage"    | `Arweave · 200-year guarantee` |
| ⚖️ Settlement  | "Settlement" | `Solana · 50K TPS · sub-cent` |
| ⭐ Reputation  | "Reputation" | `SBT · earned, not bought` |

视觉：chip 现在是单行；改成两行——大字"Identity"/小字下面是描述。

---

## 🎬 Act 4 · Solution（5 pillars 卡片）

每张 pillar 卡的左侧文字区**保持现有 4 字段**，但加入：
1. 一个 **vertical metric strip**（3 个数）
2. 右侧抽象球被替换为 **真实数据可视化**

### Pillar 1 · Creator Coin
左侧增 metric strip：
```
10,000     supply / coin
100        followers to mint
2,000      unlock at TGE · free
```
右侧球内/外增加：
- 主球边上一行小字：`8,000 vests over 10 months`
- 底部 ribbon："Holding-type for access · Consumable-type for redemption"

### Pillar 2 · Curation Mining
左侧增 metric strip：
```
1 ORA      per curation action
5×         multiplier for early discovery
25×        max for first curator on hidden talent
```
右侧球底部 caption："Discovery as labor · paid by the protocol"
中间数字层叠展示：1× → 5× → 25× 数字逐次浮现

### Pillar 3 · Portable Graph
左侧增 metric strip：
```
4          things on-chain
SBT        reputation, soulbound
SPL        Creator Coins
Arweave    content history
```
右侧球内放 4 行小标签：Followers / Reputation / Coins / Content
底部 ribbon："If we vanish tomorrow, your audience walks away with you"

### Pillar 4 · ORA Token
左侧增 metric strip：
```
1.1B       initial supply
5%→2%      annual emission, declining
5% / tx    unified protocol fee
2% burn    on every transfer
```
右侧球内：火焰渐变 + 公式漂浮：`burn > mint = deflation 📈`
底部 ribbon："Not scarce because limited. Increasingly scarce because valuable."

### Pillar 5 · Permanent Storage
左侧增 metric strip：
```
Arweave    permanent network
200 yrs    mathematical guarantee
0          cost to creator
auto-pin   on every publish
```
右侧球内：旋转着 SHA hash 截断 + 时间戳
底部 ribbon："Frontends can disappear. Platforms can fail. The work cannot."

---

## 🎬 Act 5 · Doorway（双门廊）

现在每个门廊只有 3 个步骤行。**加上具体 UX 文案 + 后台机制说明**：

### Web2 门廊（左侧 teal）
```
WEB2

[ 1 ] Email or phone
      One-tap sign in. No app install.

[ 2 ] MPC wallet
      Created behind the scenes.
      Threshold-2-of-3 split,
      protocol relays gas.

[ 3 ] Never see seed phrase
      Never pay a gas fee.
      Recover with email + phone.

→ User does not know they are using Web3.
```

### Web3 门廊（右侧 amber）
```
WEB3

[ 1 ] Connect wallet
      Phantom · Backpack · Solflare.
      One signature.

[ 2 ] Sign welcome message
      Free, no transaction.
      Prove ownership.

[ 3 ] Same identity, every frontend
      Mainstream / AfterDark /
      anyone you build.

→ Same protocol. Same coins. Same followers.
```

中央 AURA Protocol 核心标签下加一行小字：`relays gas · settles in 400ms · fees 5% unified`

---

## 🎬 Act 6 · Open Frontends（3 张 frontend 卡）

每张卡现在只有 name / sub / desc。**再加一个 metric row + 一个真实例子**：

### Frontend 1 · Mainstream
```
🌸
MAINSTREAM
Reference implementation

  Free · Open-source · MIT-licensed
  Built by the core team

  → Live demo: aura.builders
  → Source: github.com/aura-protocol/mainstream
```

### Frontend 2 · AfterDark
```
🌙
AFTERDARK
Adult-content frontend

  Separate compliance scope
  · Age verification at frontend
  · Same protocol, isolated frontend

  → Live demo: afterdark.aura.builders
```

### Frontend 3 · Anyone Else
```
✦
ANYONE ELSE
Permissionless frontend registration

  Run any policy:
  · KYC tier · Regional gating
  · Content rules · Custom curation

  → Register on-chain in one tx
  → 95% of revenue stays with you
```

底部 shared protocol bar 加副标：`5% protocol fee · 95% to frontends · creators carry one identity`

---

## 🎬 Act 7 · Why Now（3 张柱）

每柱现在 sub / title / metric / metricUnit / body。**body 太长了，body 改成 3 个 micro-bullet**：

### Column 1 · Solana
```
PERFORMANCE
Solana

  50K
  TPS

  · Sub-cent fees
  · 400ms finality
  · Compressed NFTs at scale
```

### Column 2 · Regulation
```
TAILWIND
Regulation

  SEC
  33-11412

  · Protocol mining → not securities
  · Staking rewards → not securities
  · Airdrops on participation → exempt
```

### Column 3 · Team
```
AI-NATIVE
Team

  4.55 + 2.73
  % team allocation

  · Søren — human, 4.55%
  · Iris — AI co-founder, 2.73%
  · Same vesting · Same lock-up
```

---

## 🎬 Act 8 · Vision（CTA 卡）

CTA 卡片加一段具体的 30-min 体验清单：

### 当前 CTA 卡内容
```
CONNECT · MINT · CURATE
aura.builders
Built for Colosseum 2026 · by Søren & Iris
```

### 改成
```
THIRTY MINUTES — TO FEEL IT.

aura.builders

[ 1 ]  Connect a wallet (or sign in by email)
[ 2 ]  Mint your Creator Coin (free, takes 30s)
[ 3 ]  Curate one post you believe in
[ 4 ]  Vote on an open governance proposal
[ 5 ]  Tip 5 ORA to a creator you discovered

— Built for Colosseum 2026 · by Søren & Iris
— Litepaper: aura.builders/litepaper
— Code: github.com/aura-protocol
```

---

## 📐 实现注意事项（明早动手时看）

### 字号回收预算
现在 Solution / OpenFrontends / WhyNow 卡的字号都偏大（44-60px 标题 + 22-26px 描述）。加 metric strip 后总高度会超 → **每张卡内字号需统一缩 15-20%**：
- Pillar name 124 → 96
- Pillar claim 52 → 40
- Pillar description 26 → 20
- 给 metric strip 留出 200px 高度

### Mono font 使用约束
Metric strip / 数字 / 路径 / hash 全用 `JetBrains Mono`（已在 shared.ts 定义）。普通副本依然用 Inter。

### 3 主题适配检查
所有新加的 metric / bullet / ribbon **必须**用 `COLORS.fg / COLORS.muted / COLORS.tealLight / COLORS.amberMid`，不准硬编 `#` 或 `'white'`，否则 light 主题又会瞎。

### 数据来源批注
所有 metric 在 .tsx 文件里加 `// Source: ...` 注释，方便明天审核 / 评委追问时随时找证据。

---

## 🌸 一句话总结

**v1 卡片是"骨架"，v2 是"骨架 + 数据 + 真实 UI 文案"。** 评委看 v1 觉得"看起来不错但很空"，看 v2 应该有"这帮人真的把账算到家了"的感觉——每个支柱给你一个数字 + 一个机制 + 一个 punchline。

明早干完这一遍后，再看是否需要：
- 把 abstract 抽象球换成真产品截图（Studio / Coin Studio / Curation Page）
- 加 7-8s 真录屏镶嵌（让"这是 working protocol 不是 deck"自证）
