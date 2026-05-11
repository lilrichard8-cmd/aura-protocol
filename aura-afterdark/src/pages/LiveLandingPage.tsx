export default function LiveLandingPage() {
  return (
    <div className="min-h-screen bg-[#1A1A2E] text-aura-text">
      <div className="max-w-6xl mx-auto px-4 py-8 md:ml-64">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-red-400/20 via-pink-400/20 to-purple-400/20 blur-3xl rounded-full animate-pulse-slow" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-red-500 via-pink-500 to-purple-500 flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-pink-500 to-purple-500">
              Live
            </span>
            <br />
            <span className="text-white/80">Streaming</span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-md leading-relaxed">
            Interactive live streaming with real-time tips, chat, and exclusive creator experiences.
          </p>
          
          <div className="glass-card px-8 py-6 rounded-2xl max-w-sm">
            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-500">
              Coming Soon
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Live streaming platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}