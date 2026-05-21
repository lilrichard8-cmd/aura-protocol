import { ArrowRight, ArrowLeft, Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  emoji: string;
  label: string;
  hint: string;
  done: boolean;
  reward: number;
}

interface Props {
  onBack: () => void;
  onNext: () => void;
}

/**
 * Step 4 — Newbie task list.
 *
 * These are *aspirational* — only "Complete profile" is checked at this point
 * (the user just finished Step 2). The rest live as visible promises that the
 * user can chip away at after onboarding. We don't try to mark them off in
 * real-time here; that wiring lives on the Dashboard quest card (TODO).
 *
 * Rewards are illustrative — the actual ORA payout is computed server-side
 * via the curation/rewards contracts. Keep both numbers and copy in sync
 * with `src/components/profile/QuestCard.tsx` when that lands.
 */
export default function Step4Tasks({ onBack, onNext }: Props) {
  const tasks: Task[] = [
    {
      id: 'profile',
      emoji: '✅',
      label: '完成 Profile',
      hint: '你刚刚完成了 — 恭喜！',
      done: true,
      reward: 10,
    },
    {
      id: 'first-post',
      emoji: '📝',
      label: '发第一篇内容',
      hint: '试试看 — 一段文字、一张图、甚至一个视频都行',
      done: false,
      reward: 10,
    },
    {
      id: 'follow-3',
      emoji: '👀',
      label: '关注 3 个创作者',
      hint: '推荐列表里随便点 — 他们会看到你',
      done: false,
      reward: 10,
    },
    {
      id: 'first-curate',
      emoji: '🎯',
      label: '完成第一次 Curation',
      hint: '去 /curation 给任何内容点个赞',
      done: false,
      reward: 10,
    },
    {
      id: 'first-transfer',
      emoji: '💸',
      label: '试用 ORA 转账',
      hint: '转 1 ORA 给任意地址 — 体验链上转账有多丝滑',
      done: false,
      reward: 10,
    },
  ];

  const doneCount = tasks.filter(t => t.done).length;
  const totalReward = tasks.reduce((s, t) => s + (t.done ? t.reward : 0), 0);
  const totalPossible = tasks.reduce((s, t) => s + t.reward, 0);

  return (
    <div className="flex flex-col">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">5 个新手任务，赚你的第一批 ORA</h2>
        <p className="text-sm text-muted-foreground">
          每完成一个 +10 ORA · 总计 {totalPossible} ORA 等你拿
        </p>
      </div>

      {/* Progress strip */}
      <div className="bg-card border border-border rounded-xl p-3 mb-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{doneCount} / {tasks.length} 完成</span>
            <span className="font-medium text-aura">+{totalReward} ORA 已锁定</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-aura to-ora transition-all duration-500"
              style={{ width: `${(doneCount / tasks.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {tasks.map(t => (
          <li
            key={t.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border transition-colors',
              t.done
                ? 'bg-aura/5 border-aura/30'
                : 'bg-card border-border hover:border-aura/30',
            )}
          >
            <div className="mt-0.5">
              {t.done ? (
                <div className="w-6 h-6 rounded-full bg-aura text-white flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
              ) : (
                <Circle className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base">{t.emoji}</span>
                <span className={cn(
                  'font-medium text-sm',
                  t.done && 'text-aura line-through decoration-aura/40',
                )}>
                  {t.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 ml-7">{t.hint}</p>
            </div>
            <div className="text-xs font-medium text-aura whitespace-nowrap mt-1">
              +{t.reward} ORA
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onBack} className="h-12 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium text-base"
        >
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
