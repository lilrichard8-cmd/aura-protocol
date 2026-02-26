import { FC, useRef, useState } from 'react'

interface MediaPlayerProps {
  type: 'image' | 'video' | 'audio'
  src: string
  title?: string
}

export const MediaPlayer: FC<MediaPlayerProps> = ({ type, src, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const togglePlay = () => {
    if (type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    } else if (type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!isFullscreen) {
        videoRef.current.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
      setIsFullscreen(!isFullscreen)
    }
  }

  if (type === 'image') {
    return (
      <div className="relative group">
        <img 
          src={src} 
          alt={title}
          className="w-full h-auto rounded-xl"
        />
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="px-4 py-2 bg-black/80 backdrop-blur-sm rounded-lg text-white text-sm hover:bg-black/90">
            🔍 查看原图
          </button>
        </div>
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="relative bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full aspect-video"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Custom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <span className="text-2xl">{isPlaying ? '⏸️' : '▶️'}</span>
            </button>
            
            <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-aura w-1/3"></div>
            </div>
            
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-aura-purple transition-colors"
            >
              <span className="text-xl">⛶</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-white/10 rounded-xl p-6">
        <audio ref={audioRef} src={src} className="hidden" />
        
        <div className="flex items-center gap-6">
          <button
            onClick={togglePlay}
            className="w-16 h-16 bg-gradient-aura rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shadow-xl"
          >
            <span className="text-3xl text-white">{isPlaying ? '⏸️' : '▶️'}</span>
          </button>
          
          <div className="flex-1">
            <h3 className="font-bold mb-2">{title || '音频播放'}</h3>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-aura w-1/2 transition-all"></div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0:00</span>
              <span>3:45</span>
            </div>
          </div>
          
          <div className="text-gray-400">
            <button className="hover:text-white">🔊</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
