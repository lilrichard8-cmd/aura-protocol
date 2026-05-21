// Dashboard Content tab — your published posts, sortable, with metrics.
// Extracted from DashboardPage.tsx 2026-05-20 P-1 split.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins, FileText, Heart, ImageIcon, MessageCircle,
  Music, Pin, Plus, Video, Zap,
} from 'lucide-react';
import { KpiTile, PostRow } from './dashboardRows';

export function ContentTab({
  postMetrics, navigate,
}: {
  postMetrics: Array<{ post: any; views: number | null; likes: number; comments: number; curations: number | null; earned: number | null; isPinned: boolean; isBoosted: boolean }>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [filter, setFilter] = useState<'all' | 'photo' | 'text' | 'audio' | 'video'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'likes' | 'comments'>('newest');

  const filtered = useMemo(() => {
    let out = postMetrics;
    if (filter !== 'all') out = out.filter(m => m.post.mode === filter);
    out = [...out];
    if (sortBy === 'likes') out.sort((a, b) => b.likes - a.likes);
    else if (sortBy === 'comments') out.sort((a, b) => b.comments - a.comments);
    else out.sort((a, b) => b.post.createdAt - a.post.createdAt);
    return out;
  }, [postMetrics, filter, sortBy]);

  const totals = useMemo(() => ({
    posts: postMetrics.length,
    likes: postMetrics.reduce((s, m) => s + m.likes, 0),
    comments: postMetrics.reduce((s, m) => s + m.comments, 0),
    pinned: postMetrics.filter(m => m.isPinned).length,
    boosted: postMetrics.filter(m => m.isBoosted).length,
  }), [postMetrics]);

  const filterChips: Array<{ id: typeof filter; label: string; icon: typeof Coins }> = [
    { id: 'all', label: 'All', icon: FileText },
    { id: 'photo', label: 'Photo', icon: ImageIcon },
    { id: 'text', label: 'Text', icon: FileText },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'video', label: 'Video', icon: Video },
  ];

  return (
    <div className="space-y-5">
      {/* Stats row — only metrics we actually have on-chain */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile icon={<FileText className="w-4 h-4" />} label="Posts" value={totals.posts.toString()} unit="published" tone="aura" />
        <KpiTile icon={<Heart className="w-4 h-4" />} label="Likes" value={totals.likes.toLocaleString()} unit="on-chain" tone="rose" />
        <KpiTile icon={<MessageCircle className="w-4 h-4" />} label="Comments" value={totals.comments.toLocaleString()} unit="on-chain" tone="purple" />
        <KpiTile icon={<Pin className="w-4 h-4" />} label="Pinned" value={totals.pinned.toString()} unit="posts" tone="emerald" />
        <KpiTile icon={<Zap className="w-4 h-4" />} label="Boosted" value={totals.boosted.toString()} unit="posts" tone="amber" />
      </div>

      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex gap-1.5 flex-wrap">
          {filterChips.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === id
                  ? 'bg-aura text-white'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 rounded-lg bg-secondary/40 border border-border text-xs font-medium"
          >
            <option value="newest">Newest</option>
            <option value="likes">Most liked</option>
            <option value="comments">Most discussed</option>
          </select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/50 bg-secondary/20 p-12 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-medium text-sm mb-1">
            {postMetrics.length === 0 ? 'No content yet' : `No ${filter} posts`}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {postMetrics.length === 0
              ? 'Publish your first post to start tracking metrics.'
              : 'Try a different filter, or create new content.'}
          </p>
          <button
            onClick={() => navigate('/create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create new
          </button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {filtered.map((m, i) => (
              <PostRow key={m.post.id} m={m} rank={i + 1} showRank={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab 3: Bounties
// ═══════════════════════════════════════════════════════════════════════
export default ContentTab;
