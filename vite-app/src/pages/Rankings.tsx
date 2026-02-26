import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// 模拟榜单数据
const mockRankings = {
  popular: [
    { rank: 1, id: '1', title: '数字艺术：赛博朋克城市', author: 'CryptoArtist.sol', avatar: '🎨', score: 15234, reward: 10000 },
    { rank: 2, id: '2', title: 'Solana开发完整教程', author: 'DevMaster.sol', avatar: '👨‍💻', score: 12456, reward: 4000 },
    { rank: 3, id: '3', title: '我的Web3创作之旅', author: 'Creator.sol', avatar: '✍️', score: 9876, reward: 3000 },
    { rank: 4, id: '4', title: '原创音乐：未来之声', author: 'Musician.sol', avatar: '🎵', score: 7654, reward: 2000 },
    { rank: 5, id: '5', title: 'NFT投资指南', author: 'Investor.sol', avatar: '💼', score: 5432, reward: 1000 },
  ],
  discussion: [
    { rank: 1, id: '6', title: 'DAO治理深度讨论', author: 'Thinker.sol', avatar: '🤔', score: 456, reward: 10000 },
    { rank: 2, id: '7', title: '去中心化的未来', author: 'Philosopher.sol', avatar: '📖', score: 389, reward: 4000 },
    { rank: 3, id: '8', title: '创作者经济分析', author: 'Analyst.sol', avatar: '📊', score: 312, reward: 3000 },
    { rank: 4, id: '9', title: 'Web3技术探讨', author: 'TechGuy.sol', avatar: '🔧', score: 267, reward: 2000 },
    { rank: 5, id: '10', title: '平台建议收集', author: 'Community.sol', avatar: '💬', score: 234, reward: 1000 },
  ],
  newcomer: [
    { rank: 1, id: '11', title: '我的AURA第一天', author: 'NewUser1.sol', avatar: '🌟', score: 567, reward: 10000, days: 5 },
    { rank: 2, id: '12', title: '新人的创作之路', author: 'NewUser2.sol', avatar: '🚀', score: 445, reward: 4000, days: 12 },
    { rank: 3, id: '13', title: '从零开始的Web3', author: 'NewUser3.sol', avatar: '💡', score: 389, reward: 3000, days: 18 },
    { rank: 4, id: '14', title: '我为什么选择AURA', author: 'NewUser4.sol', avatar: '✨', score: 312, reward: 2000, days: 25 },
    { rank: 5, id: '15', title: '新人教程分享', author: 'NewUser5.sol', avatar: '📚', score: 278, reward: 1000, days: 29 },
  ],
  commercial: [
    { rank: 1, id: '16', title: 'VIP教程：DeFi完全指南', author: 'Educator.sol', avatar: '👨‍🏫', score: 25600, reward: 10000, revenue: '256 SOL' },
    { rank: 2, id: '17', title: '独家摄影作品集', author: 'Photo.sol', avatar: '📷', score: 18900, reward: 4000, revenue: '189 SOL' },
    { rank: 3, id: '18', title: '专业设计教程', author: 'Designer.sol', avatar: '🎨', score: 15200, reward: 3000, revenue: '152 SOL' },
    { rank: 4, id: '19', title: '音乐制作秘籍', author: 'Producer.sol', avatar: '🎹', score: 12800, reward: 2000, revenue: '128 SOL' },
    { rank: 5, id: '20', title: '编程实战课程', author: 'Coder.sol', avatar: '💻', score: 9500, reward: 1000, revenue: '95 SOL' },
  ],
  editorial: [
    { rank: 1, id: '21', title: '去中心化创作宣言', author: 'Visionary.sol', avatar: '🌈', score: 95, reward: 15000, type: '深度长文' },
    { rank: 2, id: '22', title: '光影艺术：时间的诗', author: 'ArtPoet.sol', avatar: '🎭', score: 92, reward: 6000, type: '视觉艺术' },
    { rank: 3, id: '23', title: '音乐实验：AI与人类', author: 'MusicLab.sol', avatar: '🔬', score: 89, reward: 4000, type: '实验音乐' },
    { rank: 4, id: '24', title: '编程之美', author: 'CodePoet.sol', avatar: '⌨️', score: 87, reward: 3000, type: '技术美学' },
    { rank: 5, id: '25', title: 'Web3社会学研究', author: 'Scholar.sol', avatar: '📚', score: 85, reward: 2000, type: '学术研究' },
  ],
}

const rankingTypes = [
  { id: 'popular', name: '最受欢迎榜', icon: '❤️', description: '点赞+收藏+分享', color: 'from-red-500 to-pink-500' },
  { id: 'discussion', name: '最有讨论榜', icon: '💬', description: '评论数+讨论质量', color: 'from-blue-500 to-cyan-500' },
  { id: 'newcomer', name: '新人突破榜', icon: '🌟', description: '注册<30天专属', color: 'from-yellow-500 to-orange-500' },
  { id: 'commercial', name: '商业价值榜', icon: '💰', description: '本周收益最高', color: 'from-green-500 to-teal-500' },
  { id: 'editorial', name: '编辑精选榜', icon: '⭐', description: '编辑+社区投票', color: 'from-purple-500 to-pink-500' },
]

