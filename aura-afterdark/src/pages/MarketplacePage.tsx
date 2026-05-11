export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-[#1A1A2E] text-aura-text">
      <div className="max-w-6xl mx-auto px-4 py-8 md:ml-64">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-aura-accent/20 blur-3xl rounded-full animate-pulse-slow" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-aura-accent via-[#FF5E78] to-[#D63B55] flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-aura-accent to-[#D63B55]">
              Creator Coin
            </span>
            <br />
            <span className="text-white/80">Marketplace</span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-md leading-relaxed">
            Trade creator coins, boost content, and participate in the AURA creator economy.
          </p>
          
          <div className="glass-card px-8 py-6 rounded-2xl max-w-sm">
            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-aura-accent to-[#D63B55]">
              Coming Soon
            </p>
            <p className="text-sm text-gray-400 mt-2">
              The marketplace is under development
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}