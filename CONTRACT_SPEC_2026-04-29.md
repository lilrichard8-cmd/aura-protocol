# AURA Creator Coin 合约层开发 Spec

**版本**：2026-04-29
**作者**：Iris
**Authoritative Source**：白皮书 v1.0（`/Users/lizhuoyu/Desktop/AURA_Whitepaper_v1.0.md`）— 任何冲突以白皮书为准。
**项目根目录**：`/Users/lizhuoyu/Desktop/aura-platform/`
**合约目录**：`/Users/lizhuoyu/Desktop/aura-platform/programs/`

---

## 0. 上下文

前端（`aura-mainstream`）已实现完整 Creator Coin 业务流程，包括：
- Mint 10,000 (2,000 unlocked + 8,000 vesting 10 个月分批解锁)
- Primary issuance（粉丝从创作者直购）
- 卖单托管（list / cancel / fill）
- 买单托管（list / cancel / fill）
- Holder Benefits（hold-to-enjoy + pay-to-redeem）
- Redemption 三步托管（initiate / mark_delivered / confirm / auto_confirm / dispute）
- Gift CC（零手续费转账 + memo）
- Notifications（前端订阅事件）

合约层需要补全或重写以匹配。本 spec 列出 11 项工作。前 8 项是新开发，后 3 项是对现有合约的复核。

合约目录已有：`creator-coin`、`market`、`governance`、`staking`、`reputation`、`ora`、`content-license`、`content-key`、`core`、`curation`、`fractionalize`、`livestream`、`remix`、`rewards`、`social-graph`、`type-b`、`vault`。**优先在已有 program 上扩展，避免破坏现有部署。**

---

## ⚠️ 白皮书关键约束（开发前必读）

1. **§3.3 / §6.2** — Creator Coin: 总量 10,000 固定，2,000 初始 unlocked，8,000 月度解锁（每月 800 × 10 月）。月度解锁需活跃度（任 2/3：5+ posts / 任意 CC 交易 / 20+ 互动）。
2. **§5.6** — 统一 5% 交易手续费 = 2% Burn + 2% Staking + 0.5% Gas + 0.5% Ops。
3. **§5.6** — 用 CC 支付（pay with creator's own CC）创作者得 100%，**不再额外收 5%**（5% 已在该 CC 的 marketplace transaction 时收过）。
4. **§6.3** — Consumable benefits：消耗的 CC **回到创作者池**（NOT burned）。
5. **§6.4** — Marketplace 用 **posting/listing model**，**不是 order book**。语义是 "listings + wanted posts"，但实现机制本质相同（PDA + 双向匹配）。本 spec 用 SellOrder/BuyOrder 命名，但功能等同于白皮书的 "listing" 和 "wanted post"。
6. **§6.4** — 二级交易**没有版税**。
7. **§13.8** — Arbitration 用 **two-trial system + reputation-weighted random VRF selection**。Year 1 由 core team 多签作为终审。
8. **§14** — Gas Abstraction：标准操作（tipping, following, content publishing, curation, CC trading）的 Solana network fee 由协议代付。

---

## 🔴 #1 Redemption Escrow（兑换托管）

### 路径：`programs/creator-coin/src/redemption.rs`（新增模块）

### PDA: `Redemption`

```rust
#[account]
pub struct Redemption {
    pub id: u64,
    pub coin_mint: Pubkey,
    pub benefit_id: u32,
    pub cost: u64,                          // 锁定的 CC 数量
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub status: RedemptionStatus,
    pub created_at_slot: u64,
    pub delivered_at_slot: Option<u64>,
    pub confirmed_at_slot: Option<u64>,
    pub disputed_at_slot: Option<u64>,
    pub delivery_note_uri: String,         // IPFS/Arweave URI（可空）
    pub delivery_note_hash: [u8; 32],
    pub dispute_reason_uri: String,
    pub dispute_reason_hash: [u8; 32],
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RedemptionStatus {
    PendingDelivery,
    Delivered,
    Confirmed,
    Disputed,
}
```

