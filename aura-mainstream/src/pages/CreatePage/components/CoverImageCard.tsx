// Cover image picker card for video/audio posts.
// Extracted from CreatePage.tsx 2026-05-20 P-1 split.
import React from 'react';
import { compressImageDataUrl } from '../lib/imageCompression';

/** 2026-05-11 R14: small settings-sidebar card that lets the user upload /
 *  replace / clear the cover image for a video or audio post. For video,
 *  the cover is auto-extracted as the first frame after upload; for audio,
 *  it's blank by default and the user is encouraged to add album art. */
export function CoverImageCard({
  cover,
  setCover,
  isVideo,
  fallbackImage,
}: {
  cover: string | null;
  setCover: React.Dispatch<React.SetStateAction<string | null>>;
  isVideo: boolean;
  fallbackImage?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const displayed = cover || fallbackImage || null;
  const handleFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      if (!raw) return;
      try {
        const compressed = await compressImageDataUrl(raw, 1280, 0.85);
        setCover(compressed);
      } catch {
        setCover(raw);
      }
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="bg-card rounded-2xl border shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Cover image</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isVideo
              ? 'Auto-extracted from your video. Override if you want a custom poster.'
              : 'Album art shown in the feed. Recommend square 1:1.'}
          </p>
        </div>
        {displayed && (
          <button
            onClick={() => setCover(null)}
            className="text-[11px] text-muted-foreground hover:text-red-500"
          >
            Clear
          </button>
        )}
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        className="aspect-square w-full rounded-xl overflow-hidden border border-border/60 bg-muted/30 cursor-pointer hover:border-aura/50 hover:bg-aura/5 transition-colors flex items-center justify-center group"
      >
        {displayed ? (
          <div className="relative w-full h-full">
            <img src={displayed} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Click to replace
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center px-4">
            <div className="text-2xl mb-1.5 opacity-60">{isVideo ? '🎬' : '🎵'}</div>
            <p className="text-xs text-muted-foreground">
              {isVideo
                ? 'Frame will appear here once the video is processed'
                : 'Click to upload album art'}
            </p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default CoverImageCard;
