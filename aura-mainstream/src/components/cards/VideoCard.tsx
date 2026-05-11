import { useNavigate } from 'react-router-dom';
import type { Post } from '@/types';
import { useState, useRef } from 'react';
import { useMediaUrl } from '@/hooks/useMediaUrl';

// Public sample videos for mock data
const DEMO_VIDEO = 'https://www.w3schools.com/html/mov_bbb.mp4';

export default function VideoCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // 2026-05-11 R10: resolve IndexedDB media refs to blob: URLs.
  const resolvedVideoUrl = useMediaUrl(post.videoUrl);
  const videoSrc = resolvedVideoUrl ?? DEMO_VIDEO;

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {/* autoplay blocked */});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.currentTime >= 3) {
      videoRef.current.pause();
    }
  };

  return (
    <div
      className="group relative overflow-hidden cursor-pointer rounded-[4px] break-inside-avoid mb-[1px]"
      onClick={() => post.isPremium ? navigate(`/premium/${post.id}`, { state: { post } }) : navigate(`/post/${post.id}`)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-full bg-muted" style={{ aspectRatio: post.aspectRatio || '3/4' }}>
        {/* Poster image — shown when not hovered */}
        <img
          src={post.coverImage}
          alt={post.title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 block ${
            imageLoaded ? (isHovered ? 'opacity-0' : 'opacity-100') : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
        />

        {/* Video — plays on hover */}
        <video
          ref={videoRef}
          src={videoSrc}
          poster={post.coverImage}
          muted
          playsInline
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />

        {/* Duration badge */}
        {post.videoDuration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold z-10">
            {post.videoDuration}
          </div>
        )}

        {/* Type icons - top right */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          {post.isPremium && (
            <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[11px] border border-white/10" title="Premium">🔒</div>
          )}
          {post.isCurated && (
            <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[11px] border border-white/10" title="Curated">✦</div>
          )}
          {post.isBoosted && (
            <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[11px] border border-white/10" title="Boosted">⚡</div>
          )}
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