**PDA seeds**：`["redemption", coin_mint.as_ref(), id.to_le_bytes().as_ref()]`
**Escrow Token Account**：`["redemption-escrow", redemption.key().as_ref()]` (CC ATA)

### Counter PDA: `RedemptionCounter`（每个 coin 一个，跟踪自增 id）

### 指令

#### `initiate_redemption(coin_mint, benefit_id, cost)`
- 调用者：buyer
- 校验：benefit_id 存在；benefit.benefit_type == Consumable；benefit.threshold == cost；buyer 持有 ≥ cost；buyer != creator
- 行为：CC 从 buyer 转入 escrow PDA；status = PendingDelivery；emit event

#### `mark_delivered(redemption_id, note_uri, note_hash)`
- 调用者：**仅 creator**
- 校验：status == PendingDelivery
- 行为：status = Delivered；记录 delivered_at_slot；emit event

#### `confirm_receipt(redemption_id)`
- 调用者：**仅 buyer**
- 校验：status == Delivered
- 行为：CC 从 escrow → creator's ATA；status = Confirmed；emit event

#### `auto_confirm(redemption_id)`
- 调用者：**任何人**（permissionless keeper）
- 校验：status == Delivered AND `Clock::get()?.slot > delivered_at + AUTO_CONFIRM_SLOTS`
- `AUTO_CONFIRM_SLOTS` = 7 天 ≈ 1,512,000 slots（按 Solana ~400ms/slot）
- 行为：与 confirm_receipt 相同；emit event 区分（auto: bool 字段）

#### `dispute_redemption(redemption_id, reason_uri, reason_hash)`
- 调用者：**仅 buyer**
- 校验：status == Delivered
- 行为：status = Disputed；CC 留在 escrow；emit event

### Events
```rust
#[event] pub struct RedemptionInitiated { id, coin_mint, buyer, benefit_id, cost, slot }
#[event] pub struct RedemptionDelivered { id, note_uri, slot }
#[event] pub struct RedemptionConfirmed { id, by_auto: bool, slot }
#[event] pub struct RedemptionDisputed { id, reason_uri, slot }
```

---

## 🔴 #2 Sell Order Escrow（卖单托管）

### 路径：`programs/market/src/sell_order.rs`

### PDA: `SellOrder`

```rust
#[account]
pub struct SellOrder {
    pub id: u64,
    pub coin_mint: Pubkey,
    pub seller: Pubkey,
    pub amount_remaining: u64,
    pub price_per_coin_lamports: u64,
    pub created_at_slot: u64,
    pub status: OrderStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum OrderStatus { Open, Cancelled, Filled }
```

**PDA seeds**: `["sell-order", coin_mint.as_ref(), id.to_le_bytes().as_ref()]`
**Escrow Token Account**: `["sell-order-escrow", sell_order.key().as_ref()]` (CC ATA)

### 指令

#### `place_sell_order(coin_mint, amount, price_per_coin)`
- 调用者：seller；校验持有 ≥ amount，amount > 0，price > 0
- 行为：CC 从 seller → escrow

#### `cancel_sell_order(order_id)` — 仅 seller，status==Open

#### `fill_sell_order(order_id, fill_amount)`
- 调用者：任何 buyer
- 行为：escrow CC → buyer；buyer 的 ORA 按 5% 拆分（2% burn / 2% staking / 0.5% gas / 0.5% ops），剩 95% 给 seller
- amount_remaining -= fill_amount；归零则 status = Filled

### Events: SellOrderPlaced / SellOrderFilled / SellOrderCancelled

---

## 🔴 #3 Buy Order Escrow（买单托管）

### 路径：`programs/market/src/buy_order.rs`

### PDA: `BuyOrder`

