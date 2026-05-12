# AURA Protocol — Numbers Handbook

**A pocket reference of every number in AURA, at a glance.**
Source of truth: `AURA_Whitepaper_v1.0.md` (4,752 lines) · Updated 2026-05-12

---

## Table of Contents
1. [ORA Token Basics](#1-ora-token-basics)
2. [Initial Supply Allocation (1.1B)](#2-initial-supply-allocation-11b)
3. [Emissions Beyond the 1.1B Initial Supply](#3-emissions-beyond-the-11b-initial-supply)
4. [Launch Incentives — Three Sub-Programs](#4-launch-incentives--three-sub-programs)
5. [Transaction Fee / Burn / Staking](#5-transaction-fee--burn--staking)
6. [TGE Proceeds Allocation](#6-tge-proceeds-allocation)
7. [Storage Fund](#7-storage-fund)
8. [Gas Reserve Pool](#8-gas-reserve-pool)
9. [Creator Coin](#9-creator-coin)
10. [Curation Mining](#10-curation-mining)
11. [Activity Rewards / Creation Mining](#11-activity-rewards--creation-mining)
12. [Remix Revenue Sharing](#12-remix-revenue-sharing)
13. [Frontend Registry](#13-frontend-registry)
14. [Governance Tier System](#14-governance-tier-system)

---

## 1. ORA Token Basics

| Item | Value |
|---|---|
| **Ticker** | ORA |
| **Chain** | Solana |
| **Initial Supply** | **1,100,000,000** (1.1B) |
| **TGE Price** | $0.02 / ORA |
| **TGE FDV** | $22,000,000 (against 1.1B) |
| **Public Sale Size** | 50M ORA (LBP) |
| **Public Sale Max Proceeds** | $1,000,000 |
| **Sale Mechanism** | LBP (Liquidity Bootstrap Pool) |
| **VC / SAFT / Pre-sale** | **None** |

---

## 2. Initial Supply Allocation (1.1B)

| Category | Absolute | % | Notes |
|---|---|---|---|
| **Team** | **150,000,000** | **13.64%** | 1-year cliff + 3-year linear vest |
| ├─ Søren | 50,000,000 | 4.55% | Founder & CEO |
| ├─ Iris | 30,000,000 | 2.73% | AI Co-founder & CTO |
| └─ Future hires | 70,000,000 | 6.36% | Reserved |
| **Community Incentives** | **500,000,000** | **45.45%** | Creation + curation + interaction |
| **Ecosystem DAO** | **200,000,000** | **18.18%** | Governance treasury |
| **Launch Incentives** | **150,000,000** | **13.64%** | Three sub-programs (see §4) |
| **Liquidity + Bootstrap** | **100,000,000** | **9.09%** | DEX liquidity |
| **Total** | **1,100,000,000** | **100.00%** | |

---

## 3. Emissions Beyond the 1.1B Initial Supply

Four independent emission tracks operate above and beyond the 1.1B initial supply:

| Track | Size | Trigger | Destination |
|---|---|---|---|
| **① Management Performance Pool** | 30M/year × 3 years = up to 90M | DAO annual vote (zero if rejected; unused tranche burned) | Team execution bonus |
| **② Perpetual Emission** | Y1 5% → Y2 4% → Y3 3% → Y4+ 2% (permanent floor) | Hard-coded; not adjustable by governance | 80% creator rewards pool / 20% Ecosystem DAO |
| **③ MAU-Driven Emission** | 100,000 ORA per 10,000 new MAU | Tech Committee verifies → Operations Committee approves | 100% to creator rewards pool |
| **④ Storage Emission** | ≤ 3% of total supply per trigger, no annual cap | Storage Fund balance < 3 months of projected spend → DAO vote | Sold on DEX; 100% proceeds to Storage Fund |

**Year-1 Emergency Authority**: Core team may issue a single emergency mint up to **1% of total supply** (Tier I clause, auto-expires Year 2).

**Y1–Y3 estimated annualized inflation**: ~7–8% (all sources combined)
**Y4+ floor inflation**: 2%

---

## 4. Launch Incentives — Three Sub-Programs

Total 150M ORA, split equally into three programs:

### 4.1 Million Plan (50M ORA)
Milestone-unlocked rewards for all active users on the path to 1M DAU.

| DAU Milestone | Single Release | Cumulative |
|---|---|---|
| 100K DAU | 5M | 5M (10%) |
| 250K DAU | 5M | 10M (20%) |
| 500K DAU | 10M | 20M (40%) |
| **1M DAU** | **30M** | **50M (100%)** |

- Weights: content creation + successful curations + community interactions
- **Per-user per-milestone cap: 10,000 ORA**
- Eligibility: registered before milestone date + active during milestone month

### 4.2 Creator Onboarding Program (50M ORA)
For creators bringing existing external audiences.

| Item | Value |
|---|---|
| Eligibility | External platform followers ≥ **10,000** (OAuth-verified) |
| Conversion | **1 follower = 1 ORA** |
| Per-creator cap | **1,000,000 ORA** |
| Unlock schedule | 12 months, monthly release |
| Monthly activity requirements (≥ 2 of 4) | ① ≥ 5 content pieces published<br>② Creator Coin had transaction activity<br>③ ≥ 20 community interactions<br>④ AURA followers ≥ 10% of verified external (cumulative) |
| Failure handling | Monthly tranche paused & deferred; 3 consecutive misses → unreleased ORA reclaimed to Million Plan |

### 4.3 Rising Star Plan (50M ORA) — Cold-Start Incentive Detail

Designed for small creators and platform-native newcomers.

| Item | Value |
|---|---|
| **Target audience** | External platform followers < **10,000**, OR no external account at all |
| **Mutual exclusion** | Cannot participate alongside Creator Onboarding Program |
| **Reward mechanism** | **1 new AURA follower = 1 ORA** |
| **Per-creator monthly cap** | **5,000 ORA** |
| **Program duration** | **1 year** |
| **Settlement** | Monthly settlement, distributed the following month |

**Anti-fraud rules:**
- Follower accounts must be registered **> 7 days** with at least **1 interaction**
- Mutual follows count only once (A↔B = 1 count, not 2)
- ML detection for bulk fake-account registration
- Community reporting system with arbitration process for violations

**Track-routing logic:**
```
External followers ≥ 10,000  →  Creator Onboarding Program (audience conversion)
External followers < 10,000  →  Rising Star Plan (platform-native growth)
Mutually exclusive participation
```

---

## 5. Transaction Fee / Burn / Staking

**Unified 5% transaction fee** on all ORA transfers:

| Component | % of Fee | Effective | Destination |
|---|---|---|---|
| Scarcity Burn | 40% | **2.0%** | Permanently destroyed |
| Staking Rewards | 40% | **2.0%** | Distributed to stakers |
| Gas Reserve | 10% | **0.5%** | Converted to SOL for gas |
| Protocol Operations | 10% | **0.5%** | Platform operating costs |

**Reference**: YouTube 45%, OnlyFans 20%, OpenSea 2.5%, **AURA 5%** (protocol keeps only 1%; 4% recycles back to ecosystem).

**Additional Scarcity Burn at reward distribution**: 5% burned before delivery (a creator earning 10 ORA receives 9.5).

**Creator Coin payments**: When a fan pays a creator with their own Creator Coin, the creator receives **100%** with no additional fee (5% was already collected at Creator Coin secondary-market issuance).

---

## 6. TGE Proceeds Allocation

Of the $1M maximum public-sale proceeds, in priority order:

| Use | Share | Amount | Notes |
|---|---|---|---|
| **Storage Fund** | **35%** | $350,000 | Highest priority; ~17 months runway |
| **Gas Reserve** | **15%** | $150,000 | Solana fee seed |
| **Operations / Other** | balance | — | Team, legal, audit, marketing |

**Priority rule**: If TGE undersells, available proceeds flow Storage → Gas → Ops in strict order.

---

## 7. Storage Fund

### Funding Sources (Priority Order)
| # | Source | Size | Trigger |
|---|---|---|---|
| 1 | TGE seed | $350K | One-time |
| 2 | **Founder Backstop** (Søren + Iris, legal agreement with BVI foundation) | Up to **$300,000** | Y1; quarterly release of $75K when fund balance < 3 months projected spend |
| 3 | Storage Emission | ≤ 3% of total supply per trigger | Y2+ primary source; fund balance < 3 months projected spend |

> Scarcity Burn and frontend advertising revenue **do not** enter the Storage Fund.

### Storage Emission Parameters (Hard-Coded)
| Parameter | Value | Governance Tier |
|---|---|---|
| Per-trigger emission cap | 3% of total supply | Tier I (immutable) |
| Annual emission cap | None | Tier I (immutable) |
| Trigger condition | Balance < 3 months projected spend | Tier III (adjustable) |
| Sale mechanism | DEX, TWAP - discount% | Automatic |
| Default sale discount | 5% below TWAP | Tier III (range 0-15%) |
| Year-1 emergency authority | 1% of supply, single mint | Tier I (auto-expires Y2) |
| Minted-ORA destination | 100% to Storage Fund | Tier I (immutable) |

**Example**: At ORA = $0.50 and 1M DAU, a single 3% trigger (~$16.5M) covers approximately **20 months** of storage.

---

## 8. Gas Reserve Pool

| Item | Value |
|---|---|
| Funding | 0.5% of every transaction + 15% of TGE + DEX market-making revenue (SOL-denominated) |
| Solana base fee | ~0.000005 SOL (~$0.00025) per transaction |
| Creator Coin minting | ~0.01 SOL/mint (protocol pays) |
| NFT minting | ~0.01 SOL/mint (protocol pays) |
| First-time ORA account creation | ~0.002 SOL (protocol pays) |

**Users never need to acquire or hold SOL.**

---

## 9. Creator Coin

| Item | Value |
|---|---|
| Fixed supply per Coin | **10,000 units** |
| Issuance cost | **Free** (no ORA burn required) |
| Issuance threshold | 100 followers |
| Immediately available | 2,000 (20%) |
| Monthly unlock pool | 8,000 (80%) — 800 unlocks per month over 10 months |
| Monthly activity requirements (≥ 2 of 3) | ① ≥ 5 posts published / ② Coin had transactions / ③ ≥ 20 community interactions |
| Marketplace model | Posting/listing (not order book) |
| Marketplace transaction fee | Standard 5% (40/40/10/10 split) |
| Consumable redemption | Coin returns to creator's pool (not burned) |

---

## 10. Curation Mining

### Daily Reward Pools
| Pool | Daily Size |
|---|---|
| **Curator Reward Pool** | 10,000 ORA |
| **Creator Reward Pool** (curation-driven) | 10,000 ORA |
| **Curator Pool daily cap** | 20,000 ORA |

### Per-Curation Cost
**Fixed 1 ORA per action** (anti-sybil + anti-spam).

### Sybil Threshold
Wallet must hold **≥ 100 ORA** to curate.

### Curation Score Multiplier (by creator's follower count)
| Creator Followers | Multiplier |
|---|---|
| < 100 | **5×** |
| 100 – 1,000 | 3× |
| 1,000 – 10,000 | 1.5× |
| 10,000 – 100,000 | 1× |
| > 100,000 | 0.5× |

### Curator Rank (order of curation on the same content)
- 1st curator: 5× / 2nd-10th: declining / 501st+: 0.5×
- **Theoretical max combined score**: 25× (1st to find a creator with < 100 followers)
- **Theoretical min**: 0.5× (501st+ pile-on for a creator with > 100K followers)

### Reward Formulas
- Curator: `(my Curation Score / total daily Curation Score) × 10,000 ORA`
- Creator: `(ORA spent curating this content / total daily curation ORA) × 10,000 ORA`

---

## 11. Activity Rewards / Creation Mining

| Item | Value |
|---|---|
| Funding pool | Community Incentives (500M) |
| Reward formula | `Base + 48 ÷ (1 + MAU ÷ 50,000)` |
| Base (MAU < 500K) | 2 ORA |
| Base (MAU ≥ 500K) | 1 ORA |
| Formula coefficient (48) | Tier III adjustable |
| Quality Score threshold | 0.3 / 2.0 (below threshold = no Activity Reward) |
| Curation weight in Quality Score | 30% |

The per-action marginal reward decays asymptotically as MAU grows, ensuring long-term sustainability.

---

## 12. Remix Revenue Sharing

| Item | Value |
|---|---|
| Default upstream share | 5% |
| Creator-settable range | **0% – 15%** |
| Cumulative upstream-drain cap | **15%** (across multi-hop remix chains) |
| Calculation basis | 95% net (after standard 5% platform fee) |
| Adjustability | May only be lowered after publication, never raised |
| Allocation order | Bottom-up (nearest parent first); distant ancestors may receive reduced or zero share if cap is exhausted |
| Undeclared-remix finder's reward | 1% |
| Attribution dispute penalty | 5% |
| Silence-equals-approval window | 72 hours |

---

## 13. Frontend Registry

| Tier | Bond | Notes |
|---|---|---|
| Tier 1 Unverified | 0 | Free, permissionless |
| **Tier 2 Verified** | **10,000 ORA** | Slashable 25%-100% on violation |

- Bond amount: Tier III parameter (50% majority adjustable)
- Slashing decisions: Arbitration Committee (5/7 first hearing, 7-member appeal)
- Full Frontend Blacklist: requires Tier II community vote (75%)

---

## 14. Governance Tier System

| Tier | Threshold | Use Case |
|---|---|---|
| **Tier I** | Immutable | Core safety clauses (e.g., Storage Emission 3% cap, Y1 emergency authority auto-expiry) |
| **Tier II** | 75% supermajority | Major parameters (Remix 15% cap, creator-settable 0-15% range, Frontend Blacklist) |
| **Tier III** | 50% majority | Standard parameters (80/20 emission split, burn rate, Curation Score coefficients) |
| **Tier IV** | Committee resolution | Tech / Content / Arbitration committee day-to-day operations (CDP params, attribution penalties, default windows) |

---

## Memo at a Glance

- **Initial supply** 1.1B / **TGE FDV** $22M / **Public sale max** $1M
- **Creator : Protocol = 95 : 5**, unified 5% fee
- **Team pool 13.64%**: Søren 4.55% / Iris 2.73% / Future 6.36%
- **Perpetual inflation floor 2%** (steps down over 4 years)
- **Storage & gas fully covered by the protocol** — creators and users never pay on-chain fees
- **Five emission tracks above the 1.1B**: 4 contract-triggered + Y1 1% emergency authority

---

🌸 *This handbook is based on Whitepaper v1.0 (verified 2026-05-12). Any change to a number must be propagated to all four sources of truth: Whitepaper, this Handbook, Litepaper, README.*
