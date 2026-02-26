import { FC, useState, useRef, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { storage } from '../utils/storage'

const mockUserData = {
  username: 'TestUser',
  bio: '热爱创作的 Web3 爱好者',
  avatar: '👤',
  followers: 1234,
  following: 567,
  posts: 89,
  nfts: 23,
  reputation: 4.8,
  joined: '2026-01-15',
  totalEarned: 12567,
  balance: 1234,
  pendingBalance: 567,
  // Reputation SBT data
  reputationSBT: {
    tier: 'Gold', // Bronze, Silver, Gold, Platinum, Diamond
    totalPosts: 89,
    totalEarnings: 12567,
    followersCount: 1234,
    curationScore: 8900,
    joinedAt: '2026-01-15',
    lastUpdated: '2026-02-18',
  }
}

const mockUserPosts = [
  { id: '1', title: '我的作品1', thumbnail: '🎨', likes: 45, views: 123 },
  { id: '2', title: '我的作品2', thumbnail: '📝', likes: 67, views: 234 },
  { id: '3', title: '我的作品3', thumbnail: '🎵', likes: 89, views: 345 },
  { id: '4', title: '我的作品4', thumbnail: '📷', likes: 123, views: 456 },
]

const mockCollections = [
  { id: '1', name: '收藏的艺术', count: 12, thumbnail: '🎨' },
  { id: '2', name: '音乐精选', count: 8, thumbnail: '🎵' },
  { id: '3', name: '教程合集', count: 15, thumbnail: '📚' },
]

// Helper function to get tier color and icon
const getTierInfo = (tier: string) => {
  switch (tier) {
    case 'Diamond':
      return { color: 'from-cyan-400 to-blue-500', icon: '💎', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30' }
    case 'Platinum':
      return { color: 'from-gray-200 to-gray-400', icon: '🏆', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30' }
    case 'Gold':
      return { color: 'from-yellow-400 to-orange-500', icon: '⭐', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' }
    case 'Silver':
      return { color: 'from-gray-300 to-gray-500', icon: '🥈', bgColor: 'bg-gray-400/10', borderColor: 'border-gray-400/30' }
    case 'Bronze':
    default:
      return { color: 'from-orange-700 to-orange-900', icon: '🥉', bgColor: 'bg-orange-700/10', borderColor: 'border-orange-700/30' }
  }
}

export const Profile: FC = () => {
  const { connected, publicKey } = useWallet()
  const { user, isLoggedIn, updateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'posts' | 'collections' | 'nfts' | 'stats' | 'reputation'>('posts')
  const [isEditing, setIsEditing] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const avatarInput = useRef<HTMLInputElement>(null)

  const userPosts = useMemo(() => {
    if (!user) return []
    return storage.getPosts().filter((p: any) => p.authorEmail === user.email)
  }, [user])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      updateProfile({ avatar: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  const startEditing = () => {
    setEditUsername(user?.username || mockUserData.username)
    setEditBio(user?.bio || mockUserData.bio)
    setIsEditing(true)
  }

  const saveEditing = () => {
    updateProfile({ username: editUsername, bio: editBio })
    setIsEditing(false)
  }

  const displayName = user?.username || mockUserData.username
  const displayBio = user?.bio || mockUserData.bio
  const displayAvatar = user?.avatar || mockUserData.avatar
  const displayFollowers = user?.followers ?? mockUserData.followers
  const displayFollowing = user?.following ?? mockUserData.following

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="mb-6">
          {/* Cover Image */}
          <div className="h-32 bg-gradient-aura rounded-t-2xl relative"></div>
          
          {/* Avatar and Info */}
          <div className="bg-white/5 border border-white/10 border-t-0 rounded-b-2xl p-6 -mt-16 relative">
            {/* Avatar */}
            <input type="file" ref={avatarInput} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            <div 
              onClick={() => isLoggedIn && avatarInput.current?.click()}
              className={`w-24 h-24 bg-gradient-aura rounded-full flex items-center justify-center text-5xl mb-4 border-4 border-black relative z-10 overflow-hidden ${isLoggedIn ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              {displayAvatar.startsWith('data:') ? (
                <img src={displayAvatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                displayAvatar
              )}
            </div>

            {/* Name and Bio */}
            {isEditing ? (
              <div className="space-y-2 mb-4 w-full">
                <input
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-bold"
                  placeholder="用户名"
                />
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-300 text-sm resize-none"
                  placeholder="个人简介"
                />
                <div className="flex gap-2">
                  <button onClick={saveEditing} className="flex-1 py-2 bg-gradient-aura rounded-lg text-white text-sm font-semibold">保存</button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-white/10 rounded-lg text-white text-sm">取消</button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-1">{displayName}</h1>
                <p className="text-gray-400 text-sm mb-4">{displayBio || '还没有简介'}</p>
              </>
            )}

            {/* Stats - Clickable */}
            <div className="flex gap-6 mb-4">
              <button onClick={() => navigate('/following')} className="text-left hover:opacity-70 transition-opacity">
                <div className="text-xl font-bold">{displayFollowers}</div>
                <div className="text-xs text-gray-400">粉丝</div>
              </button>
              <button onClick={() => navigate('/following')} className="text-left hover:opacity-70 transition-opacity">
                <div className="text-xl font-bold">{displayFollowing}</div>
                <div className="text-xs text-gray-400">关注</div>
              </button>
              <div>
                <div className="text-xl font-bold">{userPosts.length || mockUserData.posts}</div>
                <div className="text-xs text-gray-400">作品</div>
              </div>
              <div>
                <div className="text-xl font-bold">{mockUserData.reputation}</div>
                <div className="text-xs text-gray-400">信誉分</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={startEditing}
                className="py-2 bg-gradient-aura rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                编辑资料
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-colors"
              >
                💬 消息
              </button>
              {isLoggedIn ? (
                <button
                  onClick={() => { logout(); navigate('/') }}
                  className="py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                >
                  退出登录
                </button>
              ) : (
                <button
                  onClick={() => navigate('/auth')}
                  className="py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-colors"
                >
                  ✉️ 登录
                </button>
              )}
          </div>
        </div>

        {/* Wallet Info */}
        {(connected || isLoggedIn) && (
          <div className="bg-gradient-to-r from-aura-purple/20 to-aura-pink/20 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 mb-1">钱包地址{isLoggedIn && !connected ? '（托管）' : ''}</div>
                <div className="text-sm font-mono">
                  {(publicKey?.toString() || user?.walletAddress || '').slice(0, 8)}...{(publicKey?.toString() || user?.walletAddress || '').slice(-8)}
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publicKey?.toString() || user?.walletAddress || '')
                  alert('✅ 地址已复制')
                }}
                className="px-3 py-1 bg-white/10 rounded text-sm hover:bg-white/20 transition-colors"
              >
                复制
              </button>
            </div>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">可用余额</div>
            <div className="text-xl font-bold text-green-500">{mockUserData.balance}</div>
            <div className="text-xs text-gray-400">$ORA</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">锁定中</div>
            <div className="text-xl font-bold text-yellow-500">{mockUserData.pendingBalance}</div>
            <div className="text-xs text-gray-400">$ORA</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">累计收益</div>
            <div className="text-xl font-bold text-aura-purple">{mockUserData.totalEarned}</div>
            <div className="text-xs text-gray-400">$ORA</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => navigate('/drafts')}
            className="py-3 bg-white/5 border border-white/10 rounded-xl hover:border-aura-purple/50 transition-all flex items-center justify-center gap-2"
          >
            <span>📝</span>
            <span>草稿箱</span>
          </button>
          <button
            onClick={() => alert('浏览历史功能\n\n查看你最近浏览的内容\n\n（开发中）')}
            className="py-3 bg-white/5 border border-white/10 rounded-xl hover:border-aura-purple/50 transition-all flex items-center justify-center gap-2"
          >
            <span>🕒</span>
            <span>浏览历史</span>
          </button>
        </div>

        {/* Reputation SBT Badge */}
        {mockUserData.reputationSBT && (
          <div className={`mb-6 ${getTierInfo(mockUserData.reputationSBT.tier).bgColor} ${getTierInfo(mockUserData.reputationSBT.tier).borderColor} border rounded-xl p-4`}>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 bg-gradient-to-br ${getTierInfo(mockUserData.reputationSBT.tier).color} rounded-full flex items-center justify-center text-3xl`}>
                {getTierInfo(mockUserData.reputationSBT.tier).icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">声誉 SBT</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r ${getTierInfo(mockUserData.reputationSBT.tier).color} text-white`}>
                    {mockUserData.reputationSBT.tier}
                  </span>
                </div>
                <p className="text-sm text-gray-400">灵魂绑定代币 - 不可转让</p>
              </div>
              <button
                onClick={() => setActiveTab('reputation')}
                className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors"
              >
                查看详情
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeTab === 'posts' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            我的作品
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeTab === 'collections' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            收藏
          </button>
          <button
            onClick={() => setActiveTab('nfts')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeTab === 'nfts' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            持有 NFT
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeTab === 'stats' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            数据统计
          </button>
          <button
            onClick={() => setActiveTab('reputation')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeTab === 'reputation' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            声誉 SBT
          </button>
        </div>

        {/* Content */}
        {activeTab === 'posts' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(userPosts.length > 0 ? userPosts : mockUserPosts).map((post: any) => (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`, { state: { post } })}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-aura-purple/50 transition-all cursor-pointer"
              >
                <div className="aspect-square bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 flex items-center justify-center text-5xl overflow-hidden">
                  {post.coverImage && String(post.coverImage).startsWith('data:') ? (
                    <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                  ) : (
                    post.thumbnail || post.coverImage || '📝'
                  )}
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-sm mb-2 line-clamp-1">{post.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>❤️ {post.likes || 0}</span>
                    <span>👁️ {post.views || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="space-y-3">
            {mockCollections.map((collection) => (
              <div
                key={collection.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-aura-purple/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 rounded-xl flex items-center justify-center text-3xl">
                    {collection.thumbnail}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">{collection.name}</h4>
                    <p className="text-sm text-gray-400">{collection.count} 个内容</p>
                  </div>
                  <div className="text-gray-400">→</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'nfts' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-aura-purple/50 transition-all cursor-pointer"
              >
                <div className="aspect-square bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 flex items-center justify-center text-5xl">
                  🖼️
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-sm">NFT #{i}</h4>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📊 收益统计</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">累计收益</span>
                  <span className="text-xl font-bold text-green-500">{mockUserData.totalEarned} $ORA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">本月收益</span>
                  <span className="text-lg font-semibold">234 $ORA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">本周收益</span>
                  <span className="text-lg font-semibold">67 $ORA</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📈 内容数据</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">总浏览量</span>
                  <span className="text-lg font-semibold">12.5K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">总点赞数</span>
                  <span className="text-lg font-semibold">3.4K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">平均互动率</span>
                  <span className="text-lg font-semibold">27.3%</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">🏆 成就</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="text-3xl mb-1">🥇</div>
                  <div className="text-xs text-yellow-500">早期创作者</div>
                </div>
                <div className="text-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <div className="text-3xl mb-1">⭐</div>
                  <div className="text-xs text-purple-500">百赞作品</div>
                </div>
                <div className="text-center p-3 bg-pink-500/10 rounded-lg border border-pink-500/30">
                  <div className="text-3xl mb-1">💎</div>
                  <div className="text-xs text-pink-500">NFT 收藏家</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reputation' && (
          <div className="space-y-4">
            {/* Reputation Tier Display */}
            <div className={`${getTierInfo(mockUserData.reputationSBT.tier).bgColor} ${getTierInfo(mockUserData.reputationSBT.tier).borderColor} border rounded-xl p-6`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-20 h-20 bg-gradient-to-br ${getTierInfo(mockUserData.reputationSBT.tier).color} rounded-full flex items-center justify-center text-5xl`}>
                  {getTierInfo(mockUserData.reputationSBT.tier).icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">{mockUserData.reputationSBT.tier} 等级</h3>
                  <p className="text-sm text-gray-400">灵魂绑定代币 (Soulbound Token)</p>
                </div>
              </div>
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-sm text-gray-300 leading-relaxed">
                  声誉 SBT 是绑定在你钱包的不可转让代币，记录了你在 AURA 平台的创作历程和成就。
                  等级基于你的作品数量、收益、粉丝和策展分数综合计算。
                </p>
              </div>
            </div>

            {/* Creator Statistics */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📊 创作者统计</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">总作品数</div>
                  <div className="text-2xl font-bold">{mockUserData.reputationSBT.totalPosts}</div>
                </div>
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">累计收益</div>
                  <div className="text-2xl font-bold text-green-500">{mockUserData.reputationSBT.totalEarnings} $ORA</div>
                </div>
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">粉丝数量</div>
                  <div className="text-2xl font-bold text-blue-500">{mockUserData.reputationSBT.followersCount}</div>
                </div>
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">策展分数</div>
                  <div className="text-2xl font-bold text-purple-500">{mockUserData.reputationSBT.curationScore}</div>
                </div>
              </div>
            </div>

            {/* Tier Progress */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">🎯 等级进度</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">当前等级</span>
                    <span className="font-semibold">{mockUserData.reputationSBT.tier}</span>
                  </div>
                  <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getTierInfo(mockUserData.reputationSBT.tier).color}`}
                      style={{ width: '65%' }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{mockUserData.reputationSBT.tier}</span>
                    <span>下一级: {mockUserData.reputationSBT.tier === 'Diamond' ? 'MAX' : 'Platinum'}</span>
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-3 text-sm text-gray-300">
                  💡 提示: 继续创作高质量内容、获得更多收益和粉丝来提升你的声誉等级
                </div>
              </div>
            </div>

            {/* Tier Levels Explanation */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">🏅 等级说明</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <span className="text-2xl">💎</span>
                  <div className="flex-1">
                    <div className="font-semibold text-cyan-400">Diamond (钻石)</div>
                    <div className="text-xs text-gray-400">50000+ 综合分数</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-500/10 border border-gray-500/30 rounded-lg">
                  <span className="text-2xl">🏆</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-300">Platinum (铂金)</div>
                    <div className="text-xs text-gray-400">20000-49999 综合分数</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <span className="text-2xl">⭐</span>
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-400">Gold (黄金)</div>
                    <div className="text-xs text-gray-400">5000-19999 综合分数</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-400/10 border border-gray-400/30 rounded-lg">
                  <span className="text-2xl">🥈</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-400">Silver (白银)</div>
                    <div className="text-xs text-gray-400">1000-4999 综合分数</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-700/10 border border-orange-700/30 rounded-lg">
                  <span className="text-2xl">🥉</span>
                  <div className="flex-1">
                    <div className="font-semibold text-orange-700">Bronze (青铜)</div>
                    <div className="text-xs text-gray-400">0-999 综合分数</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📅 时间线</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">加入时间</span>
                  <span className="font-semibold">{mockUserData.reputationSBT.joinedAt}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">最后更新</span>
                  <span className="font-semibold">{mockUserData.reputationSBT.lastUpdated}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">活跃天数</span>
                  <span className="font-semibold">34 天</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