export const Rankings: FC = () => {
  const navigate = useNavigate()
  const [activeRanking, setActiveRanking] = useState('popular')

  const currentRanking = mockRankings[activeRanking as keyof typeof mockRankings]
  const currentType = rankingTypes.find(t => t.id === activeRanking)!

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-aura bg-clip-text text-transparent">
              周度排行榜
            </span>
          </h1>
          <p className="text-gray-400">
            每周11万 $ORA奖励，5个榜单，人人有机会
          </p>
        </div>

        {/* Stats Banner */}
        <div className="bg-gradient-aura rounded-2xl p-6 mb-6 relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-white">
            <div>
              <div className="text-3xl font-bold mb-1">11万</div>
              <div className="text-sm opacity-90">周总奖励</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-1">5</div>
              <div className="text-sm opacity-90">榜单数</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-1">25</div>
              <div className="text-sm opacity-90">获奖位</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-1">2天</div>
              <div className="text-sm opacity-90">距离结算</div>
            </div>
          </div>
          <div className="absolute inset-0 bg-white/10 blur-3xl"></div>
        </div>

        {/* Ranking Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {rankingTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveRanking(type.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl whitespace-nowrap transition-all ${
                activeRanking === type.id
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <span className="text-xl">{type.icon}</span>
              <span className="font-semibold">{type.name}</span>
            </button>
          ))}
        </div>

        {/* Current Ranking Info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">{currentType.name}</h3>
              <p className="text-sm text-gray-400">{currentType.description}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">本榜奖池</div>
              <div className="text-2xl font-bold bg-gradient-aura bg-clip-text text-transparent">
                {activeRanking === 'editorial' ? '3万' : '2万'} $ORA
              </div>
            </div>
          </div>
        </div>

        {/* Rankings List */}
        <div className="space-y-3">
          {currentRanking.map((item: any) => (
            <div
              key={item.id}
              onClick={() => navigate(`/post/${item.id}`)}
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-aura-purple/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold flex-shrink-0 ${
                  item.rank === 1 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                  item.rank === 2 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                  item.rank === 3 ? 'bg-gradient-to-br from-orange-600 to-orange-700' :
                  'bg-white/10'
                }`}>
                  {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-lg mb-2 truncate">{item.title}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.avatar}</span>
                      <span>@{item.author}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{currentType.icon}</span>
                      <span className="font-semibold text-white">{item.score.toLocaleString()}</span>
                    </div>
                    {item.days && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                        注册{item.days}天
                      </span>
                    )}
                    {item.revenue && (
                      <span className="text-green-400">收益 {item.revenue}</span>
                    )}
                    {item.type && (
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-500 text-xs rounded">
                        {item.type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reward */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-gray-400 mb-1">奖励</div>
                  <div className={`text-2xl font-bold ${
                    item.rank === 1 ? 'text-yellow-500' :
                    item.rank === 2 ? 'text-gray-400' :
                    item.rank === 3 ? 'text-orange-600' :
                    'text-white'
                  }`}>
                    {item.reward.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">$ORA</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How to Participate */}
        <div className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4">🎯 如何上榜？</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-purple-400">✨ 创作优质内容</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• 高质量原创内容</li>
                <li>• 有价值的信息</li>
                <li>• 专业的制作</li>
                <li>• 独特的视角</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-pink-400">🔥 增加互动</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• 引导用户点赞收藏</li>
                <li>• 回复评论互动</li>
                <li>• 社区积极参与</li>
                <li>• 多平台宣传</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <p className="text-sm text-yellow-500 font-semibold mb-2">⚠️ 防刷提示：</p>
            <p className="text-xs text-gray-300">
              我们有严格的防刷机制（AI+人工）。刷量行为将被检测并取消资格，已发Token将被追回。请诚信参与。
            </p>
          </div>
        </div>

        {/* Historical Winners */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4">🏆 历史获奖者</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">👑</div>
              <div className="font-semibold mb-1">上周冠军</div>
              <div className="text-sm text-gray-400">@MasterCreator.sol</div>
              <div className="text-yellow-500 font-bold mt-2">10,000 $ORA</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">🎖️</div>
              <div className="font-semibold mb-1">月度之星</div>
              <div className="text-sm text-gray-400">@MonthlyBest.sol</div>
              <div className="text-purple-500 font-bold mt-2">100,000 $ORA</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">⭐</div>
              <div className="font-semibold mb-1">累计获奖最多</div>
              <div className="text-sm text-gray-400">@TopCreator.sol</div>
              <div className="text-green-500 font-bold mt-2">250,000 $ORA</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
