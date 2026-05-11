/**
 * ChatBadges — Twitch-style inline badges shown next to a chatter's
 * name in the live stream chat. Drives off whatever attributes the
 * caller knows about the user (subscriber, mod/committee, og, tipper).
 *
 * Each badge is a tight pill with an emoji glyph. Tooltips on hover.
 *
 * 2026-05-11.
 */

export interface ChatBadgeAttrs {
  isSubscriber?: boolean;       // holds creator's CC
  subscriberMonths?: number;    // tier ribbon
  isMod?: boolean;              // committee member
  isOG?: boolean;               // followed early
  isTopTipper?: boolean;        // tipped this stream
}

export default function ChatBadges({ attrs }: { attrs: ChatBadgeAttrs }) {
  const badges: { key: string; emoji: string; tone: string; title: string }[] = [];

  if (attrs.isMod) {
    badges.push({ key: 'mod', emoji: '🛡', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', title: 'Committee member' });
  }
  if (attrs.isSubscriber) {
    const months = attrs.subscriberMonths ?? 0;
    const tone = months >= 12
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : months >= 6
        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
    const title = months >= 1 ? `${months} month subscriber` : 'Subscriber';
    badges.push({ key: 'sub', emoji: '🌟', tone, title });
  }
  if (attrs.isOG) {
    badges.push({ key: 'og', emoji: '📅', tone: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', title: 'Early follower' });
  }
  if (attrs.isTopTipper) {
    badges.push({ key: 'tipper', emoji: '🎁', tone: 'bg-pink-500/15 text-pink-600 dark:text-pink-400', title: 'Top tipper this stream' });
  }

  if (badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 mr-1 align-middle">
      {badges.map(b => (
        <span
          key={b.key}
          className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] ${b.tone}`}
          title={b.title}
        >
          {b.emoji}
        </span>
      ))}
    </span>
  );
}
