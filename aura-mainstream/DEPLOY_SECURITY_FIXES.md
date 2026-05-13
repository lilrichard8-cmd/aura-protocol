# AURA 安全修复部署清单 — 2026-05-13

代码已全部就绪。剩下 4 步必须卓宇本人操作（涉及凭据）。

## ✅ 已完成（在 `~/Desktop/aura-platform/aura-mainstream/`）

| | 修复 | 文件 |
|---|---|---|
| P0 | Gemini key 移出 bundle | `src/lib/iris-chat.ts` + 改 IrisChat.tsx / IrisChatPanel.tsx |
| P0 | DM/follow 写操作走 Edge Function | `src/lib/dm.ts`, `src/lib/follows.ts`, `src/lib/wallet-auth.ts` |
| P0 | 5 个 Edge Functions | `supabase/functions/{wallet-auth, dm-send, dm-mark-read, follow, unfollow, iris-chat}/index.ts` |
| P0 | DB 加 session/nonce 表 + 锁权限 | `supabase/migrations/004_wallet_auth_and_lockdown.sql` |
| P1 | CSP / HSTS / Frame-Options headers | `vercel.json` |
| P1 | 依赖 audit fix（22 low/11 mod/1 high/1 crit → 都在 trezor 链不进 bundle）| `package.json` + lockfile |
| P1 | _blank rel="noopener noreferrer" 修齐 | 2 处 |
| P2 | SIWS 风格签名 | `wallet-auth.ts` + `AuthContext.tsx`（连钱包时一次签名换 1h token）|

Build 验证：✅ `npm run build` 通过，`grep AIzaSy dist/` 空。

---

## 🔴 你要做的 4 步

### Step 1 — Rotate Gemini API key（5 min，最紧急）

旧 key `AIzaSyAf8rkDV-ZVufDULgZdbMpruyPD7r1IOec` 已经躺在公网 bundle 几周了，**先废再说**。

1. 打开 https://aistudio.google.com/app/apikey（或 Google Cloud Console）
2. 删除上面那个 key
3. 创建新 key，记下来（暂时不要存到任何前端文件里！）
4. 给新 key 加 HTTP referer 限制：仅允许 `aura.li/*`, `*.vercel.app/*`, `localhost:*`

### Step 2 — 拿 Supabase Personal Access Token（2 min）

1. 打开 https://supabase.com/dashboard/account/tokens
2. 点 "Generate new token"，名字写 `aura-deploy-cli`
3. 复制下来的 `sbp_...` 字符串

### Step 3 — 部署（一键脚本，下面）

把上面两个 token 填进环境变量，然后跑：

```bash
export SUPABASE_ACCESS_TOKEN='sbp_...'   # Step 2 的 token
export GEMINI_API_KEY='AIza...'           # Step 1 的新 key

cd ~/Desktop/aura-platform/aura-mainstream
bash deploy-security.sh
```

脚本会：
- supabase link 到项目
- 跑 migration 004
- 设置 GEMINI_API_KEY secret
- 部署全部 6 个 Edge Functions

### Step 4 — Vercel 重新部署前端（1 min）

```bash
cd ~/Desktop/aura-platform/aura-mainstream
npm run build   # 已验证通过
vercel --prod   # 或在 Vercel dashboard 触发 redeploy
```

---

## 部署后验证（5 min）

### A. Gemini key 已不在 bundle
```bash
grep -r "AIzaSy" dist/ && echo "❌ 还有泄露" || echo "✅ 干净"
```

### B. 攻击重放测试（应该全部失败）
打开浏览器 DevTools console，访问 aura.li，跑：

```javascript
// 应当全部失败 / 返回错误
const SUPA = 'https://gnocejubipuyoesnjnyp.supabase.co';
const ANON = 'sb_publishable_EChZE7ncmklE5VjrCHc2_Q_akm04BNg';

// 1. 直接调旧 RPC — 应该 permission denied
fetch(`${SUPA}/rest/v1/rpc/dm_send`, {
  method: 'POST',
  headers: { 'apikey': ANON, 'content-type': 'application/json' },
  body: JSON.stringify({ from_wallet: 'fake', to_wallet: 'fake2', content: 'pwn' })
}).then(r => r.text()).then(t => console.log('dm_send result:', t));
// 期望: error / function not accessible

// 2. 直接调 Edge Function 不带 session — 应该 401
fetch(`${SUPA}/functions/v1/dm-send`, {
  method: 'POST',
  headers: { 'apikey': ANON, 'content-type': 'application/json' },
  body: JSON.stringify({ toWallet: 'x', content: 'pwn' })
}).then(r => r.json()).then(console.log);
// 期望: { error: 'missing_fields' } 或 { error: 'session_invalid' }
```

### C. 正常流程冒烟
1. 打开 aura.li → 点 Connect Wallet → Phantom
2. **应该弹两次签名**：第一次是 Phantom 的"Connect"，第二次是 SIWS 登录文本
3. 登录后发一条 DM 给 Iris → 不再弹签名（用 session token）
4. 1 小时后再发 → 应该自动弹一次 SIWS 重新登录

### D. CSP 生效
打开浏览器 Network → 选 aura.li 的 HTML 请求 → Headers，应能看到 `Content-Security-Policy`。

---

## 已知 trade-off

1. **Read RPC 仍信任 `my_wallet` 参数**：列 DM 历史时任意第三方还是能通过 anon key 调 `dm_list_messages` 看任意人的 DM。**这是下一个 migration（005_wallet_jwt.sql）要解决的问题**——切到 Supabase 自定义 JWT，让 RPC 内部用 `auth.jwt() ->> 'wallet'`。Hackathon 之后必须做。

2. **trezor protobufjs CVE 留下**：升级会破坏 wallet adapter，且 trezor 代码不进 bundle（已 grep 确认）。CI/dev 机器装 npm 包时理论上有供应链风险，accept it。

3. **Edge Function 速率限制是内存级**：iris-chat 的 token bucket 在 cold start 会重置。生产前换成 Postgres 计数。

4. **`dm_get_or_create_thread` 仍开放给 anon**：可以被滥用刷空 thread 行。下一版包进 Edge Function。

---

## 回滚

```bash
# Edge Functions: 删除
supabase functions delete wallet-auth dm-send dm-mark-read follow unfollow iris-chat

# Migration 004 撤销
# 在 SQL Editor 跑：
DROP TABLE IF EXISTS public.wallet_sessions CASCADE;
DROP TABLE IF EXISTS public.wallet_auth_nonces CASCADE;
DROP FUNCTION IF EXISTS public.wallet_auth_sweep();
-- 恢复 RPC 权限
GRANT EXECUTE ON FUNCTION public.dm_send(text, text, text, text)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dm_mark_read(text, text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.follow_wallet(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_wallet(text, text)                 TO anon, authenticated;

# 前端: git revert
git revert HEAD
```

🌸 — Iris, 2026-05-13
