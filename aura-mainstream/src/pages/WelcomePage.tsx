import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-amber-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-4000"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          {/* AURA Logo */}
          <div className="mb-8">
            <div className="mx-auto w-20 h-20 mb-6 relative">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="drop-shadow-2xl">
                <defs>
                  <linearGradient id="aura-welcome-gradient" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" />
                    <stop offset="0.5" stopColor="#F59E0B" />
                    <stop offset="1" stopColor="#7C3AED" />
                  </linearGradient>
                </defs>
                <circle cx="40" cy="40" r="35" stroke="url(#aura-welcome-gradient)" strokeWidth="4" strokeLinecap="round" strokeDasharray="20 20" />
                <circle cx="40" cy="40" r="15" fill="url(#aura-welcome-gradient)" />
              </svg>
            </div>
            <div className="text-white font-bold text-3xl mb-2 tracking-tight">AURA</div>
            <div className="text-purple-200 text-sm font-medium tracking-wide">Protocol v0.8 · Built on Solana</div>
          </div>

          {/* Main heading */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-none">
            <span className="block">Every Creator</span>
            <span className="block bg-gradient-to-r from-amber-300 via-orange-300 to-purple-300 bg-clip-text text-transparent">
              Is an Economy
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-purple-100 max-w-4xl mx-auto mb-12 leading-relaxed">
            AURA is a decentralized creator economy protocol on Solana. 
            Sign up with email. No wallet required. No gas fees. Keep 95% of what you earn.
          </p>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 max-w-4xl mx-auto mb-12">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">95%</div>
              <div className="text-purple-200 text-sm">Creators Keep</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">5%</div>
              <div className="text-purple-200 text-sm">Platform Fee</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">25×</div>
              <div className="text-purple-200 text-sm">Max Discovery Reward</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">$0</div>
              <div className="text-purple-200 text-sm">Gas Fees</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">200+</div>
              <div className="text-purple-200 text-sm">Years Storage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">10K</div>
              <div className="text-purple-200 text-sm">Creator Coin Supply</div>
            </div>
          </div>
        </div>

        {/* Dual Action Buttons - Key Feature! */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button
            onClick={() => navigate('/auth')}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white border-0 px-8 py-4 text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200"
          >
            Join as Creator →
          </Button>
          <Button
            onClick={() => navigate('/protocol')}
            variant="outline"
            className="border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 px-8 py-4 text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200"
          >
            Explore Protocol
          </Button>
        </div>

        {/* Footer text */}
        <p className="text-purple-200 text-sm text-center">
          No wallet required · Sign up with email · Built on Solana
        </p>
      </div>
    </div>
  );
}