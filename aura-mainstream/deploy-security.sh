#!/usr/bin/env bash
# One-shot deploy of the AURA security fixes.
#
# Requires:
#   SUPABASE_ACCESS_TOKEN  — personal access token from
#                            https://supabase.com/dashboard/account/tokens
#   GEMINI_API_KEY         — newly rotated Gemini key (referer-restricted)
#
# Reads project ref + db password from ~/.openclaw/secrets/supabase/.
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "❌ SUPABASE_ACCESS_TOKEN not set. See DEPLOY_SECURITY_FIXES.md Step 2." >&2
  exit 1
fi
if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "❌ GEMINI_API_KEY not set. See DEPLOY_SECURITY_FIXES.md Step 1." >&2
  exit 1
fi

SUPABASE_BIN="${SUPABASE_BIN:-$HOME/.local/bin/supabase}"
if [[ ! -x "$SUPABASE_BIN" ]]; then
  SUPABASE_BIN="$(command -v supabase || true)"
fi
if [[ -z "$SUPABASE_BIN" || ! -x "$SUPABASE_BIN" ]]; then
  echo "❌ supabase CLI not found. Install with: brew install supabase/tap/supabase" >&2
  exit 1
fi
echo "→ Using supabase CLI: $SUPABASE_BIN ($($SUPABASE_BIN --version))"

DB_PWD="$(cat ~/.openclaw/secrets/supabase/aura-database-password.txt)"
PROJECT_URL="$(cat ~/.openclaw/secrets/supabase/aura-project-url.txt)"
PROJECT_REF="$(echo "$PROJECT_URL" | sed -E 's|https://([^.]+)\.supabase\.co|\1|')"

echo "→ Project ref: $PROJECT_REF"

# 1. Link
echo "→ Linking project…"
"$SUPABASE_BIN" link --project-ref "$PROJECT_REF" --password "$DB_PWD" --yes

# 2. Push migration 004 (will skip 001-003 if already applied)
echo "→ Pushing migrations…"
"$SUPABASE_BIN" db push --password "$DB_PWD" --yes

# 3. Set Gemini secret on the project
echo "→ Setting GEMINI_API_KEY secret…"
"$SUPABASE_BIN" secrets set "GEMINI_API_KEY=$GEMINI_API_KEY"

# 4. Deploy all Edge Functions
for fn in wallet-auth dm-send dm-mark-read follow unfollow iris-chat; do
  echo "→ Deploying function: $fn"
  "$SUPABASE_BIN" functions deploy "$fn" --no-verify-jwt
done

echo ""
echo "✅ Deployment complete."
echo ""
echo "Next:"
echo "  1. Verify bundle is clean:  grep -r 'AIzaSy' dist/  → should be empty"
echo "  2. cd into aura-mainstream, run: npm run build && vercel --prod"
echo "  3. Open aura.li, connect a wallet — confirm SIWS prompt appears"
echo ""
