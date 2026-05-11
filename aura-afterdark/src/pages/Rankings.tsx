import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const mockCreators = [
  {
    id: '1',
    username: 'Scarlett.sol',
    avatar: '💋',
    tier: 'Diamond',
    totalEarnings: 12545.67,
    subscribers: 2156,
    contentCount: 234,
    rating: 4.9,
    bio: '专业摄影师 & 模特',
    specialties: ['摄影', '艺术', 'VIP内容'],
    isVerified: true,
  },
  {
    id: '2',
    username: 'Ruby.sol',
    avatar: '🔥',
    tier: 'Platinum',
    totalEarnings: 8743.21,
    subscribers: 1834,
    contentCount: 189,
    rating: 4.8,
    bio: '艺术创作者',
    specialties: ['直播', '互动', '定制内容'],
    isVerified: true,
  },
  {
    id: '3',
    username: 'Amber.sol',
    avatar: '✨',
    tier: 'Gold',
    totalEarnings: 6321.45,
    subscribers: 1542,
    contentCount: 156,
    rating: 4.7,
    bio: '时尚博主',
    specialties: ['时尚', '生活方式', 'VIP'],
    isVerified: false,
  },
  {
    id: '4',
    username: 'Jade.sol',
    avatar: '💎',
    tier: 'Gold',
    totalEarnings: 5834.12,
    subscribers: 1387,
    contentCount: 142,
    rating: 4.6,
    bio: '舞蹈艺术家',
    specialties: ['舞蹈', '健身', '艺术'],
    isVerified: true,
  },
  {
    id: '5',
    username: 'Pearl.sol',
    avatar: '🌟',
    tier: 'Silver',
    totalEarnings: 4567.89,
    subscribers: 1203,
    contentCount: 123,
    rating: 4.5,
    bio: '音乐制作人',
    specialties: ['音乐', '创作', '互动'],
    isVerified: false,
  },
]

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Diamond': return 'from-blue-400 to-cyan-400'
    case 'Platinum': return 'from-gray-300 to-gray-100'
    case 'Gold': return 'from-yellow-400 to-orange-400'
    case 'Silver': return 'from-gray-400 to-gray-200'
    default: return 'from-aura-accent to-aura-gold'
  }
}

const getTierIcon = (tier: string) => {
  switch (tier) {
    case 'Diamond': return '💎'
    case 'Platinum': return '🏆'
    case 'Gold': return '🥇'
    case 'Silver': return '🥈'
    default: return '⭐'
  }
}

export const Rankings: FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'earnings' | 'subscribers' | 'content' | 'rating'>('earnings')
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'all'>('month')

  const tabs = [
    { value: 'earnings', label: '💰 收益榜', desc: '总收益排名' },
    { value: 'subscribers', label: '👥 订阅榜', desc: '订阅者数量' },
    { value: 'content', label: '📝 产出榜', desc: '内容数量' },
    { value: 'rating', label: '⭐ 评分榜', desc: '用户评分' },
  ]

  const timeFilters = [
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'all', label: '总榜' },
  ]

  const sortedCreators = [...mockCreators].sort((a, b) => {
    switch (activeTab) {
      case 'earnings': return b.totalEarnings - a.totalEarnings
      case 'subscribers': return b.subscribers - a.subscribers
      case 'content': return b.contentCount - a.contentCount
      case 'rating': return b.rating - a.rating
      default: return 0
    }
  })

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return '🥇'
      case 1: return '🥈'
      case 2: return '🥉'
      default: return `#${index + 1}`
    }
  }

  const getStatValue = (creator: any, tab: string) => {
    switch (tab) {
      case 'earnings': return `$${creator.totalEarnings.toLocaleString()}`
      case 'subscribers': return creator.subscribers.toLocaleString()
      case 'content': return creator.contentCount.toString()
      case 'rating': return `${creator.rating}/5.0`
      default: return ''
    }
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-aura-bg">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-aura-accent to-aura-gold bg-clip-text text-transparent">
              创作者排行榜
            </span>
          </h1>
          <p className="text-aura-text-secondary">
            发现 AURA After Dark 平台上最优秀的成人内容创作者
          </p>
        </div>

        {/* Time Filter */}
        <div className="flex justify-center mb-6">
          <div className="flex bg-aura-surface rounded-full p-1">
            {timeFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTimeFilter(filter.value as any)}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  timeFilter === filter.value
                    ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                    : 'text-aura-text-secondary hover:text-aura-text'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`p-4 rounded-xl border transition-all text-center ${
                activeTab === tab.value
                  ? 'bg-aura-accent/10 border-aura-accent/30 text-aura-text'
                  : 'bg-aura-card border-aura-border text-aura-text-secondary hover:bg-aura-surface'
              }`}
            >
              <div className="font-bold mb-1">{tab.label}</div>
              <div className="text-xs text-aura-text-secondary">{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* Rankings List */}
        <div className="space-y-4">
          {sortedCreators.map((creator, index) => (
            <div
              key={creator.id}
              onClick={() => navigate(`/creator/${creator.username}`)}
              className={`bg-aura-card border border-aura-border rounded-2xl p-6 cursor-pointer hover:bg-aura-surface transition-all group relative overflow-hidden ${
                index < 3 ? 'ring-2 ring-aura-gold/20' : ''
              }`}
            >
              {/* Background gradient for top 3 */}
              {index < 3 && (
                <div className="absolute inset-0 bg-gradient-to-r from-aura-gold/5 to-aura-accent/5 opacity-50"></div>
              )}
              
              <div className="flex items-center gap-6 relative">
                {/* Rank */}
                <div className="text-center min-w-[60px]">
                  <div className="text-3xl font-bold mb-1">
                    {getRankIcon(index)}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${getTierColor(creator.tier)}`}>
                    <span className="text-white font-semibold">{creator.tier}</span>
                  </div>
                </div>

                {/* Avatar & Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${getTierColor(creator.tier)} flex items-center justify-center text-3xl`}>
                    {creator.avatar}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-aura-text group-hover:text-aura-accent transition-colors">
                        {creator.username}
                      </h3>
                      {creator.isVerified && (
                        <span className="text-aura-accent">✓</span>
                      )}
                      <span className="text-xl">{getTierIcon(creator.tier)}</span>
                    </div>
                    
                    <p className="text-aura-text-secondary text-sm mb-2">{creator.bio}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {creator.specialties.map((specialty, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-aura-accent/20 text-aura-accent rounded-full"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-aura-text mb-1">
                    {getStatValue(creator, activeTab)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-aura-text-secondary">
                    <div>
                      <div>{creator.subscribers.toLocaleString()}</div>
                      <div>订阅者</div>
                    </div>
                    <div>
                      <div>{creator.contentCount}</div>
                      <div>内容</div>
                    </div>
                    <div>
                      <div>{creator.rating}/5</div>
                      <div>评分</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-gradient-to-r from-aura-accent/10 to-aura-gold/10 border border-aura-accent/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3 text-aura-text">🏆 等级系统说明</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-aura-text-secondary">
            <div>
              <strong className="text-aura-text">💎 Diamond:</strong> 月收益 $10,000+，超过1000订阅者
            </div>
            <div>
              <strong className="text-aura-text">🏆 Platinum:</strong> 月收益 $5,000+，超过500订阅者
            </div>
            <div>
              <strong className="text-aura-text">🥇 Gold:</strong> 月收益 $1,000+，超过200订阅者
            </div>
            <div>
              <strong className="text-aura-text">🥈 Silver:</strong> 月收益 $500+，超过100订阅者
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}