```rust
#[account]
pub struct BuyOrder {
    pub id: u64,
    pub coin_mint: Pubkey,
    pub buyer: Pubkey,
    pub amount_wanted: u64,
    pub price_per_coin_lamports: u64,
    pub ora_locked_lamports: u64,          // amount × price × 1.05
    pub created_at_slot: u64,
    pub status: OrderStatus,
    pub bump: u8,
}
```

**Escrow**: ORA ATA，PDA seeds 类似 sell-order。

### 指令
- `place_buy_order` — buyer，锁 ORA
- `cancel_buy_order` — buyer
- `fill_buy_order` — 任何 seller，从 escrow 取 ORA 分配，CC 给 buyer

### Events: BuyOrderPlaced / BuyOrderFilled / BuyOrderCancelled

---

## 🔴 #4 Gift Transfer（红包式转账）

### 路径：`programs/creator-coin/src/gift.rs`

### 指令

#### `gift_creator_coin(coin_mint, amount, recipient, memo_uri)`
- 调用者：sender
- 校验：sender 持有 ≥ amount，amount > 0
- 行为：
  - **零手续费**（不收 5%，不进 burn/staking）
  - sender CC → recipient 的 CC ATA
  - 若 ATA 不存在，sender sponsor 创建（rent ~0.002 SOL）—— 协议代付（gas abstraction §5.12）
  - 通过 Solana Memo Program 写入 memo_uri（可选）
- emit event

### Events
```rust
#[event] pub struct GiftSent { coin_mint, sender, recipient, amount, memo_uri, slot }
```

---

## 🔴 #5 Benefits 元数据

### 路径：`programs/creator-coin/src/benefits.rs`

### PDA: `BenefitsList`（每个 coin 一个）

```rust
#[account]
pub struct BenefitsList {
    pub coin_mint: Pubkey,
    pub creator: Pubkey,
    pub benefits: Vec<Benefit>,            // 上限 50 条
    pub next_id: u32,
    pub bump: u8,
}

pub struct Benefit {
    pub id: u32,
    pub benefit_type: BenefitType,         // Holding / Consumable
    pub threshold: u64,                    // hold = 阈值；consumable = 兑换 cost
    pub metadata_uri: String,
    pub metadata_hash: [u8; 32],
    pub is_active: bool,
}

pub enum BenefitType { Holding, Consumable }
```

**PDA seeds**: `["benefits", coin_mint.as_ref()]`

### 指令
- `init_benefits_list(coin_mint)` — creator only，mint 时自动调用
- `add_benefit(coin_mint, type, threshold, uri, hash)` — creator only，上限 50
- `update_benefit(coin_mint, id, ...)` — creator only
- `deactivate_benefit(coin_mint, id)` — creator only（不删除，因有历史 redemption 引用）

---

## 🟡 #6 Event Emission

为现有所有指令补全 event emit。除上述事件外补充：

```rust
#[event] pub struct CoinMinted { mint, creator, slot }
#[event] pub struct PrimaryIssuanceBuy { coin, buyer, amount, price, fee, slot }
#[event] pub struct VestingBatchUnlocked { coin, batch_index, batch_price, slot }
#[event] pub struct BurnExecuted { amount, source, slot }
```

前端 indexer（off-chain）订阅事件。本 spec 不实现 indexer，只确保事件 emit。

---

## 🟡 #7 Auto-confirm 时钟

实现已嵌入 #1 的 `auto_confirm` 指令。Permissionless（任何人都可调），可选激励。

---

## 🟡 #8 Dispute 仲裁路径（按白皮书 §13.8）

### 路径：`programs/governance/src/arbitration.rs`

### 必须严格按白皮书 §13.8 实现：

#### ArbitratorRegistry（候选池）

