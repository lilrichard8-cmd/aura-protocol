import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const mockMiningData = {
  userHashPower: 1250,
  totalHashPower: 45678,
  userShare: 2.74,
  dailyReward: 2252,
  monthlyProjection: 67560,
  rank: 15,
}

const mockLeaderboard = [
  { rank: 1, user: 'TopMiner.sol', hashpower: 8900, share: 19.5, reward: 16027, avatar: '👑' },
  { rank: 2, user: 'ProPromoter.sol', hashpower: 5600, share: 12.3, reward: 10109, avatar: '🚀' },
  { rank: 3, user: 'GrowthHacker.sol', hashpower: 4200, share: 9.2, reward: 7561, avatar: '📈' },
  { rank: 4, user: 'Influencer.sol', hashpower: 3400, share: 7.4, reward: 6082, avatar: '⭐' },
  { rank: 5, user: 'Promoter.sol', hashpower: 2800, share: 6.1, reward: 5013, avatar: '🎯' },
]

const mockUserReferrals = [
  { id: '1', user: 'User1.sol', type: 'register', hashpower: 1, reward: 23, date: '2小时前' },
  { id: '2', user: 'Creator2.sol', type: 'creator', hashpower: 20, reward: 460, date: '5小时前' },
  { id: '3', user: 'User3.sol', type: 'purchase', hashpower: 5, reward: 115, date: '1天前' },
  { id: '4', user: 'User4.sol', type: 'active', hashpower: 3, reward: 69, date: '2天前' },
]

