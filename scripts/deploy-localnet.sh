#!/bin/bash
# Deploy all AURA programs to localnet using solana program deploy
# Faster than anchor deploy (no extra IDL/cargo steps)

set -e

cd "$(dirname "$0")/.."
DEPLOY_DIR="target/deploy"

# Pair each .so with its keypair
PROGRAMS=(
  "aura_core"
  "aura_creator_coin"
  "aura_market"
  "aura_governance"
  "aura_vault"
  "aura_curation"
  "aura_social_graph"
  "aura_content_license"
  "aura_reputation"
  "aura_fractionalize"
  "aura_ora"
  "aura_rewards"
  "aura_staking"
  "aura_livestream"
  "aura_type_b"
  "aura_launch_incentives"
  "content_key"
)

echo "Deploying ${#PROGRAMS[@]} programs to localnet..."
echo "RPC: $(solana config get | grep 'RPC URL' | awk '{print $3}')"
echo "Authority: $(solana address)"
echo "Balance: $(solana balance)"
echo

FAILED=()
SUCCESS=()

for prog in "${PROGRAMS[@]}"; do
  SO="$DEPLOY_DIR/${prog}.so"
  KP="$DEPLOY_DIR/${prog}-keypair.json"
  
  if [ ! -f "$SO" ]; then
    echo "SKIP $prog (no .so)"
    FAILED+=("$prog: missing .so")
    continue
  fi
  if [ ! -f "$KP" ]; then
    echo "SKIP $prog (no keypair)"
    FAILED+=("$prog: missing keypair")
    continue
  fi
  
  ADDR=$(solana-keygen pubkey "$KP")
  SIZE_KB=$(($(stat -f%z "$SO") / 1024))
  echo "→ $prog [$ADDR] (${SIZE_KB}KB)"
  
  if solana program deploy "$SO" --program-id "$KP" --keypair ~/.config/solana/id.json --max-sign-attempts 5 2>&1 | tail -3 | sed 's/^/   /'; then
    SUCCESS+=("$prog")
  else
    FAILED+=("$prog: deploy failed")
  fi
  echo
done

echo "========================================"
echo "DEPLOYED: ${#SUCCESS[@]}/${#PROGRAMS[@]}"
echo "FAILED:   ${#FAILED[@]}"
if [ ${#FAILED[@]} -gt 0 ]; then
  printf "  %s\n" "${FAILED[@]}"
fi
echo
echo "On-chain programs:"
solana program show --programs

# [stack-fix 2026-05-19] After every (re)deploy, repopulate the localnet with
# admin's UserProfile, 100 follower stubs, the JUDGE Creator Coin, a
# redemption counter, and a Consumable benefit. Idempotent: re-runs are
# cheap when state is already present.
echo
echo "→ Running dev seed (follower stuffing + creator coin + benefit)..."
if command -v node >/dev/null 2>&1; then
  node "$(dirname "$0")/dev-seed-creator-coin.mjs" || \
    echo "  ⚠️ dev seed failed (re-run manually with: node scripts/dev-seed-creator-coin.mjs)"
else
  echo "  ⚠️ node not on PATH; skipping dev seed"
fi
