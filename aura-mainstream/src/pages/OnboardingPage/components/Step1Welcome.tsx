import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onNext: () => void;
}

/**
 * Step 1 — Welcome.
 * Hero + 4 30-second bullets. No form, just narrative.
 */
export default function Step1Welcome({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-aura to-ora mb-6 shadow-lg shadow-aura/20">
        <Sparkles className="w-8 h-8 text-white" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-aura to-ora bg-clip-text text-transparent">
        欢迎来到 AURA
      </h1>
      <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-md">
        你的内容、你的粉丝、你的代币 — 一切归你。
      </p>

      <div className="w-full max-w-md grid gap-3 text-left mb-8">
        <Bullet emoji="🌸" title="完全的内容所有权">
          每一篇内容上链确权，没有平台能下架你。
        </Bullet>
        <Bullet emoji="💰" title="粉丝直接付费给你">
          用 ORA 解锁付费内容、买 NFT、给 tips — 钱直接进你钱包。
        </Bullet>
        <Bullet emoji="🪙" title="发你自己的 Creator Coin">
          100 粉丝即可启动，给真实粉丝早期分红权。
        </Bullet>
        <Bullet emoji="🏛" title="没有中间商">
          协议费仅 0.5%，对比传统平台 30% 抽成。
        </Bullet>
      </div>

      <Button
        onClick={onNext}
        className="w-full max-w-md h-12 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium text-base"
      >
        开始 30 秒上手 <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function Bullet({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card/60 border border-border/40">
      <span className="text-2xl leading-none mt-0.5">{emoji}</span>
      <div className="flex-1">
        <div className="font-medium text-foreground text-sm">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{children}</div>
      </div>
    </div>
  );
}