export const Mining: FC = () => {
  const navigate = useNavigate()
  const [showGuide, setShowGuide] = useState(false)

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
              邀请计划
            </span>
          </h1>
          <p className="text-gray-400">
            邀请好友加入AURA，每日分享82,191 $ORA奖励池，持续365天
          </p>
        </div>

        {/* Mining Pool Info */}
        <div className="bg-gradient-aura rounded-2xl p-8 mb-6 relative overflow-hidden">
          <div className="relative z-10 text-center text-white">
            <h2 className="text-3xl font-bold mb-6">🎁 邀请奖励池</h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-4xl font-bold mb-2">3000万</div>
                <div className="opacity-90">总矿池</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">82,191</div>
                <div className="opacity-90">每日释放</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">365天</div>
                <div className="opacity-90">持续时间</div>
              </div>
            </div>
            <div className="mt-6 text-sm opacity-80">
              开始时间：2026-02-15 | 结束时间：2027-02-14
            </div>
          </div>
          <div className="absolute inset-0 bg-white/10 blur-3xl"></div>
        </div>

        {/* User Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Left: Stats */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">📊 你的邀请数据</h3>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400">你的贡献值</span>
                <span className="text-2xl font-bold text-aura-purple">{mockMiningData.userHashPower.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400">全网贡献值</span>
                <span className="text-xl font-semibold">{mockMiningData.totalHashPower.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400">占比</span>
                <span className="text-xl font-bold text-green-500">{mockMiningData.userShare}%</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <span className="text-green-400">今日收益</span>
                <span className="text-2xl font-bold text-green-400">{mockMiningData.dailyReward.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <span className="text-blue-400">月度预测</span>
                <span className="text-2xl font-bold text-blue-400">{mockMiningData.monthlyProjection.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <span className="text-purple-400">当前排名</span>
                <span className="text-2xl font-bold text-purple-400">#{mockMiningData.rank}</span>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(true)}
              className="w-full mt-6 py-3 bg-gradient-aura rounded-xl text-white font-semibold hover:opacity-90"
            >
              如何提升贡献值？
            </button>
          </div>

          {/* Right: Hashpower Breakdown */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">⚡ 贡献值构成</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <div className="font-semibold">注册用户</div>
                  <div className="text-xs text-gray-400">1贡献值/人</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-blue-400">450</div>
                  <div className="text-xs text-gray-400">450贡献值</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <div className="font-semibold">购买用户</div>
                  <div className="text-xs text-gray-400">5贡献值/人</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-400">80</div>
                  <div className="text-xs text-gray-400">400贡献值</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <div className="font-semibold">成为创作者</div>
                  <div className="text-xs text-gray-400">20贡献值/人</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-purple-400">12</div>
                  <div className="text-xs text-gray-400">240贡献值</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <div className="font-semibold">活跃用户</div>
                  <div className="text-xs text-gray-400">3贡献值/人（7日留存）</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-orange-400">50</div>
                  <div className="text-xs text-gray-400">150贡献值</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-aura/20 border border-aura-purple/30 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="font-bold">总贡献值</span>
                <span className="text-3xl font-bold">{mockMiningData.userHashPower}</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-400 text-center">
              💡 贡献值越高，每日收益越多
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">🏅 邀请排行榜</h3>
            <div className="text-sm text-gray-400">
              Top 1 额外奖励：<span className="text-yellow-500 font-bold">50万 $ORA</span>/月
            </div>
          </div>

          <div className="space-y-3">
            {mockLeaderboard.map((miner) => (
              <div
                key={miner.rank}
                className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                  miner.rank === 1 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                  miner.rank === 2 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                  miner.rank === 3 ? 'bg-gradient-to-br from-orange-600 to-orange-700' :
                  'bg-white/10'
                }`}>
                  {miner.rank <= 3 ? miner.avatar : `#${miner.rank}`}
                </div>

                <div className="flex-1">
                  <div className="font-semibold">{miner.user}</div>
                  <div className="text-sm text-gray-400">
                    贡献值 {miner.hashpower.toLocaleString()} · 占比 {miner.share}%
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-400">今日收益</div>
                  <div className="text-lg font-bold text-green-400">
                    {miner.reward.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
            <div className="text-yellow-500 font-semibold mb-2">🎁 月度额外奖励</div>
            <div className="text-sm text-gray-300">
              Top 1: 50万 | Top 2-5: 20万 | Top 6-10: 10万 | Top 11-50: 2万
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4">📊 我的邀请记录</h3>
          
          <div className="space-y-3">
            {mockUserReferrals.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    ref.type === 'creator' ? 'bg-purple-500/20 text-purple-400' :
                    ref.type === 'purchase' ? 'bg-green-500/20 text-green-400' :
                    ref.type === 'active' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {ref.type === 'creator' ? '🎨 创作者' :
                     ref.type === 'purchase' ? '💰 购买' :
                     ref.type === 'active' ? '⚡ 活跃' :
                     '📝 注册'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{ref.user}</div>
                    <div className="text-xs text-gray-400">{ref.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">算力 +{ref.hashpower}</div>
                  <div className="font-bold text-green-400">+{ref.reward} $ORA</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <button className="text-sm text-gray-400 hover:text-white transition-colors">
              查看全部记录 →
            </button>
          </div>
        </div>

        {/* Guide Modal */}
        {showGuide && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl p-8 max-w-2xl w-full border border-white/10">
              <h2 className="text-3xl font-bold mb-6">📚 邀请计划指南</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-purple-400">⚡ 如何获得贡献值？</h3>
                  <div className="space-y-2 text-gray-300">
                    <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                      <span>邀请用户注册</span>
                      <span className="font-bold text-blue-400">+1 贡献值</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                      <span>邀请的用户购买内容</span>
                      <span className="font-bold text-green-400">+5 贡献值</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                      <span>邀请的用户成为创作者</span>
                      <span className="font-bold text-purple-400">+20 贡献值</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                      <span>邀请的用户保持活跃</span>
                      <span className="font-bold text-orange-400">+3 贡献值</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3 text-pink-400">🎯 如何邀请好友？</h3>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li>• 在YouTube/TikTok发布介绍视频，添加你的邀请链接</li>
                    <li>• 在Twitter/Instagram分享你的使用体验</li>
                    <li>• 在Discord/Telegram社群分享</li>
                    <li>• 线下活动推荐给朋友</li>
                    <li>• 制作教程帮助新用户上手</li>
                  </ul>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <p className="text-yellow-500 font-semibold mb-2">💡 专业提示：</p>
                  <p className="text-sm text-gray-300">
                    专注邀请真实用户。10个高质量用户（成为创作者、购买内容）比100个僵尸注册更有价值。
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowGuide(false)}
                className="w-full mt-6 py-3 bg-gradient-aura rounded-xl text-white font-bold hover:opacity-90"
              >
                开始邀请
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
