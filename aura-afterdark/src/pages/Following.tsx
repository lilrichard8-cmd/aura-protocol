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
    <div className="min-h-screen pt-6 pb-32 px-4 bg-aura-bg">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-aura-accent to-aura-gold bg-clip-text text-transparent">
              关注
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-aura-accent to-aura-accent-hover rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              📤 导出
            </button>
            <button
              onClick={() => navigate('/search')}
              className="px-4 py-2 bg-aura-surface border border-aura-border rounded-lg text-aura-text-secondary text-sm font-semibold hover:bg-aura-card transition-colors"
            >
              🔍 发现新用户
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-aura-surface rounded-full p-1 mb-6">
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'following'
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            关注中 ({mockFollowing.length})
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'followers'
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            粉丝 ({mockFollowers.length})
          </button>
        </div>

        {/* Following List */}
        {activeTab === 'following' && (
          <div className="space-y-4">
            {mockFollowing.map((user) => (
              <div
                key={user.id}
                className="bg-aura-card border border-aura-border rounded-xl p-5 hover:bg-aura-surface transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-aura-accent to-aura-gold flex items-center justify-center text-2xl cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => navigate(`/profile/${user.username}`)}
                    >
                      {user.avatar}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 
                          className="text-lg font-bold text-aura-text cursor-pointer hover:text-aura-accent transition-colors"
                          onClick={() => navigate(`/profile/${user.username}`)}
                        >
                          {user.username}
                        </h3>
                        {user.isFollowingBack && (
                          <span className="text-xs bg-aura-accent/20 text-aura-accent px-2 py-1 rounded-full">
                            互关
                          </span>
                        )}
                      </div>
                      
                      <p className="text-aura-text-secondary text-sm mb-3">{user.bio}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-aura-text-secondary">
                        <span>{user.followers.toLocaleString()} 粉丝</span>
                        <span>{user.posts} 帖子</span>
                        <span>{user.nftData.totalNFTs} NFT</span>
                      </div>
                      
                      {/* Recent NFTs */}
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-aura-text-secondary">最新：</span>
                        {user.nftData.recentNFTs.map((nft, index) => (
                          <span key={index} className="text-lg">{nft}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/messages?user=${user.username}`)}
                      className="px-3 py-2 bg-aura-surface border border-aura-border rounded-lg text-aura-text-secondary hover:bg-aura-card hover:text-aura-text transition-colors text-sm"
                    >
                      💬 私信
                    </button>
                    <button className="px-4 py-2 bg-aura-accent/20 border border-aura-accent/30 rounded-lg text-aura-accent hover:bg-aura-accent hover:text-white transition-colors text-sm font-semibold">
                      已关注 ✓
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Followers List */}
        {activeTab === 'followers' && (
          <div className="space-y-4">
            {mockFollowers.map((user) => (
              <div
                key={user.id}
                className="bg-aura-card border border-aura-border rounded-xl p-5 hover:bg-aura-surface transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-aura-accent to-aura-gold flex items-center justify-center text-2xl cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => navigate(`/profile/${user.username}`)}
                    >
                      {user.avatar}
                    </div>
                    
                    <div className="flex-1">
                      <h3 
                        className="text-lg font-bold text-aura-text cursor-pointer hover:text-aura-accent transition-colors mb-1"
                        onClick={() => navigate(`/profile/${user.username}`)}
                      >
                        {user.username}
                      </h3>
                      
                      <p className="text-aura-text-secondary text-sm mb-3">{user.bio}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-aura-text-secondary">
                        <span>{user.followers.toLocaleString()} 粉丝</span>
                        <span>{user.posts} 帖子</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/messages?user=${user.username}`)}
                      className="px-3 py-2 bg-aura-surface border border-aura-border rounded-lg text-aura-text-secondary hover:bg-aura-card hover:text-aura-text transition-colors text-sm"
                    >
                      💬 私信
                    </button>
                    <button 
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        user.isFollowing
                          ? 'bg-aura-accent/20 border border-aura-accent/30 text-aura-accent hover:bg-aura-accent hover:text-white'
                          : 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white hover:opacity-90'
                      }`}
                    >
                      {user.isFollowing ? '已关注 ✓' : '➕ 关注'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-aura-bg/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <div className="bg-aura-card border border-aura-border rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4 text-aura-text">导出社交图谱</h3>
              <p className="text-aura-text-secondary text-sm mb-6">
                选择导出格式，导出你的关注和粉丝数据
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleExportSocialGraph('json')}
                  className="w-full p-3 bg-aura-surface border border-aura-border rounded-lg text-left hover:bg-aura-card transition-colors"
                >
                  <div className="font-semibold text-aura-text">JSON 格式</div>
                  <div className="text-xs text-aura-text-secondary">标准数据格式，易于处理</div>
                </button>
                
                <button
                  onClick={() => handleExportSocialGraph('csv')}
                  className="w-full p-3 bg-aura-surface border border-aura-border rounded-lg text-left hover:bg-aura-card transition-colors"
                >
                  <div className="font-semibold text-aura-text">CSV 格式</div>
                  <div className="text-xs text-aura-text-secondary">Excel 表格格式</div>
                </button>
                
                <button
                  onClick={() => handleExportSocialGraph('twitter')}
                  className="w-full p-3 bg-aura-surface border border-aura-border rounded-lg text-left hover:bg-aura-card transition-colors"
                >
                  <div className="font-semibold text-aura-text">同步到 Twitter</div>
                  <div className="text-xs text-aura-text-secondary">导入到 Twitter 关注列表</div>
                </button>
                
                <button
                  onClick={() => handleExportSocialGraph('lens')}
                  className="w-full p-3 bg-aura-surface border border-aura-border rounded-lg text-left hover:bg-aura-card transition-colors"
                >
                  <div className="font-semibold text-aura-text">同步到 Lens</div>
                  <div className="text-xs text-aura-text-secondary">导入到 Lens Protocol</div>
                </button>
              </div>
              
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full mt-4 py-3 bg-aura-surface border border-aura-border rounded-lg text-aura-text-secondary hover:bg-aura-card transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}