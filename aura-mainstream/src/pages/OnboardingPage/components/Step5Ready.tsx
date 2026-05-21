import { ArrowLeft, Sparkles, FileText, Coins, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onBack: () => void;
  onFinish: (destination: string) => void;
}

/**
 * Step 5 — Ready! Three quick-entry tiles.
 * Whichever tile the user taps is where we deposit them, so the choice
 * here doubles as their "first action" intent.
 */
export default function Step5Ready({ onBack, onFinish }: Props) {
  const tiles = [
    {
      to: '/create',
      Icon: FileText,
      emoji: '📝',
      title: '发第一个帖子',
      sub: 'Photo / Video / Text / Audio / Live',
    },
    {
      to: '/creator-coin',
      Icon: Coins,
      emoji: '🪙',
      title: '创建你的 Creator Coin',
      sub: '100 粉丝即可启动',
    },
    {
      to: '/feed',
      Icon: Compass,
      emoji: '🏛',
      title: '探索内容',
      sub: '看看大家在创作什么',
    },
  ];

  return (
    <div className="flex flex-col text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-aura to-ora mb-6 shadow-lg shadow-aura/20 mx-auto">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-aura to-ora bg-clip-text text-transparent">
        你已经准备好了！
      </h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
        从这里开始，做点你想做的事 — 你随时可以在右下角的 ❓ 帮助里重看引导。
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {tiles.map(({ to, Icon, emoji, title, sub }) => (
          <button
            key={to}
            type="button"
            onClick={() => onFinish(to)}
            className="group bg-card border border-border hover:border-aura/40 hover:shadow-md rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{emoji}</span>
              <Icon className="w-5 h-5 text-aura" />
            </div>
            <div className="font-semibold text-sm text-foreground mb-1">{title}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
            <div className="mt-3 text-xs font-medium text-aura group-hover:underline">
              Go →
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="h-11 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          type="button"
          onClick={() => onFinish('/feed')}
          className="h-11 px-8 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium"
        >
          完成
        </Button>
      </div>
    </div>
  );
}