```rust
#[account]
pub struct ArbitratorRegistry {
    pub arbitrators: Vec<Arbitrator>,
    pub total_pool_size: u32,
    pub bump: u8,
}

pub struct Arbitrator {
    pub user: Pubkey,
    pub ars: u64,                          // Arbitration Reputation Score
    pub staked_ora_lamports: u64,          // ≥ 10,000 ORA
    pub joined_at_slot: u64,
    pub is_in_other_committee: bool,
    pub last_penalty_slot: Option<u64>,
    pub excluded_until_slot: Option<u64>,  // 缺席惩罚 30 天
}
```

#### `register_as_arbitrator()`
- 校验：staked_ora ≥ 10,000，platform active ≥ 6 月，无 Level II 处罚，不在其他 committee
- 行为：加入 registry；ARS 默认 0

#### Dispute PDA

```rust
#[account]
pub struct Dispute {
    pub id: u64,
    pub redemption_id: u64,
    pub coin_mint: Pubkey,
    pub plaintiff: Pubkey,                 // buyer
    pub defendant: Pubkey,                 // creator
    pub filed_at_slot: u64,
    pub status: DisputeStatus,

    pub trial1_jury: [Pubkey; 5],
    pub trial1_rulings: Vec<JurorRuling>,
    pub trial1_deadline_slot: u64,
    pub trial1_outcome: Option<Ruling>,
    pub trial1_concluded_at_slot: Option<u64>,

    pub trial2_panel: Option<[Pubkey; 7]>,
    pub trial2_rulings: Vec<JurorRuling>,
    pub trial2_deadline_slot: Option<u64>,
    pub trial2_outcome: Option<Ruling>,

    pub appeal_deadline_slot: Option<u64>, // trial1 + 7 天
    pub earnings_escrow_amount: u64,
    pub earnings_escrow_until_slot: u64,   // filed_at + 60 天
}

pub struct JurorRuling {
    pub juror: Pubkey,
    pub vote: Ruling,
    pub reasoning_uri: String,
    pub submitted_at_slot: u64,
}

pub enum Ruling {
    ReleaseToCreator,
    RefundBuyer,
    Split { creator_share_bps: u16 },
}

pub enum DisputeStatus {
    Filed, Trial1JurySelected, Trial1Pending, Trial1Concluded,
    Trial2PanelSelected, Trial2Pending, Resolved, Dissolved, EarningsAutoReleased,
}
```

#### 指令
- `file_dispute(redemption_id, reason_hash)` — buyer
- `select_trial1_jury(dispute_id)` — permissionless，VRF 抽 5 人
- `submit_trial1_ruling(dispute_id, vote, reasoning_uri)` — 5 人之一
- `finalize_trial1(dispute_id)` — 5 都到齐 OR deadline 到，simple majority
- `appeal_to_trial2(dispute_id)` — 败诉方在 7 天内
- `select_trial2_panel(dispute_id)` — VRF 抽 7 人，ARS ≥ 100，与 trial1 不重叠；不足 7 人时按 ARS 降序取 top 7
- `submit_trial2_ruling(...)` / `finalize_dispute(...)`
- `dissolve_panel_for_absence(dispute_id)` — 缺席者 ARS -20 + 30 天禁选

#### 抽签权重函数（白皮书原文）
```rust
fn weight(ars: u64) -> u64 {
    if ars < 50 { 1 }
    else if ars <= 200 { ars / 50 }
    else { 4 + ((ars - 200) as f64).ln() as u64 }
}
```

#### ARS 增减（白皮书原文）
| 行为 | ARS |
|---|---|
| Trial 1 完成 ruling（含书面理由） | +10 |
| Ruling 与最终一致（majority） | +5 |
| Trial 2 完成 ruling | +15 |
| Trial 2 ruling 未被推翻 | +10 |
| 隐瞒利益冲突 | -50 |
| 缺席 | -20 |
| 二审认定明显偏见 | -30 |

#### Year 1 过渡

```rust
pub struct ArbitrationGovernance {
    pub phase: ArbitrationPhase,
    pub core_team_multisig: Pubkey,
    pub transition_at_slot: u64,
}
pub enum ArbitrationPhase { Year1Bootstrap, FullCommunity }
```

