export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-[#1A1A2E] text-aura-text">
      <div className="max-w-6xl mx-auto px-4 py-8 md:ml-64">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 via-indigo-400/20 to-purple-400/20 blur-3xl rounded-full animate-pulse-slow" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500">
              Governance
            </span>
            <br />
            <span className="text-white/80">& Voting</span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-md leading-relaxed">
            Participate in AURA protocol governance. Vote on proposals and shape the future of the platform.
          </p>
          
          <div className="glass-card px-8 py-6 rounded-2xl max-w-sm">
            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
              Coming Soon
            </p>
            <p className="text-sm text-gray-400 mt-2">
              DAO governance system
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}