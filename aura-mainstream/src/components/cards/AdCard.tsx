import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import type { Post } from '@/types';

export default function AdCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleAdClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.adUrl) window.open(post.adUrl, '_blank');
  };

  return (
    <div
      className="group relative overflow-hidden cursor-pointer rounded-[4px] break-inside-avoid mb-[1px]"
      onClick={() => navigate(`/ad/${post.id}`)}
    >
      <div className="relative w-full bg-muted" style={{ aspectRatio: post.aspectRatio || '3/4' }}>
        {!imageLoaded && <Skeleton className="absolute inset-0 w-full h-full rounded-[4px]" />}
        <img
          src={post.coverImage}
          alt={post.title}
          className={`w-full h-full object-cover transition-opacity duration-150 block ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />

        {/* AD badge - always visible top right */}
        <div className="absolute top-2 right-2 z-10">
          <div
            className="px-1.5 py-0.5 rounded-full bg-black/50 text-white/80 text-[10px] font-medium border border-white/10 hover:bg-white/90 hover:text-gray-900 transition-colors cursor-pointer"
            onClick={handleAdClick}
          >
            {post.adLabel || 'AD'}
          </div>
        </div>

        {/* Curated / boosted icons */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {post.isCurated && (
            <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[11px] border border-white/10" title="Curated">✦</div>
          )}
          {post.isBoosted && (
            <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[11px] border border-white/10" title="Boosted">⚡</div>
          )}
        </div>

        {/* Hover info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
          <p className="text-[11px] text-white/80 font-medium leading-none mb-1 truncate">{post.author.displayName}</p>
          <p className="text-[13px] text-white font-semibold leading-snug line-clamp-2">{post.title}</p>
        </div>
      </div>
    </div>
  );
}