Year 1：finalize_dispute 时 core_team_multisig 可 override jury（但必须有书面解释 hash）。

#### CPI 到 Redemption

`finalize_dispute` 必须能 CPI 调 creator-coin program 的 `execute_ruling` 处置 redemption escrow。

#### VRF
用 Switchboard VRF 或 ORAO VRF。如项目里没集成过，先 stub 一个 placeholder（用 `Clock::get()?.slot.hash()` 做伪随机，标 TODO，等后续集成）。

---

## 🟢 #9 Mint / Vesting（复核）

### 路径：已有 `programs/creator-coin/src/lib.rs`

复核：
- [ ] 总量 10,000 hard-coded
- [ ] 初始 2,000 → creator wallet
- [ ] 8,000 → VestingAccount PDA
- [ ] 月度解锁 800（slot 间隔 ≈ 6,480,000 = 30 days × 216,000）
- [ ] 解锁前置检查活跃度（任 2/3：5+ posts / 任意 CC 交易 / 20+ 互动）—— 如缺失暂时 stub，标 TODO
- [ ] `set_batch_target_price` 创作者预设/调整未来批次价
- [ ] `update_realized_price` 已解锁批次实际价
- [ ] mint 自动调用 `init_benefits_list`（#5）
- [ ] mint 自动 emit `CoinMinted` event

如缺失，补齐。

---

## 🟢 #10 Primary Issuance + 5% 手续费（复核）

```
gross_ora = amount × current_batch_price
fee = gross_ora × 5%
  - 2% gross → BurnPool
  - 2% gross → StakingRewards
  - 0.5% gross → GasReserve
  - 0.5% gross → OpsTreasury
creator 实收：gross × 95%
```

复核：
- [ ] 4 个分配桶 PDA 都创建？
- [ ] 每次 buy 正确分配？
- [ ] emit `PrimaryIssuanceBuy` event
- [ ] 卖光逻辑（remaining = 0 时 throw "sold out"）

---

## 🟢 #11 Burn 累计（复核）

```rust
#[account]
pub struct BurnTracker {
    pub total_burned_lamports: u128,
    pub last_updated_slot: u64,
    pub bump: u8,
}
```

复核：
- [ ] BurnPool 收到的 ORA 是否真烧（spl-token burn）？白皮书 §5.8 说 Permanent — 真烧更符合
- [ ] 每次 buy/fill 时 BurnTracker 更新

---

## 📋 开发任务优先级

### Phase 1（高优先级）
- #5 Benefits 元数据（其他模块依赖）
- #1 Redemption Escrow（含 #7 auto-confirm）
- #2 Sell Order Escrow
- #3 Buy Order Escrow
- #4 Gift Transfer

### Phase 2
- #6 Event Emission（cross-cutting）
- #8 Dispute 仲裁（VRF 可 stub）

### Phase 3（复核现有）
- #9 Mint / Vesting
- #10 Primary Issuance
- #11 Burn Tracker

---

## 🛠 测试要求

每个新模块：
1. Anchor unit tests 在 `tests/`
2. 覆盖：happy path / 边界 / 权限拒绝 / 状态机非法转移
3. `anchor build` 通过
4. `anchor test` 全过

---

## 🔗 引用文件

- 白皮书：`/Users/lizhuoyu/Desktop/AURA_Whitepaper_v1.0.md`
- 项目根：`/Users/lizhuoyu/Desktop/aura-platform/`
- 合约目录：`/Users/lizhuoyu/Desktop/aura-platform/programs/`
- 前端 mock 实现参考：`/Users/lizhuoyu/Desktop/aura-platform/aura-mainstream/src/context/MockChainContext.tsx`
- 不要修改：`aura-mainstream/`、`aura-afterdark/`、`iris-chat/`（这些是前端）
