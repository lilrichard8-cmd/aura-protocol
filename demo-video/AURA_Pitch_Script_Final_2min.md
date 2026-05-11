# AURA · Pitch Video — Final Voice-Over Script (2:00)

**Word count**: 234 words
**Speed**: 145 wpm
**Speaking time**: ~91s
**Visual + transition buffer**: 29s
**Total**: ≤ 2:00 hard cap ✓

---

## 🎙️ Continuous Voice-Over Script (one take)

> [Hook · 12s]
>
> One hundred and thirty billion dollars. Creators built it. They keep less than five percent. One ban — a decade of work, gone.
>
> [Problem · 15s]
>
> Today's deal is simple. Creators do the work. Platforms keep the upside. The algorithm owns your reach. The platform owns your audience.
>
> [Insight · 9s]
>
> We started with one belief. A creator is not a content worker — but a sovereign micro-economy.
>
> [Solution · 30s]
>
> Pillar one. Every creator mints their own coin. Fans hold it for access. Holders share the upside.
>
> Pillar two. Stake on content you believe in early. When it spreads, you earn. Discovery becomes work.
>
> Pillar three. Followers, content, reputation — all on-chain. Switch frontends, fork the platform. Your graph stays yours.
>
> Pillar four. Five percent of every transfer burns. The more the protocol is used, the scarcer ORA becomes.
>
> Pillar five. Every post pinned to Arweave. No deplatforming. No bit rot. Just permanence.
>
> [Why now & why us · 15s]
>
> Why now? Solana finally makes per-action economics work at social scale. The SEC has clarified — protocol rewards aren't securities.
>
> Why us? We shipped it. And we built it with an AI co-founder embedded in the team.
>
> [Vision + CTA · 10s]
>
> Cake builders should own the cake. AURA — the creator economy, returned to creators. aura dot builders. Mint your coin.

---

## 📌 配音注意事项

- **语速**: 145 wpm. 不要太快，让数字落地有重量。
- **断句**: 每个 [section] 之间留 1-1.5s 静音。Pillar 之间留 0.5s。
- **情绪曲线**:
  - Hook: 沉稳、有数字重量感
  - Problem: 平静中带一点冷峻
  - Insight: 慢下来，每个词都掷地有声
  - Solution: 节奏起来，五个支柱像鼓点
  - Why now: 自信，肯定语气
  - CTA: 上扬收尾，邀请感

---

## 🔑 关键数字（配音时必须吐字清晰）

1. **One hundred and thirty billion dollars** — 不要缩成 "$130B"，让数字砸到底
2. **Less than five percent**
3. **Five percent of every transfer burns**

这三个数字是评委 7 天后还能记住的全部。

---

## 🎵 BGM 同步关键节拍

- **0:00** — BGM 进，低音弦乐
- **0:27** — Insight 那一句"sovereign micro-economy"念完时，鼓点落下 + 弦乐转电子音
- **0:36** — AURA Logo 浮现，鼓点 hit
- **0:40-1:30** — Solution 段，每个 pillar 切换时小 hit
- **1:45** — Vision 段，弦乐回归
- **2:00** — 末帧定格，fade-out

---

## 🌸 Fish Audio API 调用（Iris voice）

```bash
VOICE_ID=$(cat ~/.openclaw/secrets/fish_audio_iris_voice_id)
API_KEY=$(cat ~/.openclaw/secrets/fish_audio_api_key)

# 整段一次生成（也可以分段以便调整节奏）
curl -X POST https://api.fish.audio/v1/tts \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"reference_id\": \"$VOICE_ID\", \"text\": \"<整段 script>\", \"format\": \"mp3\"}" \
  -o ~/Desktop/aura-platform/demo-video/voiceover-iris.mp3
```

如果想分段对齐 Remotion timeline，建议每个 [section] 独立生成一段，方便后期切片对齐。
