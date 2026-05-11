import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  src?: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
}

const FALLBACK_SRC = 'https://www.w3schools.com/html/mov_bbb.mp4';

function formatTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, poster, autoPlay = false, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [started, setStarted] = useState(false);

  const videoSrc = src || FALLBACK_SRC;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setStarted(true);
    } else {
      v.pause();
    }
  }, []);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || 0));
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  // Reset controls hide timer
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  // Video event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration);
    const onProgress = () => {
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onLoaded = () => { setLoading(false); setDuration(v.duration); };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('progress', onProgress);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('loadedmetadata', onLoaded);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('loadedmetadata', onLoaded);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'ArrowLeft':
          seek(currentTime - 5);
          break;
        case 'ArrowRight':
          seek(currentTime + 5);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, toggleFullscreen, toggleMute, seek, currentTime]);

  // Volume sync
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.volume = volume;
      v.muted = muted;
    }
  }, [volume, muted]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * duration);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0) setMuted(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-black group cursor-pointer select-none ${className}`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-controls]')) return;
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain"
      />

      {/* Loading spinner */}
      {loading && started && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {/* Big play button before first play */}
      {!started && !autoPlay && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        data-controls
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-3 pt-8">
          {/* Progress bar */}
          <div
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/prog"
            onClick={handleProgressClick}
          >
            {/* Buffered */}
            <div
              className="absolute h-1.5 bg-white/30 rounded-full"
              style={{ width: duration ? `${(buffered / duration) * 100}%` : '0%' }}
            />
            {/* Progress */}
            <div
              className="absolute h-1.5 bg-purple-500 rounded-full"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/prog:opacity-100 transition-opacity"
              style={{ left: duration ? `calc(${(currentTime / duration) * 100}% - 6px)` : '0' }}
            />
          </div>

          {/* Bottom row */}
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-purple-400 transition-colors">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="white" />}
            </button>

            <span className="text-white text-xs font-mono min-w-[80px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Volume */}
            <div className="flex items-center gap-1 group/vol">
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-purple-400 transition-colors">
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-purple-500 h-1 cursor-pointer"
              />
            </div>

            <div className="flex-1" />

            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-purple-400 transition-colors">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
