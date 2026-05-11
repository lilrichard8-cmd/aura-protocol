/**
 * BelowPlayerTabs — Twitch-style About / Schedule / Videos / Clips
 * tab strip that lives directly under the StreamMetaBar.
 *
 * Each tab content is data-driven. The component owns its own active-
 * tab state so the parent can stay simple.
 *
 * 2026-05-11: split out so we can drop these tabs into the Iris
 * welcome stream too without copy-pasting layout.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Calendar, Video as VideoIcon, Scissors, Twitter, Globe, Github } from 'lucide-react';

interface Schedule {
  id: string;
  title: string;
  startsAt: number; // ms epoch
  durationMin: number;
}

interface Vod {
  id: string;
  title: string;
  thumb: string;
  durationMin: number;
  views: number;
  postedAt: number;
}

interface Clip {
  id: string;
  title: string;
  thumb: string;
  views: number;
  clippedAt: number;
}

interface Props {
  about: {
    bio: string;
    socials?: { twitter?: string; website?: string; github?: string };
    creatorCoinSymbol?: string | null;
    creatorCoinPrice?: number | null;
    creatorCoinHolders?: number | null;
  };
  schedule: Schedule[];
  vods: Vod[];
  clips: Clip[];
}

type TabId = 'about' | 'schedule' | 'videos' | 'clips';

export default function BelowPlayerTabs({ about, schedule, vods, clips }: Props) {
  const [active, setActive] = useState<TabId>('about');
  const navigate = useNavigate();

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'about',    label: 'About'    },
    { id: 'schedule', label: 'Schedule', count: schedule.length },
    { id: 'videos',   label: 'Videos',   count: vods.length },
    { id: 'clips',    label: 'Clips',    count: clips.length },
  ];

  return (
    <div className="bg-card">
      {/* Tab bar */}
      <div className="border-b border-border/40 flex gap-1 px-4 overflow-x-auto no-scrollbar">
        {tabs.map(t => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                isActive ? 'border-aura text-aura' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {active === 'about' && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground/85">{about.bio}</p>

            {/* Socials */}
            {about.socials && (
              <div className="flex flex-wrap gap-2">
                {about.socials.twitter && (
                  <a href={about.socials.twitter} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 hover:bg-secondary text-xs font-semibold">
                    <Twitter className="w-3.5 h-3.5" /> Twitter
                  </a>
                )}
                {about.socials.website && (
                  <a href={about.socials.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 hover:bg-secondary text-xs font-semibold">
                    <Globe className="w-3.5 h-3.5" /> Website
                  </a>
                )}
                {about.socials.github && (
                  <a href={about.socials.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 hover:bg-secondary text-xs font-semibold">
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                )}
              </div>
            )}

            {/* Creator Coin mini card */}
            {about.creatorCoinSymbol && about.creatorCoinPrice != null && (
              <div className="rounded-xl border border-border/60 bg-gradient-to-br from-aura/5 to-cyan-500/5 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-aura/10 text-aura flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Creator Coin</p>
                  <p className="text-base font-black">{about.creatorCoinSymbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black tabular-nums">{about.creatorCoinPrice.toFixed(4)} ORA</p>
                  {about.creatorCoinHolders != null && (
                    <p className="text-[11px] text-muted-foreground">{about.creatorCoinHolders.toLocaleString()} holders</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {active === 'schedule' && (
          schedule.length === 0 ? (
            <EmptyTab icon={Calendar} text="No upcoming streams scheduled." />
          ) : (
            <div className="space-y-2">
              {schedule.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-aura/40 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-aura/10 text-aura flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.startsAt).toLocaleString()} · {s.durationMin} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {active === 'videos' && (
          vods.length === 0 ? (
            <EmptyTab icon={VideoIcon} text="No past streams archived yet." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {vods.map(v => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/post/${v.id}`)}
                  className="text-left rounded-lg overflow-hidden border border-border/40 hover:border-aura/40 transition-colors group"
                >
                  <div className="aspect-video bg-secondary relative">
                    {v.thumb && <img src={v.thumb} alt={v.title} className="w-full h-full object-cover" />}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                      {v.durationMin}m
                    </span>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold truncate">{v.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {v.views.toLocaleString()} views · {timeAgo(v.postedAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {active === 'clips' && (
          clips.length === 0 ? (
            <EmptyTab icon={Scissors} text="No highlights clipped yet — be the first." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {clips.map(c => (
                <div key={c.id} className="rounded-lg overflow-hidden border border-border/40 hover:border-aura/40 transition-colors group cursor-pointer">
                  <div className="aspect-video bg-secondary relative">
                    {c.thumb && <img src={c.thumb} alt={c.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold truncate">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.views.toLocaleString()} views · {timeAgo(c.clippedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyTab({ icon: Icon, text }: { icon: typeof Calendar; text: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
