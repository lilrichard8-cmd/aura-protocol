import { FC, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

const mockRewards = [
  {
    id: '1',
    type: 'daily_login',
    title: '每日登录奖励',
    description: '连续登录获得 ORA 奖励',
    amount: 10,
    token: 'ORA',
    completed: true,
    streak: 7,
    maxStreak: 30,
    nextReward: 15,
  },
  {
    id: '2',
    type: 'content_creation',
    title: '内容创作奖励',
    description: '发布高质量内容获得额外收益',
    amount: 50,
    token: 'ORA',
    completed: false,
    progress: 2,
    target: 5,
  },
  {
    id: '3',
    type: 'referral',
    title: '邀请好友奖励',
    description: '成功邀请新用户注册',
    amount: 100,
    token: 'ORA',
    completed: false,
    progress: 1,
    target: 3,
  },
  {
    id: '4',
    type: 'engagement',
    title: '互动达人奖励',
    description: '活跃互动获得社区奖励',
    amount: 25,
    token: 'ORA',
    completed: true,
    interactions: 156,
  },
]

const mockClaimHistory = [
  {
    id: '1',
    type: 'daily_login',
    amount: 10,
    token: 'ORA',
    timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
  },
  {
    id: '2',
    type: 'content_creation',
    amount: 50,
    token: 'ORA',
    timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
  },
  {
    id: '3',
    type: 'engagement',
    amount: 25,
    token: 'ORA',
    timestamp: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
  },
]

const mockStats = {
  totalEarned: 485,
  thisMonth: 125,
  streak: 7,
  rank: 'Silver',
}

export const Rewards: FC = () => {
  const { connected } = useWallet()
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [claiming, setClaiming] = useState<string | null>(null)

  const handleClaimReward = async (rewardId: string) => {
    if (!connected) {
      alert('请先连接钱包')
      return
    }

    setClaiming(rewardId)
    try {
      // Mock claim process
      await new Promise(resolve => setTimeout(resolve, 1500))
      alert('奖励领取成功！')
    } catch (error) {
      alert('领取失败，请重试')
    } finally {
      setClaiming(null)
    }
  }

  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    return '刚刚'
  }

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'daily_login': return '📅'
      case 'content_creation': return '✨'
      case 'referral': return '🤝'
      case 'engagement': return '💬'
      default: return '🎁'
    }
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-aura-bg">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-aura-accent to-aura-gold bg-clip-text text-transparent">
              奖励中心
            </span>
          </h1>
          <p className="text-aura-text-secondary">
            参与平台活动，赚取 ORA 代币奖励
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">总奖励</div>
            <div className="text-2xl font-bold text-aura-text">{mockStats.totalEarned} ORA</div>
          </div>
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">本月奖励</div>
            <div className="text-2xl font-bold text-aura-text">{mockStats.thisMonth} ORA</div>
          </div>
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">连续登录</div>
            <div className="text-2xl font-bold text-aura-text">{mockStats.streak} 天</div>
          </div>
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">用户等级</div>
            <div className="text-2xl font-bold text-aura-gold">{mockStats.rank}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-aura-surface rounded-full p-1 mb-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            🎯 可领取奖励 ({mockRewards.filter(r => r.completed).length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            📜 领取历史 ({mockClaimHistory.length})
          </button>
        </div>

        {/* Active Rewards */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {mockRewards.map((reward) => (
              <div
                key={reward.id}
                className={`bg-aura-card border border-aura-border rounded-2xl p-6 ${
                  reward.completed ? 'ring-2 ring-aura-gold/20' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aura-accent to-aura-gold flex items-center justify-center text-2xl">
                      {getRewardIcon(reward.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-aura-text">{reward.title}</h3>
                        {reward.completed && (
                          <span className="text-xs bg-aura-gold/20 text-aura-gold px-2 py-1 rounded-full">
                            可领取
                          </span>
                        )}
                      </div>
                      
                      <p className="text-aura-text-secondary text-sm mb-3">{reward.description}</p>
                      
                      {/* Progress */}
                      {!reward.completed && reward.target && (
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-aura-text-secondary">
                              进度: {reward.progress}/{reward.target}
                            </span>
                            <span className="text-sm text-aura-text-secondary">
                              {Math.round((reward.progress / reward.target) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-aura-surface rounded-full h-2">
                            <div
                              className="h-2 bg-gradient-to-r from-aura-accent to-aura-gold rounded-full transition-all"
                              style={{ width: `${(reward.progress / reward.target) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Streak info */}
                      {reward.type === 'daily_login' && reward.streak !== undefined && (
                        <div className="mb-3">
                          <div className="text-sm text-aura-text-secondary">
                            连续登录 {reward.streak} 天，下次奖励: {reward.nextReward} ORA
                          </div>
                          <div className="w-full bg-aura-surface rounded-full h-2 mt-2">
                            <div
                              className="h-2 bg-gradient-to-r from-aura-accent to-aura-gold rounded-full"
                              style={{ width: `${(reward.streak / reward.maxStreak!) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-aura-text-secondary">
                        <span>奖励: {reward.amount} {reward.token}</span>
                        {reward.interactions && (
                          <span>互动数: {reward.interactions}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {reward.completed && (
                    <button
                      onClick={() => handleClaimReward(reward.id)}
                      disabled={claiming === reward.id}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                        claiming === reward.id
                          ? 'bg-aura-text-secondary/30 cursor-not-allowed text-aura-text-secondary'
                          : 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white hover:shadow-lg'
                      }`}
                    >
                      {claiming === reward.id ? '领取中...' : '🎁 领取奖励'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {mockClaimHistory.map((claim) => (
              <div
                key={claim.id}
                className="bg-aura-card border border-aura-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-aura-surface flex items-center justify-center text-2xl">
                      {getRewardIcon(claim.type)}
                    </div>
                    
                    <div>
                      <div className="font-semibold text-aura-text mb-1">
                        领取了 {claim.amount} {claim.token}
                      </div>
                      <div className="text-sm text-aura-text-secondary">
                        {formatTime(claim.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-aura-gold font-bold">
                      +{claim.amount} {claim.token}
                    </div>
                    <div className="text-xs text-green-400">
                      已到账 ✓
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Card */}
        <div className="mt-8 bg-gradient-to-r from-aura-accent/10 to-aura-gold/10 border border-aura-accent/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3 text-aura-text">💡 奖励说明</h3>
          <div className="text-aura-text-secondary text-sm space-y-2">
            <p>• <strong>每日登录</strong>：连续登录获得递增奖励，最高可达 50 ORA/天</p>
            <p>• <strong>内容创作</strong>：发布优质内容获得平台奖励</p>
            <p>• <strong>邀请好友</strong>：成功邀请新用户注册获得丰厚奖励</p>
            <p>• <strong>社区互动</strong>：活跃参与社区讨论获得额外收益</p>
            <p>• 所有奖励都以 ORA 代币形式发放到您的钱包</p>
          </div>
        </div>
      </div>
    </div>
  )
}