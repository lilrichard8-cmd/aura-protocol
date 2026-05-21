import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, X, ChevronDown, ChevronUp, BookOpen, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearAllTours } from '@/components/Tooltip/FirstVisitTooltip';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Floating help button + popover.
 *
 *   • Fixed bottom-right, just above the mobile BottomNav (extra bottom-pad on small screens).
 *   • Opens a popover with 5 FAQ entries (collapsible Q&A).
 *   • "Replay tour" wipes the `aura_tour_*_seen` keys + navigates to /onboarding.
 *   • External docs links use placeholder URLs (configure later with real docs domain).
 *
 * Keep this component lean (<200 LOC). If the FAQ list grows, factor it into
 * its own `faq.tsx` file under the same folder.
 */

const FAQ: { q: string; a: string }[] = [
  {
    q: '什么是 ORA？怎么获取？',
    a: 'ORA 是 AURA 协议的实用代币 — 用于解锁付费内容、给 tips、参与治理。新用户可以通过完成新手任务（约 50 ORA）、参与 Curation Mining、或在 /buy-ora 直接购买获取。',
  },
  {
    q: '什么是 Creator Coin？我能创建吗？',
    a: '每个创作者可以发自己的 Creator Coin —— 类似你专属的"股权"。门槛是粉丝数 ≥ 100；满足后去 /creator-coin 创建。总供应固定 10K 枚，按时间线性解锁给早期粉丝。',
  },
  {
    q: '怎么发帖子？什么是 Access Control？',
    a: '点侧边栏底部的"+ Studio"或顶部"+"按钮进入 /create。可以选 Photo / Video / Text / Audio / Live。Access Control 让你设置内容门槛：免费 / 持有 X ORA / 持有你的 Creator Coin / NFT 等。',
  },
  {
    q: 'AURA 怎么赚钱？平台抽成多少？',
    a: '协议费 0.5%（vs. 传统平台 30%）。其余全归创作者。AURA 没有股东要服务 — 协议费 100% 用于 ORA 回购销毁，让代币更稀缺。',
  },
  {
    q: 'Curation Mining 是什么？',
    a: '即使你不创作，也可以通过"发现好内容"赚 ORA。在 /curation 给优质内容点赞 — 越早发现（前 10% 策展者）获得 5× 倍率奖励。',
  },
];

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { updateProfile } = useAuth();

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleReplayTour = () => {
    clearAllTours();
    try { localStorage.removeItem('aura_onboarding_complete'); } catch { /* ignore */ }
    updateProfile({ isNewWallet: true });
    setOpen(false);
    showToast('info', 'Replaying tour…', 'Onboarding will start fresh.');
    navigate('/onboarding');
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Help"
        className={cn(
          'fixed z-40 right-4 bottom-20 lg:bottom-6 w-12 h-12 rounded-full',
          'bg-gradient-to-br from-aura to-ora text-white shadow-lg shadow-aura/30',
          'flex items-center justify-center hover:scale-105 active:scale-95 transition-transform',
        )}
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className={cn(
            'fixed z-50 right-4 bottom-36 lg:bottom-20 w-[min(360px,calc(100vw-2rem))]',
            'max-h-[70vh] overflow-y-auto',
            'bg-card border border-aura/30 rounded-2xl shadow-2xl',
            'animate-in fade-in zoom-in-95 duration-200 origin-bottom-right',
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div>
              <div className="font-semibold text-foreground">需要帮助？</div>
              <div className="text-xs text-muted-foreground">常见问题 & 引导</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-1.5">
            {FAQ.map((item, i) => {
              const expanded = expandedFaq === i;
              return (
                <div key={i} className="rounded-lg border border-border/60 bg-card/40">
                  <button
                    onClick={() => setExpandedFaq(prev => (prev === i ? null : i))}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/30 rounded-lg transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground pr-2">{item.q}</span>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-border/40 space-y-2">
            <a
              href="https://docs.aura.protocol"  // placeholder — replace with real docs domain
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/40 text-sm text-foreground transition-colors"
            >
              <BookOpen className="w-4 h-4 text-aura" />
              查看完整文档
              <span className="ml-auto text-xs text-muted-foreground">↗</span>
            </a>
            <button
              onClick={handleReplayTour}
              className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/40 text-sm text-foreground transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-aura" />
              重新查看新手引导
            </button>
          </div>
        </div>
      )}
    </>
  );
}
