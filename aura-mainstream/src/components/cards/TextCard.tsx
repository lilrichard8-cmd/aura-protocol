import { useNavigate } from 'react-router-dom';
import type { Post } from '@/types';
import UserAvatar from '@/components/UserAvatar';

export default function TextCard({ post }: { post: Post }) {
  const navigate = useNavigate();

  return (
    <div
      className="group relative overflow-hidden cursor-pointer rounded-[4px] break-inside-avoid mb-[1px] bg-white/5 dark:bg-white/5 border border-white/10 hover:border-white/20 transition-colors duration-150 p-3"
      onClick={() => navigate(`/post/${post.id}`)}
    >
      {/* Status icons */}
      {(post.isCurated || post.isBoosted || post.isPremium) && (
        <div className="flex gap-1 mb-2">
          {post.isCurated && <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px]" title="Curated">✦</span>}
          {post.isBoosted && <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px]" title="Boosted">⚡</span>}
          {post.isPremium && <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px]" title="Premium">🔒</span>}
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3 whitespace-pre-wrap">
        {post.content}
      </p>

      {/* Hover author reveal */}
      <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-4 h-4 rounded-full" />
        <span className="text-[11px] text-muted-foreground truncate">{post.author.displayName}</span>
      </div>
    </div>
  );
}
