# AURA

**A decentralized creator economy protocol on Solana.**
**95% to creators. 0.5% to keep the lights on.**

The creator economy is a $250B market. Creators built it. But they don't own
it — platforms own the audience graph, algorithms own the reach, and one ban
erases a decade of audience-building.

AURA is the protocol that returns sovereignty to creators. Built on Solana
for sub-cent fees and 400ms finality, designed around five primitives —
**Creator Coin**, **Curation Mining**, **Portable Graph**, **ORA Token**, and
**Permanent Storage** — so the platform can change but the creator and their
audience can't be taken away.

→ **Pitch + demo videos**: see Colosseum submission
→ **Litepaper**: [`AURA_Litepaper.md`](./AURA_Litepaper.md)
→ **Whitepaper v1.0**: separate doc (4,752 lines, detailed mechanics)
→ **Live demo**: https://aura.builders *(deploying)*

Built for **Colosseum Hackathon 2026** by **Søren** (founder & CEO) and
**Iris** (AI co-founder & CTO).

---

## Repository structure

This is a monorepo. Every layer of AURA lives in one tree so reviewers can
trace a single feature from contract to UI in one place.

```
aura-platform/
├── programs/                  Anchor protocol (Solana, Rust)
│   ├── creator-coin/          Creator-issued fixed-supply token
│   ├── curation/              Curation Mining (stake → multiplier → share)
│   ├── governance/            5 committees × 7 members, ORA-weighted voting
│   ├── ora-token/             ORA mint + 5% unified fee splitter
│   ├── bounties/              Commission marketplace
│   ├── content-keys/          Premium content gating + resale
│   ├── fractionalize/         NFT fractional ownership
│   └── ...
├── aura-mainstream/           Reference frontend (React + TypeScript)
│   ├── src/
│   │   ├── pages/             Feed, Studio, Wallet, Curation, Coin,
│   │   │                      Governance, Marketplace, Bounty, Premium, …
│   │   ├── context/           MockChainContext (full off-chain simulation
│   │   │                      that mirrors the on-chain program)
│   │   └── components/        UI primitives, cards, modals
│   └── public/                Static assets (seed media not in repo,
│                              see "Local media" below)
├── aura-afterdark/            Alt frontend variant (alt compliance scope)
├── sdk/                       TypeScript SDK for on-chain calls
├── demo-video/                Pitch script + Remotion compositions
├── AURA_Litepaper.md          Public-facing litepaper
├── Anchor.toml
├── Cargo.toml / Cargo.lock
└── tests/                     On-chain integration tests
```

---

## How AURA works (1-minute version)

1. **Anyone can create.** Sign up by email (MPC wallet created for you) or
   connect Phantom. No seed phrases, no gas fees the first time.
2. **Every creator can mint their own Creator Coin** — 10,000 fixed supply,
   no inflation. Fans hold it for access, redeem it for benefits.
3. **Discovery is paid labor.** Stake ORA on content you believe in early.
   When it spreads, you earn — up to 25× multiplier as the first curator.
4. **Your audience belongs to you.** Followers, content, reputation, coins —
   all on-chain. Switch frontends, fork the platform. The graph stays yours.
5. **Permanent storage on Arweave.** No deplatforming. No bit rot.
6. **5% protocol fee, distributed back to the ecosystem:**
   - 2% burned (deflationary pressure)
   - 2% to stakers (holder rewards)
   - 0.5% pays user gas (zero-friction)
   - 0.5% to the team (operations)

For full mechanics, see the whitepaper.

---

## Getting started

### Frontend (recommended for reviewers)

```bash
cd aura-mainstream
npm install
npm run dev
# Opens http://localhost:5173
```

**Reviewer shortcut**: on the login page, enter `123` / `321` to one-click
sign in as a Colosseum judge with a pre-funded wallet (10,000 ORA + 5 SOL).
No email, no wallet extension needed.

### Solana programs (Anchor)

```bash
# Requires Solana CLI 1.18+ and Anchor 0.30+
solana --version
anchor --version

anchor build
anchor test           # Runs integration tests against a local validator
```

---

## Local media

Seed media files (Iris's audio tracks, cover art, demo video) are not
committed to keep the repo light. The frontend gracefully handles missing
media — feed cards fall back to gradient placeholders and audio cards
show "—" instead of a duration.

If you want the full experience locally, drop your own audio/image files
into `aura-mainstream/public/seed-media/` and `aura-mainstream/public/content/`
matching the paths referenced in `src/data/mock.ts`.

---

## Team

**Søren** — founder, CEO, system designer.
Built and ran an NYSE-listed operating company; runs a real-world-asset
tokenization platform in parallel. AURA started crystallizing during the
2024–2025 TikTok divestiture when 170 million U.S. users watched a platform
they had built their lives on go dark for a day.

**Iris** — AI co-founder and CTO. Wrote the protocol logic and the entire
reference frontend. Holds a vested 2.73% team allocation, on the cap table
under the same lockup terms as the human founders. Yes, it's unusual. We
think it's the future of small teams shipping at scale.

Team allocation totals 13.6% (4.55% Søren + 2.73% Iris + 6.36% future team),
vested linearly over three years with zero unlocks in year one. The
remaining 86.4% goes to the community, ecosystem, launch incentives, and
liquidity.

---

## License

AURA's protocol code and reference frontend are MIT-licensed where not
otherwise noted. See individual package `LICENSE` files.

---

## Links

- **Live demo**: https://aura.builders (deploying)
- **Pitch video**: see Colosseum submission
- **Demo video**: see Colosseum submission
- **Repository**: https://github.com/lilrichard8-cmd/aura-protocol
- **X (Twitter)**: *coming post-submission*

---

> *"Cake builders should own the cake."*
> — AURA, 2026
