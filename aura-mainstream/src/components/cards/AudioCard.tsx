import { useNavigate } from 'react-router-dom';
import type { Post } from '@/types';
import { useState, useRef } from 'react';
import { Play, Pause, Music } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useMediaUrl } from '@/hooks/useMediaUrl';

export default function AudioCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  // 2026-05-11 R10: resolve `media:<uuid>` refs (IndexedDB) into blob: URLs.
  // Plain URLs pass through unchanged.
  const resolvedAudioUrl = useMediaUrl(post.audioUrl);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const waveform = post.audioWaveform ?? Array.from({ length: 20 }, () => Math.random() * 0.7 + 0.2);

  return (
    <div
      className="group relative overflow-hidden cursor-pointer rounded-[4px] break-inside-avoid mb-[1px] bg-gradient-to-br from-[#1a0a2e] to-[#0d1a2e] border border-white/10 hover:border-purple-500/40 transition-colors duration-150"
      onClick={() => navigate(`/post/${post.id}`)}
    >
      {/* Background art */}
      {post.coverImage && (
        <div className="absolute inset-0 opacity-20">
          <img src={post.coverImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/80" />
        </div>
      )}

      <div className="relative z-10 p-4" style={{ minHeight: '160px' }}>
        {/* Music note icon top-left */}
        <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <Music className="w-3.5 h-3.5 text-purple-400" />
        </div>

        {/* Status icons */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
          {post.isPremium && (
            <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[11px] border border-white/10" title="Premium">🔒</div>
          )}
          {post.isCurated && (
            <div className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[11px] border border-white/10" title="Curated">✦</div>
          )}
        </div>

        {/* Title */}
        <div className="mt-8 mb-3">
          <p className="text-[13px] text-white font-semibold leading-snug line-clamp-2">{post.title}</p>
          {post.content && (
            <p className="text-[11px] text-white/50 leading-relaxed mt-1 line-clamp-2">{post.content}</p>
          )}
        </div>

        {/* Waveform */}
        <div className="flex items-end gap-[2px] h-8 mb-3">
          {waveform.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors duration-150 ${isPlaying ? 'bg-purple-400' : 'bg-white/30 group-hover:bg-purple-400/60'}`}
              style={{ height: `${h * 100}%`, minHeight: '3px' }}
            />
          ))}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-7 h-7 rounded-full bg-purple-500/80 hover:bg-purple-500 flex items-center justify-center transition-colors duration-150 flex-shrink-0"
          >
            {isPlaying
              ? <Pause className="w-3 h-3 text-white fill-white" />
              : <Play className="w-3 h-3 text-white fill-white ml-0.5" />
            }
          </button>
          <span className="text-[10px] text-white/50">{post.audioDuration ?? '—'}</span>

          {/* Author - visible on hover */}
          <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-4 h-4 rounded-full" />
            <span className="text-[11px] text-white/70 truncate max-w-[80px]">{post.author.displayName}</span>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      {resolvedAudioUrl && (
        <audio
          ref={audioRef}
          src={resolvedAudioUrl}
          onEnded={() => setIsPlaying(false)}
          preload="none"
        />
      )}
    </div>
  );
}
