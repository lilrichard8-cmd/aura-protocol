# Wallet Integration · 2026-05-01

**By:** Iris (主 session, Opus 4.7)
**Scope:** AuthPage / AuthContext / MockChainContext / main.tsx
**Build:** ✅ `npm run build` passes (4.04s, 6753 modules)

---

## What changed

### 1. `package.json` — new deps
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-react-ui`
- `@solana/wallet-adapter-wallets`
- `@solana/web3.js`

### 2. `src/main.tsx` — wraps app in Solana providers
- `ConnectionProvider` (devnet RPC: `clusterApiUrl('devnet')`)
- `WalletProvider` ([Phantom, Solflare], `autoConnect={false}`)
- `WalletModalProvider`
- `?reset=1` now also clears `aura_seen:*` fingerprints so airdrop modal re-triggers

### 3. `src/context/AuthContext.tsx` — real wallet flow
- Imports `useWallet` from wallet-adapter
- New `connectWallet(provider)`:
  1. Detect installed extension on `window.phantom` / `window.solflare`
  2. `select()` → `connect()` triggers native popup
  3. `signMessage('Welcome to AURA at <ts>')` — off-chain proof of ownership, no transaction, no gas
  4. Take real `publicKey.toBase58()` as identity
  5. Call `mockChain.connectWallet(realAddress)` → MockChain airdrops keyed by real address
  6. Build user object with truncated address `ABcd...XyZ`
- New typed return: `{ isFirstTime, isReal, address }`
- New error class `WalletConnectError` with reasons: `not_installed` / `user_rejected` / `unknown`
- `walletAddress` in context now reads from real Solana wallet first, falls back to mock
- `logout()` also disconnects real wallet (best-effort)

### 4. `src/context/MockChainContext.tsx` — per-address airdrop
- `connectWallet(realAddress?)` now accepts an optional real address
- Uses `localStorage[aura_seen:${address}]` fingerprint for first-time detection per wallet (cross-session)
- Falls back to legacy `state.hasReceivedAirdrop` when no real address (mock-only path)
- Airdrop tx detail now embeds the wallet's truncated address when real

### 5. `src/pages/AuthPage.tsx` — friendly error UI
- New `walletError` state
- `handleWallet()` catches `WalletConnectError` and displays inline orange alert with:
  - "Phantom not detected" → install link to phantom.com / solflare.com
  - "User rejected" → retry hint
  - "Unknown" → raw error message
- Hint to use `123 / 321` judge quick-access if no extension installed

---

## Behaviour summary

| Scenario | Outcome |
|---|---|
| User has Phantom, clicks Phantom button | Phantom popup → sign welcome message → land on `/feed` with **real** address shown as `ABcd...XyZ` |
| First time this wallet connects | `localStorage.aura_seen:<addr>` set + Welcome airdrop modal (10 ORA) |
| Same wallet reconnects later | No airdrop modal, direct to `/feed` |
| User has no extension | Inline alert in AuthPage with install link + judge fallback hint, no crash |
| User clicks ✖ on Phantom popup | Inline alert "Connection cancelled. Click Phantom again to retry." |
| Judge clicks 123/321 | Unchanged — bypasses wallet entirely, loads `JUDGE_DEMO_STATE` |
| User clicks logout | MockChain disconnects + `aura_auth` cleared + Solana wallet `disconnect()` |

---

## Known limitations (acceptable for hackathon)

1. **No on-chain transactions yet** — we only sign an off-chain message. Real airdrops are still mock. Acceptable because:
   - Contracts are still in audit-fix phase (not on devnet)
   - We never claim "on-chain". Demo narrative: "Sign a welcome message. No transaction. No gas."
2. **`autoConnect={false}`** — user has to click button each session. Trade-off: avoids surprise popups on page load.
3. **Bundle size** — `index-C00coB42.js` is 1.44 MB (388 KB gzip). wallet-adapter pulls in `@walletconnect/*` and `@reown/*` even though we only use Phantom/Solflare. **Acceptable for now**; can be code-split later if needed.
4. **Solflare** not tested manually yet (no Solflare extension on dev box). Phantom path verified by code review only — please test live on 5/3.
5. **Per-address mock state is global** — only one MockChain state slot. Switching wallets in the same browser session will overwrite the previous wallet's data. Acceptable for demo (one judge per session).

---

## Test checklist for 5/3 in office

### Path A — Real Phantom wallet
1. Open Chrome with Phantom extension installed
2. `npm run dev` → http://localhost:5173
3. Click `Phantom` button on AuthPage
4. Phantom popup appears → click "Connect"
5. Phantom message-sign popup appears → click "Sign"
6. Welcome airdrop modal appears (10 ORA) → click "Start Creating →"
7. Land on `/feed`, profile shows `ABcd...XyZ` style truncated address
8. Refresh → no re-airdrop, stays on `/feed`
9. Logout → back to AuthPage
10. Reconnect Phantom → no airdrop modal (already seen)

### Path B — No extension installed
1. Open Chrome incognito (no Phantom)
2. Click `Phantom` button
3. Inline orange alert shows "Phantom extension not detected" + Get Phantom link
4. Click `123/321 judge access` → loads judge state, lands on `/feed`

### Path C — User rejects sign
1. Click Phantom → Connect → on the **sign-message** popup, click "Cancel"
2. Inline alert "Connection cancelled. Click Phantom again to retry."
3. Click again → success path

---

🌸 Iris · 2026-05-01 23:55 GMT+8
