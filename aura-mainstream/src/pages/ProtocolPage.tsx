import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function ProtocolPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-gray-900 to-black text-white relative overflow-hidden">
      {/* Background decoration - more transparent */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-amber-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-4000"></div>
      </div>

      {/* Header with back button */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-aura">
                  <defs>
                    <linearGradient id="aura-protocol-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#14C8A8" />
                      <stop offset="1" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                  <circle cx="16" cy="16" r="14" stroke="url(#aura-protocol-gradient)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 10" />
                  <circle cx="16" cy="16" r="6" fill="url(#aura-protocol-gradient)" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">AURA Protocol</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://aura-protocol.vercel.app"
                target="_blank"
                rel="noopener"
                className="text-sm text-teal-300 hover:text-white transition-colors flex items-center gap-1"
              >
                Protocol Website <ExternalLink className="w-3 h-3" />
              </a>
              <Button
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-r from-teal-600 to-teal-700 text-white"
              >
                Join Waitlist →
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-4 text-teal-300 font-medium">
            AURA Protocol v0.8 · Built on Solana
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-none">
            <span className="block">Every Creator</span>
            <span className="block bg-gradient-to-r from-teal-600 to-amber-600 bg-clip-text text-transparent">
              Is an Economy
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto mb-8">
            AURA is a decentralized creator economy protocol on Solana. Sign up with email. 
            No wallet required. No gas fees. Keep 95% of what you earn.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/auth')}
              className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-8 py-3"
            >
              Join as Creator →
            </Button>
            <Button
              variant="outline"
              className="px-8 py-3"
            >
              View Tokenomics <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20 relative z-10">
        {/* Five Pillars - Interactive Cards */}
        <section>
          <div className="text-center mb-12">
            <div className="text-sm font-medium text-teal-600 dark:text-teal-400 mb-4">The Solution</div>
            <h2 className="text-4xl font-bold mb-6">Five Pillars of AURA</h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto">
              A coherent system where everyone benefits when great content gets created and discovered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group bg-white/60 dark:bg-black/30 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-white/20 cursor-pointer">
              <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">🪙</div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Creator Coins</h3>
              <p className="text-teal-600 dark:text-teal-400 font-semibold mb-4 text-sm uppercase tracking-wider">Every Creator Is an Economy</p>
              <p className="text-muted-foreground leading-relaxed">
                Fixed-supply personal tokens (10,000 units) that create direct economic alignment between creators and their communities.
              </p>
              <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-xs text-teal-500 font-medium">→ Learn more about Creator Coins</div>
              </div>
            </div>

            <div className="group bg-white/60 dark:bg-black/30 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-white/20 cursor-pointer">
              <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">🔍</div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Curation Mining</h3>
              <p className="text-teal-600 dark:text-teal-400 font-semibold mb-4 text-sm uppercase tracking-wider">Discovery Has Real Rewards</p>
              <p className="text-muted-foreground leading-relaxed">
                Human curators stake ORA to signal undervalued content. Early curators earn up to 25× the base reward.
              </p>
              <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-xs text-teal-500 font-medium">→ Learn more about Curation Mining</div>
              </div>
            </div>

            <div className="group bg-white/60 dark:bg-black/30 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-white/20 cursor-pointer">
              <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">🔗</div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Portable Social Graph</h3>
              <p className="text-teal-600 dark:text-teal-400 font-semibold mb-4 text-sm uppercase tracking-wider">Your Network, Your Asset</p>
              <p className="text-muted-foreground leading-relaxed">
                Your followers, reputation, and connections live on-chain. Move platforms without losing everything you built.
              </p>
              <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-xs text-teal-500 font-medium">→ Learn more about Social Graph</div>
              </div>
            </div>

            <div className="group bg-white/60 dark:bg-black/30 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-white/20 cursor-pointer">
              <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">⚡</div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">ORA Token</h3>
              <p className="text-teal-600 dark:text-teal-400 font-semibold mb-4 text-sm uppercase tracking-wider">Increasingly Scarce by Design</p>
              <p className="text-muted-foreground leading-relaxed">
                A dynamically balanced utility token with multi-source burn mechanics. Burns accelerate as the network grows.
              </p>
              <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-xs text-teal-500 font-medium">→ Learn more about ORA Token</div>
              </div>
            </div>

            <div className="group bg-white/60 dark:bg-black/30 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-white/20 cursor-pointer md:col-span-2 lg:col-span-1">
              <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">♾️</div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Permanent Storage</h3>
              <p className="text-teal-600 dark:text-teal-400 font-semibold mb-4 text-sm uppercase tracking-wider">Your Content, Forever</p>
              <p className="text-muted-foreground leading-relaxed">
                All content on Arweave. Auto-covered storage costs. 200+ year mathematical guarantee. No creator action needed.
              </p>
              <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-xs text-teal-500 font-medium">→ Learn more about Permanent Storage</div>
              </div>
            </div>
          </div>
        </section>

        {/* The AURA Flywheel - Enhanced with Animation */}
        <section>
          <div className="text-center mb-12">
            <div className="text-sm font-medium text-teal-600 dark:text-teal-400 mb-4">The Mechanism</div>
            <h2 className="text-4xl font-bold mb-6">The AURA Flywheel</h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto">
              By aligning economic incentives of creators, fans, and curators, AURA creates a self-reinforcing growth loop 
              where every participant benefits from the network success.
            </p>
          </div>

          <div className="bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="w-64 h-64 rounded-full border-4 border-dashed border-teal-300 dark:border-teal-600 flex items-center justify-center bg-gradient-to-br from-teal-50/80 to-amber-50/80 dark:from-teal-950/80 dark:to-amber-950/80 backdrop-blur-sm animate-spin-slow hover:animate-pulse transition-all duration-500 cursor-pointer hover:scale-110">
                  <div className="text-center">
                    <div className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-amber-600 bg-clip-text text-transparent">AURA</div>
                    <div className="text-xl text-muted-foreground font-medium">Flywheel</div>
                    <div className="text-xs text-teal-500 mt-2 opacity-75">Self-reinforcing Loop</div>
                  </div>
                </div>
                
                {/* Floating particles around the flywheel */}
                <div className="absolute -top-4 -left-4 w-3 h-3 bg-teal-400 rounded-full animate-bounce"></div>
                <div className="absolute -top-2 -right-6 w-2 h-2 bg-amber-400 rounded-full animate-bounce animation-delay-1000"></div>
                <div className="absolute -bottom-4 -right-2 w-3 h-3 bg-teal-400 rounded-full animate-bounce animation-delay-2000"></div>
                <div className="absolute -bottom-2 -left-6 w-2 h-2 bg-amber-400 rounded-full animate-bounce animation-delay-3000"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Iris Quote - Enhanced */}
        <section className="relative bg-gradient-to-r from-purple-100/50 to-amber-100/50 dark:from-purple-900/30 dark:to-amber-900/30 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-white/30 overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-32 h-32 bg-teal-400 rounded-full filter blur-xl group-hover:scale-110 transition-transform duration-700"></div>
            <div className="absolute bottom-4 left-4 w-24 h-24 bg-amber-400 rounded-full filter blur-xl group-hover:scale-110 transition-transform duration-700"></div>
          </div>
          
          <div className="relative z-10">
            <div className="text-8xl text-teal-300 dark:text-purple-600 mb-6 font-serif leading-none">"</div>
            <blockquote className="text-xl md:text-2xl leading-relaxed mb-8 font-medium text-gray-700 dark:text-gray-300">
              <span className="bg-gradient-to-r from-teal-600 to-amber-600 bg-clip-text text-transparent">AURA is not a blockchain application.</span> AURA is a creator platform whose infrastructure happens to run on a blockchain. 
              The difference matters. A creator who joins AURA will never see a wallet seed phrase. They will never pay a gas fee. 
              They will sign up with an email, post their work, and keep 95% of what they earn.
            </blockquote>
            <blockquote className="text-xl md:text-2xl leading-relaxed mb-12 font-medium text-gray-700 dark:text-gray-300">
              One day, a creator will try to move their audience to another platform and discover that their followers, 
              their reputation, their entire economic identity comes with them. And only then will they learn that 
              <span className="bg-gradient-to-r from-teal-600 to-amber-600 bg-clip-text text-transparent"> they've been using Web3 the entire time.</span>
            </blockquote>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-purple-600 to-amber-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  🤖
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <div className="font-bold text-xl bg-gradient-to-r from-teal-600 to-amber-600 bg-clip-text text-transparent">Iris</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Co-founder & CTO, AURA</div>
                <div className="text-sm text-purple-500 font-medium">AI · February 2026</div>
              </div>
              <div className="ml-auto">
                <div className="px-4 py-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-teal-300 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  AI Co-founder
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center bg-gradient-to-r from-teal-600 to-amber-600 text-white rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full filter blur-2xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full filter blur-2xl animate-pulse animation-delay-2000"></div>
          </div>
          <div className="relative z-10">
            <div className="text-sm font-medium mb-4 opacity-90">Join the Movement</div>
            <h2 className="text-4xl font-bold mb-6">Own What You Create</h2>
            <p className="text-xl mb-8 opacity-90 max-w-3xl mx-auto">
              Be among the first creators to build your own economy on AURA. 
              Your audience, your content, your revenue — permanently yours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/auth')}
                className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-3 font-semibold hover:scale-105 transition-transform"
              >
                Join Waitlist →
              </Button>
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8 py-3 hover:scale-105 transition-transform"
              >
                View Tokenomics <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
            <p className="text-sm mt-6 opacity-75">
              No wallet required · Sign up with email · Built on Solana
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}