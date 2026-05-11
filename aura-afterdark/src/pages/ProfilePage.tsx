import {
  Wallet, Shield, Bell, LogOut, ChevronRight,
  Users, FileText, Coins, Globe, Camera
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { currentUser } from '@/data/mock';

export default function ProfilePage() {

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-[#16213E]">
      {/* Header */}
      <header className="relative bg-[#1A1A2E] pb-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-aura-accent/20 to-transparent opacity-50 pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-5 pt-10 relative z-10 md:ml-64">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-aura-accent to-aura-gold">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.displayName}
                  className="w-full h-full rounded-full object-cover border-4 border-[#1A1A2E]"
                />
              </div>
              {currentUser.kycVerified && (
                <div className="absolute bottom-1 right-1 bg-green-500 text-white p-1.5 rounded-full border-4 border-[#1A1A2E] shadow-sm">
                  <Shield className="w-3.5 h-3.5 fill-current" />
                </div>
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-1">{currentUser.displayName}</h1>
            <p className="text-sm text-gray-400 font-medium">@{currentUser.username}</p>
            
            <div className="flex items-center gap-2 mt-4">
               <Badge className="bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-3 py-1 font-normal">
                  Joined {currentUser.joinedDate}
               </Badge>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#16213E] border border-white/5 rounded-2xl p-4 text-center shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wallet className="w-8 h-8 text-aura-gold" />
              </div>
              <p className="text-xl font-black text-aura-gold tracking-tight">{currentUser.oraBalance.toLocaleString()}</p>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-wider">ORA Balance</p>
            </div>
            <div className="bg-[#16213E] border border-white/5 rounded-2xl p-4 text-center shadow-lg">
              <p className="text-xl font-black text-white tracking-tight">847</p>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-wider">Subscribers</p>
            </div>
            <div className="bg-[#16213E] border border-white/5 rounded-2xl p-4 text-center shadow-lg">
              <p className="text-xl font-black text-aura-accent tracking-tight">342</p>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-wider">Posts</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 pt-6 space-y-8 md:ml-64">
        {/* Creator Tools Section */}
        <section className="space-y-3">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-aura-accent" />
              Creator Studio
           </h3>
           <div className="bg-[#1A1A2E] rounded-3xl p-2 border border-white/5 shadow-xl">
              <div className="grid grid-cols-2 gap-2">
                 <button className="bg-gradient-to-br from-aura-accent/20 to-transparent p-4 rounded-2xl border border-aura-accent/20 hover:border-aura-accent/50 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-aura-accent flex items-center justify-center mb-3 shadow-lg shadow-aura-accent/20 group-hover:scale-110 transition-transform">
                       <FileText className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-bold text-white text-sm">My Content</p>
                    <p className="text-[10px] text-gray-400">Manage posts & PPV</p>
                 </button>
                 <button className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center mb-3 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                       <Users className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-bold text-white text-sm">Subscribers</p>
                    <p className="text-[10px] text-gray-400">Analytics & CRM</p>
                 </button>
                 <button className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-aura-gold flex items-center justify-center mb-3 shadow-lg shadow-aura-gold/20 group-hover:scale-110 transition-transform">
                       <Coins className="w-5 h-5 text-black" />
                    </div>
                    <p className="font-bold text-white text-sm">Creator Coin</p>
                    <p className="text-[10px] text-gray-400">$AURA $0.42</p>
                 </button>
                 <button className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center mb-3 shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
                       <Camera className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-bold text-white text-sm">Go Live</p>
                    <p className="text-[10px] text-gray-400">Start streaming</p>
                 </button>
              </div>
           </div>
        </section>

        {/* Menu sections */}
        <section className="space-y-3">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-gray-500" />
              Settings
           </h3>
           <div className="bg-[#1A1A2E] rounded-3xl overflow-hidden border border-white/5 shadow-xl">
             {[
               { icon: Wallet, label: 'Wallet', desc: 'Manage earnings & payouts', color: 'text-blue-400' },
               { icon: Shield, label: 'Privacy & Safety', desc: 'Geo-blocking, watermarks', color: 'text-green-400' },
               { icon: Bell, label: 'Notifications', desc: 'Push & email preferences', color: 'text-yellow-400' },
               { icon: Globe, label: 'Geo-Blocking', desc: '2 regions blocked', color: 'text-purple-400' },
             ].map((item, i) => (
               <button
                 key={item.label}
                 className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors ${i !== 3 ? 'border-b border-white/5' : ''}`}
               >
                 <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center`}>
                   <item.icon className={`w-4 h-4 ${item.color}`} />
                 </div>
                 <div className="flex-1 text-left">
                   <p className="text-sm font-bold text-white">{item.label}</p>
                   <p className="text-[11px] text-gray-500 font-medium">{item.desc}</p>
                 </div>
                 <ChevronRight className="w-4 h-4 text-gray-600" />
               </button>
             ))}
           </div>
        </section>

        {/* KYC Status */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/20 blur-2xl rounded-full" />
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
             <Shield className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
               <p className="text-sm text-white font-bold">Identity Verified</p>
               <Badge className="bg-green-500 text-black text-[10px] font-bold px-1.5 py-0">KYC</Badge>
            </div>
            <p className="text-xs text-green-400/80">You are eligible for all creator features</p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 pb-8 text-center space-y-4">
          <Button
             variant="ghost"
             className="text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl px-8 h-10 text-xs font-bold tracking-wide"
           >
             <LogOut className="w-3.5 h-3.5 mr-2" />
             SIGN OUT
           </Button>
           
          <p className="text-[10px] text-gray-600 font-medium tracking-wide">
            AURA After Dark v1.0 • Powered by Arweave & Solana
          </p>
        </div>
      </div>
    </div>
  );
}
