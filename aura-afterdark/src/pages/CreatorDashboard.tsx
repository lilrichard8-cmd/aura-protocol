import { BarChart3, TrendingUp, Users, Eye, Heart, Coins, DollarSign, Plus } from 'lucide-react';
import { mockDashboardStats, mockCreatorCoinStats, mockContentPerformance, mockTopPatrons } from '@/data/mockDashboard';

export default function CreatorDashboard() {
  const stats = mockDashboardStats;
  const coinStats = mockCreatorCoinStats;
  const content = mockContentPerformance;
  const patrons = mockTopPatrons;
  
  // Mock earnings chart data
  const chartData = [
    { day: 'Mon', amount: 145 }, { day: 'Tue', amount: 230 }, { day: 'Wed', amount: 180 },
    { day: 'Thu', amount: 310 }, { day: 'Fri', amount: 420 }, { day: 'Sat', amount: 380 }, { day: 'Sun', amount: 275 }
  ];
  
  const maxAmount = Math.max(...chartData.map(d => d.amount));
  
  return (
    <div className="min-h-screen bg-aura-bg text-aura-text md:pl-64">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
            <p className="text-aura-text-secondary">Track your performance and earnings</p>
          </div>
          
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-aura-surface hover:bg-aura-surface/80 rounded-lg transition-colors">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-aura-accent hover:bg-aura-accent-hover text-white rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Create Content
            </button>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-aura-gold/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-aura-gold" />
              </div>
              <div className="flex items-center text-green-400 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                +{stats.weeklyChange}%
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">${stats.totalEarnings.toLocaleString()}</h3>
            <p className="text-aura-text-secondary text-sm">Total Earnings</p>
          </div>
          
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-aura-accent/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-aura-accent" />
              </div>
              <div className="flex items-center text-green-400 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                +18.5%
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">${stats.monthlyEarnings.toLocaleString()}</h3>
            <p className="text-aura-text-secondary text-sm">This Month</p>
          </div>
          
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex items-center text-green-400 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                +{stats.subscriberChange}%
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.subscriberCount.toLocaleString()}</h3>
            <p className="text-aura-text-secondary text-sm">Subscribers</p>
          </div>
          
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Coins className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex items-center text-green-400 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                +{coinStats.priceChange}%
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">${coinStats.price}</h3>
            <p className="text-aura-text-secondary text-sm">{coinStats.symbol} Price</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Revenue Chart */}
          <div className="xl:col-span-2">
            <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Revenue Overview</h3>
                <div className="flex items-center text-sm text-aura-text-secondary">
                  <span>Last 7 days</span>
                </div>
              </div>
              
              <div className="space-y-4">
                {chartData.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className="text-sm text-aura-text-secondary w-10">{item.day}</span>
                    <div className="flex-1 bg-aura-surface rounded-full h-8 relative overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-aura-accent to-aura-gold rounded-full flex items-center justify-end pr-3 transition-all duration-300"
                        style={{ width: `${(item.amount / maxAmount) * 100}%` }}
                      >
                        <span className="text-xs font-bold text-white">${item.amount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Creator Coin Stats */}
            <div className="bg-aura-card p-6 rounded-lg border border-aura-border mt-6">
              <h3 className="text-xl font-semibold mb-6">Creator Coin Stats</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-aura-text-secondary text-sm mb-1">Holders</p>
                  <p className="text-2xl font-bold">{coinStats.holders.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-aura-text-secondary text-sm mb-1">Volume (24h)</p>
                  <p className="text-2xl font-bold">${coinStats.volume24h.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-aura-text-secondary text-sm mb-1">Market Cap</p>
                  <p className="text-2xl font-bold">${(coinStats.marketCap / 1000)}K</p>
                </div>
                <div>
                  <p className="text-aura-text-secondary text-sm mb-1">Price Change</p>
                  <p className="text-2xl font-bold text-green-400">+{coinStats.priceChange}%</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="space-y-6">
            {/* Content Performance */}
            <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
              <h3 className="text-xl font-semibold mb-6">Content Performance</h3>
              <div className="space-y-4">
                {content.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="absolute -top-1 -left-1 w-5 h-5 bg-aura-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-4 text-xs text-aura-text-secondary mt-1">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {(item.views / 1000).toFixed(1)}K
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${item.earnings.toFixed(0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {item.curationSignals}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Top Patrons */}
            <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
              <h3 className="text-xl font-semibold mb-6">Top Patrons</h3>
              <div className="space-y-4">
                {patrons.map(patron => (
                  <div key={patron.id} className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={patron.avatar}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-aura-gold text-black text-xs font-bold rounded-full flex items-center justify-center">
                        {patron.rank}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{patron.displayName}</p>
                      <p className="text-xs text-aura-text-secondary">@{patron.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-aura-gold">${patron.totalSpent.toLocaleString()}</p>
                      <p className="text-xs text-aura-text-secondary">spent</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
              <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 p-3 bg-aura-surface hover:bg-aura-surface/80 rounded-lg transition-colors text-left">
                  <Plus className="w-4 h-4 text-aura-accent" />
                  <span>Create New Post</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 bg-aura-surface hover:bg-aura-surface/80 rounded-lg transition-colors text-left">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <span>View Analytics</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 bg-aura-surface hover:bg-aura-surface/80 rounded-lg transition-colors text-left">
                  <DollarSign className="w-4 h-4 text-aura-gold" />
                  <span>Payout History</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}