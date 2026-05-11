import UserAvatar from '@/components/UserAvatar';
import { useNavigate } from 'react-router-dom';
import { Radio, Clock, Eye, Users } from 'lucide-react';
import { liveStreams } from '@/data/mockP1';
import { useI18n } from '@/context/I18nContext';

export default function LivePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const live = liveStreams.filter(s => s.isLive);
  const upcoming = liveStreams.filter(s => !s.isLive);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold">{t.live.title}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-8">
        {/* Live Now */}
        {live.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-lg font-bold">{t.live.liveNow}</h2>
              <span className="text-sm text-muted-foreground">({live.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {live.map(stream => (
                <button
                  key={stream.id}
                  onClick={() => navigate(`/live/${stream.id}`)}
                  className="group relative rounded-2xl overflow-hidden bg-card border border-border/40 hover:border-aura/30 transition-all text-left"
                >
                  <div className="relative aspect-video">
                    <img src={stream.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-md bg-red-500 text-white text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {t.live.liveBadge}
                    </div>
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white text-xs">
                      <Eye className="w-3 h-3" />
                      {stream.viewerCount.toLocaleString()}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white font-semibold text-sm line-clamp-1">{stream.title}</p>
                    </div>
                  </div>
                  <div className="p-3 flex items-center gap-3">
                    <UserAvatar src={stream.host.avatar} displayName={stream.host.displayName} username={stream.host.username} className="w-8 h-8 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{stream.host.displayName}</p>
                      <p className="text-xs text-muted-foreground">{stream.category}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-lg font-bold">{t.live.upcoming}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {upcoming.map(stream => (
                <div
                  key={stream.id}
                  className="flex gap-3 p-3 rounded-xl bg-card border border-border/40"
                >
                  <div className="relative w-28 h-20 rounded-lg overflow-hidden shrink-0">
                    <img src={stream.coverImage} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white/70" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-2">{stream.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stream.host.displayName}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-ora font-medium">
                      <Clock className="w-3 h-3" />
                      {stream.scheduledAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
