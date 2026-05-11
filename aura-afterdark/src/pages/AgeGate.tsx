import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface AgeGateProps {
  onVerified: () => void;
}

export default function AgeGate({ onVerified }: AgeGateProps) {
  const [declining, setDeclining] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A2E] overflow-hidden">
      {/* Enhanced Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Primary gradient orb */}
        <div className="absolute top-[-30%] left-[-30%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-aura-accent/30 via-aura-accent/20 to-transparent blur-[120px] animate-pulse-slow mix-blend-screen" />
        {/* Secondary gradient orb */}
        <div className="absolute bottom-[-30%] right-[-30%] w-[80%] h-[80%] rounded-full bg-gradient-to-tl from-[#0F3460]/60 via-[#16213E]/40 to-transparent blur-[120px] animate-pulse-slow mix-blend-screen" style={{ animationDelay: '1.5s' }} />
        {/* Moving accent orbs */}
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-aura-accent/10 blur-[80px] animate-float" style={{ animationDelay: '3s', animationDuration: '8s' }} />
        <div className="absolute bottom-[30%] left-[15%] w-[35%] h-[35%] rounded-full bg-[#E94560]/15 blur-[60px] animate-float" style={{ animationDelay: '5s', animationDuration: '12s' }} />
        {/* Grain texture */}
        <div className="absolute inset-0 opacity-30 brightness-110 contrast-120 mix-blend-overlay" 
             style={{
               backgroundImage: `radial-gradient(circle at 50% 50%, rgba(233, 69, 96, 0.1) 0%, transparent 50%), 
                                 radial-gradient(circle at 80% 20%, rgba(15, 52, 96, 0.15) 0%, transparent 50%),
                                 radial-gradient(circle at 20% 80%, rgba(26, 26, 46, 0.2) 0%, transparent 50%)`
             }} />
      </div>

      <div className="relative z-10 mx-4 max-w-sm w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
        {/* Enhanced Logo */}
        <div className="space-y-4 animate-float">
          <div className="relative inline-block group">
            {/* Glow effect behind the text */}
            <div className="absolute -inset-8 bg-gradient-to-r from-transparent via-aura-accent/30 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -inset-4 bg-aura-accent/10 blur-xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
            
            <h1 className="relative text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white/95 to-white/70 drop-shadow-[0_0_40px_rgba(255,255,255,0.3)] group-hover:from-white group-hover:via-aura-accent/20 group-hover:to-white/80 transition-all duration-500">
              AURA
            </h1>
            
            {/* Enhanced "After Dark" subtitle */}
            <div className="absolute -bottom-4 right-2 group">
              <span className="text-sm font-bold tracking-[0.25em] text-aura-accent uppercase drop-shadow-[0_0_15px_rgba(233,69,96,1)] animate-pulse-slow">
                After Dark
              </span>
              <div className="absolute -inset-2 bg-aura-accent/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </div>
        </div>

        {/* Enhanced Warning card */}
        <div className="glass-card rounded-3xl p-8 space-y-7 shadow-2xl shadow-black/80 ring-1 ring-white/10 relative overflow-hidden">
          {/* Background shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-aura-accent/[0.02] opacity-60" />
          
          {/* Age icon with enhanced effects */}
          <div className="relative w-28 h-28 mx-auto group">
            {/* Multiple glow layers */}
            <div className="absolute inset-0 bg-aura-accent/30 rounded-full blur-2xl animate-pulse-slow" />
            <div className="absolute inset-2 bg-aura-accent/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="relative w-full h-full rounded-full bg-gradient-to-b from-[#1E1E3A] via-[#16213E] to-[#0F3460] flex items-center justify-center border border-white/20 shadow-inner group-hover:border-white/30 transition-colors duration-300">
              <span className="text-6xl filter drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500 animate-pulse-slow">🔞</span>
            </div>
            {/* Rotating ring */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-aura-accent/60 via-transparent to-aura-accent/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ backgroundClip: 'padding-box, border-box' }} />
          </div>

          <div className="space-y-4 relative z-10">
            <h2 className="text-3xl font-bold text-white tracking-tight">Age Verification</h2>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-aura-accent to-transparent rounded-full shadow-[0_0_10px_rgba(233,69,96,0.5)]" />
          </div>

          <p className="text-gray-300 text-base leading-relaxed font-light relative z-10">
            This platform contains adult content intended for users aged{' '}
            <span className="text-white font-semibold border-b-2 border-aura-accent/60 pb-0.5 relative">
              18 years or older
              <span className="absolute inset-0 bg-aura-accent/10 blur-sm -z-10" />
            </span>.
            <br className="hidden sm:block" />
            By entering, you confirm that you meet the legal age requirement.
          </p>

          <div className="pt-6 space-y-4 relative z-10">
            <Button
              onClick={onVerified}
              className="w-full h-16 bg-gradient-to-r from-aura-accent via-[#FF5E78] to-[#D63B55] hover:from-[#FF5E78] hover:via-aura-accent hover:to-[#FF5E78] text-white font-bold rounded-2xl text-lg shadow-[0_0_25px_rgba(233,69,96,0.4)] hover:shadow-[0_0_40px_rgba(233,69,96,0.7)] transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border-t border-white/30 relative overflow-hidden group"
            >
              {/* Enhanced shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
              <span className="relative z-10 tracking-wide">I am 18 or older — Enter</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => setDeclining(true)}
              className="w-full h-12 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl text-sm font-medium transition-all duration-300 hover:border hover:border-white/10"
            >
              I am under 18 — Leave
            </Button>
          </div>
        </div>

        {declining && (
          <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-md rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 shadow-lg shadow-red-900/20">
            <p className="text-red-400 text-sm font-medium">
              You must be 18 or older to access this platform. Please close this tab.
            </p>
          </div>
        )}

        {/* Enhanced footer */}
        <div className="flex items-center justify-center gap-3 text-white/30 text-[11px] font-medium tracking-wider uppercase animate-pulse-slow">
          <span className="opacity-70">Powered by</span>
          <div className="flex items-center gap-2">
            <span className="text-white/50 font-bold">Arweave</span>
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <span className="text-white/50 font-bold">Solana</span>
          </div>
        </div>
      </div>
    </div>
  );
}
