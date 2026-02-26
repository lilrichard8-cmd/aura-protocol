import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const mockFollowing = [
  {
    id: '1',
    username: 'Alice.sol',
    avatar: '👩‍🎨',
    bio: '数字艺术创作者',
    followers: 5678,
    posts: 234,
    isFollowingBack: true, // 互关
    nftData: {
      totalNFTs: 45,
      recentNFTs: ['🎨', '🖼️', '🌟'],
    },
  },
  {
    id: '2',
    username: 'Bob.sol',
    avatar: '🧑‍💻',
    bio: 'Web3 开发者',
    followers: 3421,
    posts: 156,
    isFollowingBack: false, // 单向
    nftData: {
      totalNFTs: 23,
      recentNFTs: ['💻', '⚡', '🔧'],
    },
  },
  {
    id: '3',
    username: 'Charlie.sol',
    avatar: '🎼',
    bio: '音乐制作人',
    followers: 8901,
    posts: 345,
    isFollowingBack: true,
    nftData: {
      totalNFTs: 67,
      recentNFTs: ['🎵', '🎹', '🎸'],
    },
  },
]

const mockFollowers = [
  {
    id: '1',
    username: 'User1.sol',
    avatar: '😊',
    bio: 'AURA 粉丝',
    followers: 123,
    posts: 45,
    isFollowing: true,
  },
  {
    id: '2',
    username: 'User2.sol',
    avatar: '🎉',
    bio: '内容创作者',
    followers: 456,
    posts: 67,
    isFollowing: false,
  },
]

export const Following: FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following')
  const [showExportModal, setShowExportModal] = useState(false)

  const handleExportSocialGraph = (format: 'json' | 'csv' | 'twitter' | 'lens') => {
    const exportData = {
      format,
      following: mockFollowing.map(u => u.username),
      followers: mockFollowers.map(u => u.username),
      timestamp: new Date().toISOString(),
    }
    
    alert(`📤 导出社交图谱 (${format.toUpperCase()})\n\n已导出 ${mockFollowing.length} 个关注和 ${mockFollowers.length} 个粉丝\n\n格式: ${format}\n时间: ${exportData.timestamp}\n\n（测试模式 - 实际会生成文件或同步到目标平台）`)
    setShowExportModal(false)
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-aura bg-clip-text text-transparent">
              关注
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-gradient-aura rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              📤 导出
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Social Graph NFT Info */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🔗</div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">社交图谱 NFT</h3>
              <p className="text-sm text-gray-300 mb-2">
                你的关注列表存储在链上 NFT 中，可以跨平台导出和使用
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>✅ 可导出</span>
                <span>•</span>
                <span>🔄 跨平台同步</span>
                <span>•</span>
                <span>🔒 完全拥有</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-3 rounded-xl font-semibold ${
              activeTab === 'following'
                ? 'bg-gradient-aura text-white'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            关注 ({mockFollowing.length})
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-3 rounded-xl font-semibold ${
              activeTab === 'followers'
                ? 'bg-gradient-aura text-white'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            粉丝 ({mockFollowers.length})
          </button>
        </div>

        {/* Following list */}
        {activeTab === 'following' && (
          <div className="space-y-3">
            {mockFollowing.map((user) => (
              <div
                key={user.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-aura-purple/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-aura rounded-full flex items-center justify-center text-2xl">
                    {user.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{user.username}</span>
                      {user.isFollowingBack && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded">
                          互关
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{user.bio}</p>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>👥 {user.followers} 粉丝</span>
                      <span>📝 {user.posts} 作品</span>
                      <span>🖼️ {user.nftData.totalNFTs} NFTs</span>
                    </div>
                    {/* Recent NFTs Preview */}
                    <div className="flex gap-2 mt-2">
                      {user.nftData.recentNFTs.map((nft, idx) => (
                        <div 
                          key={idx}
                          className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded flex items-center justify-center text-lg"
                        >
                          {nft}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        alert(user.isFollowingBack ? '💬 打开私信\n\n互关用户，可以畅聊' : '💬 发送私信\n\n单向关注，限5条消息')
                      }}
                      className="px-4 py-2 bg-gradient-aura rounded-lg text-white text-sm font-semibold hover:opacity-90"
                    >
                      私信
                    </button>
                    <button
                      onClick={() => alert(`取消关注 @${user.username}`)}
                      className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm hover:bg-white/20"
                    >
                      取关
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Followers list */}
        {activeTab === 'followers' && (
          <div className="space-y-3">
            {mockFollowers.map((user) => (
              <div
                key={user.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-aura-purple/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-aura rounded-full flex items-center justify-center text-2xl">
                    {user.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{user.username}</span>
                      {user.isFollowing && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded">
                          互关
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{user.bio}</p>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>👥 {user.followers} 粉丝</span>
                      <span>📝 {user.posts} 作品</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (user.isFollowing) {
                        alert(`已关注 @${user.username}`)
                      } else {
                        alert(`关注 @${user.username}\n\n关注后可以：\n• 接收动态更新\n• 发送私信（限5条）\n• 互关后畅聊`)
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                      user.isFollowing
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gradient-aura text-white hover:opacity-90'
                    }`}
                  >
                    {user.isFollowing ? '已关注' : '+ 关注'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">导出社交图谱</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-sm text-gray-400">
                  选择导出格式或同步到其他平台
                </p>

                {/* Export as File */}
                <div className="border-t border-white/10 pt-3">
                  <p className="text-xs text-gray-500 mb-2">导出为文件</p>
                  <button
                    onClick={() => handleExportSocialGraph('json')}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:border-blue-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">📄</div>
                      <div className="flex-1">
                        <div className="font-semibold">JSON 格式</div>
                        <div className="text-xs text-gray-400">标准数据格式，易于导入其他应用</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExportSocialGraph('csv')}
                    className="w-full mt-2 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-green-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">📊</div>
                      <div className="flex-1">
                        <div className="font-semibold">CSV 格式</div>
                        <div className="text-xs text-gray-400">表格格式，可用 Excel 打开</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Sync to Platforms */}
                <div className="border-t border-white/10 pt-3">
                  <p className="text-xs text-gray-500 mb-2">同步到其他平台</p>
                  <button
                    onClick={() => handleExportSocialGraph('twitter')}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🐦</div>
                      <div className="flex-1">
                        <div className="font-semibold">Twitter / X</div>
                        <div className="text-xs text-gray-400">同步关注列表到 Twitter</div>
                      </div>
                      <div className="text-xs text-cyan-500">即将支持</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExportSocialGraph('lens')}
                    className="w-full mt-2 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-green-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🌿</div>
                      <div className="flex-1">
                        <div className="font-semibold">Lens Protocol</div>
                        <div className="text-xs text-gray-400">同步到 Lens 社交图谱</div>
                      </div>
                      <div className="text-xs text-green-500">即将支持</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-sm text-gray-300">
                💡 你的社交图谱存储在链上 NFT 中，可以自由导出和在不同平台使用
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
