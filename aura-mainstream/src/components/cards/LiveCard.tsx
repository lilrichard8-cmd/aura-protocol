import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Post } from '@/types';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function LiveCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      className="group relative overflow-hidden cursor-pointer rounded-[4px] break-inside-avoid mb-[1px]"
      onClick={() => navigate(`/post/${post.id}`)}
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

        {/* LIVE badge - always visible top left */}
        <div className="absolute top-2 left-2 z-10">
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/90 text-white text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse flex-shrink-0" />
            LIVE
          </div>
        </div>

        {/* Viewer count - top right, always visible */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 text-white text-[10px]">
          <Eye className="w-3 h-3" />
          {post.viewerCount?.toLocaleString()}
        </div>

        {/* Hover info - bottom left */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
          <p className="text-[11px] text-white/80 font-medium leading-none mb-1 truncate">{post.author.displayName}</p>
          <p className="text-[13px] text-white font-semibold leading-snug line-clamp-2">{post.title}</p>
        </div>
      </div>
    </div>
  );
}
