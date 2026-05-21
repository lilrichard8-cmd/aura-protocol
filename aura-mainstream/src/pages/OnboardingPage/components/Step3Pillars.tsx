import { useState } from 'react';
import { ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, Coins, Sparkles, Users, Gem, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

interface Pillar {
  Icon: typeof Coins;
  emoji: string;
  title: string;
  oneLiner: string;
  meaning: string;
}

const PILLARS: Pillar[] = [
  {
    Icon: Coins,
    emoji: '🪙',
    title: 'Creator Coin',
    oneLiner: '每个创作者都是一个微型经济体',
    meaning: '100 粉丝即可启动，10K 总量 — 你的早期粉丝跟你一起长大。',
  },
  {
    Icon: Sparkles,
    emoji: '🌟',
    title: 'Curation Mining',
    oneLiner: '策展好内容也能赚 ORA',
    meaning: '早发现 = 早奖励，前 10% 策展者拿 5× 倍率。不是创作者也能赚。',
  },
  {
    Icon: Users,
    emoji: '🔗',
    title: 'Portable Social Graph',
    oneLiner: '你的粉丝列表归你',
    meaning: '关注关系存在链上，不是平台数据库。换前端不掉粉。',
  },
  {
    Icon: Gem,
    emoji: '💎',
    title: 'ORA 代币',
    oneLiner: '使用越多越值钱',
    meaning: '每笔交易销毁 5% — 平台越活跃，ORA 越稀缺。',
  },
  {
    Icon: HardDrive,
    emoji: '📦',
    title: '永久存储',
    oneLiner: '你的内容存在 Arweave',
    meaning: '一次付费，永久存储。平台倒了，你的作品还在。',
  },
];

/**
 * Step 3 — Five pillars carousel.
 * Snappable card stack; non-blocking (skip is OK).
 */
export default function Step3Pillars({ onBack, onNext, onSkip }: Props) {
  const [idx, setIdx] = useState(0);
  const p = PILLARS[idx];

  return (
    <div className="flex flex-col">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">AURA 的五大支柱</h2>
        <p className="text-sm text-muted-foreground">
          这是协议的核心 — 看个梗概，后面慢慢探索都来得及。
        </p>
      </div>

      {/* Card */}
      <div className="relative bg-gradient-to-br from-aura/5 via-card to-ora/5 border border-aura/20 rounded-2xl p-8 min-h-[280px]">
        <div className="flex items-start gap-4">
          <div className="text-5xl leading-none mt-1">{p.emoji}</div>
          <div className="flex-1">
            <div className="text-xs font-medium text-aura uppercase tracking-wide mb-1">
              {idx + 1} of {PILLARS.length}
            </div>
            <h3 className="text-2xl font-bold mb-1">{p.title}</h3>
            <p className="text-base text-foreground/80 mb-4">{p.oneLiner}</p>
            <div className="text-sm text-muted-foreground leading-relaxed border-l-2 border-aura/40 pl-3">
              <span className="text-xs uppercase tracking-wide text-aura font-medium">对你来说：</span>
              <br />
              {p.meaning}
            </div>
          </div>
        </div>

        {/* Card nav */}
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {PILLARS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Pillar ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === idx ? 'w-6 bg-aura' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIdx(i => Math.min(PILLARS.length - 1, i + 1))}
            disabled={idx === PILLARS.length - 1}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onBack} className="h-12 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
        >
          Skip tour
        </button>
        <Button
          type="button"
          onClick={onNext}
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium text-base"
        >
          {idx < PILLARS.length - 1 ? '看完，下一步' : 'Continue'} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
