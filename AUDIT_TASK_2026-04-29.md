# AURA Contracts Security Audit — 2026-04-29

## 范围
对 `/Users/lizhuoyu/Desktop/aura-platform/programs/` 下今天 (2026-04-29) 由 subagent 写的全部合约改动进行**安全 + 合规 + 业务逻辑** 三方面审计。

**今天改动的文件**（重点审计）：
- `programs/creator-coin/src/lib.rs`（+808 行）
- `programs/creator-coin/src/benefits.rs`（新建）
- `programs/creator-coin/src/redemption.rs`（新建）
- `programs/creator-coin/src/gift.rs`（新建）
- `programs/market/src/lib.rs`（+678 行）
- `programs/market/src/sell_order.rs`（新建）
- `programs/market/src/buy_order.rs`（新建）
- `programs/governance/src/lib.rs`（+654 行）
- `programs/governance/src/arbitration.rs`（新建）
- 各 Cargo.toml 改动

**对照参照**：
- Spec：`/Users/lizhuoyu/Desktop/aura-platform/CONTRACT_SPEC_2026-04-29.md`
- 白皮书：`/Users/lizhuoyu/Desktop/AURA_Whitepaper_v1.0.md`（§3.3 / §5.6 / §6 / §13.8 / §14）
- 测试：`/Users/lizhuoyu/Desktop/aura-platform/tests/aura-creator-coin.ts` / `aura-market.ts` / `aura-governance.ts`

---

## 审计维度（必须全部覆盖）

### 1. Solana / Anchor 通用漏洞
- [ ] **Integer overflow / underflow**：所有 `+` `-` `*` `/` 是否用 `checked_add` / `checked_sub` / `checked_mul` / `checked_div`？
- [ ] **Signer 检查**：每个修改 state 的指令是否用 `Signer<'info>` 或 `has_one`?
- [ ] **Account ownership / PDA validation**：seeds 是否完整？有没有 missing constraint？
- [ ] **Bump seed canonicalization**：bump 是否存在 PDA struct？避免 grinding attack
- [ ] **Account close + reinit attack**：`close = ` 后是否清零 lamports / 防 reinit
- [ ] **Reentrancy / CPI 安全**：CPI 调用前后状态是否一致？
- [ ] **Rent exemption**：所有 PDA 创建是否考虑 rent？
- [ ] **Token account ownership/mint 校验**：transfer CPI 时双方 mint 是否匹配？owner 是否对？
- [ ] **Numerical edge cases**：amount = 0 / max u64 / 极端 price 等

### 2. 业务逻辑校验
- [ ] **#1 Redemption 状态机**：是否有非法转移路径？(e.g., delivered → pending_delivery)
- [ ] **Auto-confirm 时间窗口**：`Clock::get()?.slot > delivered_at + AUTO_CONFIRM_SLOTS` 是否正确？
- [ ] **Dispute 后 CC 的资金锁定**：CC 是否真的留在 escrow 不移动？
- [ ] **#2/#3 Sell/Buy Order 拆分手续费**：5% = 2% burn + 2% staking + 0.5% gas + 0.5% ops 是否准确？是 gross 还是 net？
- [ ] **#4 Gift 必须零手续费**：gift 路径不能调到 fee 分配逻辑
- [ ] **#5 Benefits 修改**：`update_benefit` 是否影响已存在的 redemption（不应该）？
- [ ] **#8 Arbitration**：
  - 候选池 stake ≥ 10,000 ORA 校验？
  - VRF 是 stub 的吗？是否标 TODO？是否在生产前必修？
  - ARS 增减规则全部对齐白皮书 §13.8？
  - Trial1 5 人 / Trial2 7 人 / Trial2 不与 Trial1 重叠？
  - 60 天 earnings escrow 自动释放？
  - 缺席时整个 panel 解散重抽？
  - Year1 core_team_multisig 可 override（但需书面解释）？

### 3. 白皮书一致性（§ 引用必查）
- [ ] §6.2 — CC 总量 10,000 / 初始 2,000 / 月度解锁 800 × 10
- [ ] §6.2 — 月度解锁活跃度门槛（5+ posts / 任意 CC 交易 / 20+ 互动 中任 2 项）
- [ ] §6.3 — Consumable 兑换的 CC **回到创作者池而非销毁**
- [ ] §5.6 — 5% 手续费拆分比例
- [ ] §5.6 — 用 CC 支付（pay with own CC）创作者得 100%、不再额外 5%
- [ ] §6.4 — 二级交易**无版税**
- [ ] §13.8 — 仲裁两审制 + ARS + VRF 抽签 + 缺席惩罚 + Year 1 过渡
- [ ] §14 — Gas Abstraction（agreement-level，不需要合约层强制）

### 4. 与前端 (`/Users/lizhuoyu/Desktop/aura-platform/aura-mainstream/src/context/MockChainContext.tsx`) 的对齐
- [ ] 每个前端 mock 调用的方法（initiateRedemption / markRedemptionDelivered / confirmRedemptionReceipt / disputeRedemption / reserveSellOrder / releaseSellOrder / fillExternalSellOrder / giftCreatorCoin / etc.) 在合约里有对应的指令？
- [ ] 字段名 / 参数顺序是否一致？
- [ ] Symbol 命名（`$IRIS` / `IRIS`）是否双方都 normalize？

### 5. 测试覆盖度
- [ ] 测试是否真的测了 happy path / 边界 / 权限拒绝 / 状态机非法转移？
- [ ] 测试是否只是占位（mock 返回 success 而不真测合约）？
- [ ] 30 个测试通过的报告是否真实？（看测试代码深度）

---

## 输出要求

把审计结果输出到 `/Users/lizhuoyu/Desktop/aura-platform/AUDIT_REPORT_2026-04-29.md`，格式如下：

```markdown
# AURA Contracts Audit Report — 2026-04-29

## Executive Summary
- 总体安全评级：A/B/C/D
- 关键发现概述（≤5 条 bullet）
- 是否可以上 devnet 测试？是否可以上 mainnet？

## 🔴 Critical Issues（必修，影响资金安全或协议崩溃）
### Issue C-1: <短描述>
- 文件：programs/xxx/src/yyy.rs:NNN
- 现象：<具体代码片段或行号>
- 风险：<能怎么被攻击 / 损失什么>
- 修复建议：<具体改法>

## 🟠 High Issues（强烈建议修，影响业务正确性）
### Issue H-1: ...

## 🟡 Medium Issues（建议修，影响维护性 / 边角 case）
### Issue M-1: ...

## 🟢 Low / Info（可选优化）
### Issue L-1: ...

## 白皮书一致性
- 列出每条白皮书规则，标注 ✅ / ❌ / ⚠️
- 不一致的地方给出对照引用

## 前端集成对齐
- 列出前端调用方法 vs 合约指令的对照表
- 标注未对齐项

## 测试质量评估
- 30/30 测试是否真测了合约？
- 测试覆盖度评估
- 缺失的关键测试 case

## 建议的下一步行动
1. ...
2. ...
```

**审计严格性要求**：
- **不要 skim**。逐文件逐函数审。
- **不要相信 subagent 自己的报告**。anchor build / test pass ≠ 安全。
- **怀疑一切**。包括"看起来正常"的代码。
- **对照白皮书原文**而不是脑补规则。
- **特别注意 #8 Arbitration**——这是最复杂的模块，最容易出 bug。
- **VRF stub** 必须明确标注，并在 audit report 列为"⚠️ 上 mainnet 前必须替换"。

工作时长预估：1-2 小时。
