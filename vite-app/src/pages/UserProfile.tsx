import { FC, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

// 模拟用户数据（后续从API获取）
const mockUserData: any = {
  'Alice.sol': {
    username: 'Alice.sol',
    displayName: 'Alice Chen',
    bio: '数字艺术创作者 | NFT艺术家 | Web3爱好者',
    avatar: '👩‍🎨',
    followers: 15234,
    following: 892,
    posts: 156,
    reputation: 4.9,
    joined: '2026-01-15',
    isFollowing: false,
  },
  'Bob.sol': {
    username: 'Bob.sol',
    displayName: 'Bob Johnson',
    bio: 'Web3开发者 | Solana生态贡献者',
    avatar: '🧑‍💻',
    followers: 8901,
    following: 567,
    posts: 89,
    reputation: 4.7,
    joined: '2026-01-20',
    isFollowing: true,
  },
  // 默认数据
  default: {
    username: 'Unknown',
    displayName: '神秘创作者',
    bio: '这个用户很神秘，什么都没留下...',
    avatar: '👤',
    followers: 0,
    following: 0,
    posts: 0,
    reputation: 5.0,
    joined: '2026-01-01',
    isFollowing: false,
  },
}

const mockUserPosts = [
  { id: '1', title: '数字艺术作品', thumbnail: '🎨', likes: 234, views: 1567 },
  { id: '2', title: '摄影：城市之光', thumbnail: '📷', likes: 189, views: 1234 },
  { id: '3', title: 'NFT系列发布', thumbnail: '🖼️', likes: 456, views: 2345 },
  { id: '4', title: '创作心得分享', thumbnail: '📝', likes: 123, views: 890 },
  { id: '5', title: '音乐作品', thumbnail: '🎵', likes: 345, views: 1678 },
  { id: '6', title: '视频教程', thumbnail: '🎬', likes: 567, views: 3456 },
]

export const UserProfile: FC = () => {
  const { username } = useParams()
  const navigate = useNavigate()
  
  const userData = mockUserData[username || ''] || mockUserData.default
  const [activeTab, setActiveTab] = useState<'posts' | 'nfts' | 'collections'>('posts')
  const [isFollowing, setIsFollowing] = useState(userData.isFollowing)

  const handleFollow = () => {
    setIsFollowing(!isFollowing)
    alert(isFollowing ? `已取消关注 @${userData.username}` : `已关注 @${userData.username}`)
  }

  const handleMessage = () => {
    navigate('/messages', { state: { startConversation: userData.username } })
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        {/* Profile Header */}
        <div className="mb-6">
          {/* Cover */}
          <div className="h-40 bg-gradient-aura rounded-t-2xl"></div>
          
          {/* Profile Info */}
          <div className="bg-white/5 border border-white/10 border-t-0 rounded-b-2xl p-6 -mt-20 relative">
            {/* Avatar */}
            <div className="w-32 h-32 bg-gradient-aura rounded-full flex items-center justify-center text-6xl mb-4 border-4 border-black relative z-10">
              {userData.avatar}
            </div>

            {/* Name and Bio */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold mb-1">{userData.displayName}</h1>
              <p className="text-gray-400 mb-1">@{userData.username}</p>
              <p className="text-gray-300 text-sm">{userData.bio}</p>
            </div>

            {/* Stats */}
            <div className="flex gap-8 mb-6">
              <button 
                onClick={() => navigate('/following')}
                className="hover:opacity-70 transition-opacity"
              >
                <div className="text-2xl font-bold">{userData.followers.toLocaleString()}</div>
                <div className="text-sm text-gray-400">粉丝</div>
              </button>
              <button 
                onClick={() => navigate('/following')}
                className="hover:opacity-70 transition-opacity"
              >
                <div className="text-2xl font-bold">{userData.following.toLocaleString()}</div>
                <div className="text-sm text-gray-400">关注</div>
              </button>
              <div>
                <div className="text-2xl font-bold">{userData.posts}</div>
                <div className="text-sm text-gray-400">作品</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{userData.reputation}</div>
                <div className="text-sm text-gray-400">信誉</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleFollow}
                className={`py-3 rounded-xl font-semibold transition-all ${
                  isFollowing
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-gradient-aura text-white hover:opacity-90'
                }`}
              >
                {isFollowing ? '已关注' : '+ 关注'}
              </button>
              <button
                onClick={handleMessage}
                className="py-3 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-colors"
              >
                💬 私信
              </button>
              <button
                onClick={() => alert('打赏功能\n\n支持创作者！\n\n（测试模式）')}
                className="py-3 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-colors"
              >
                💰 打赏
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'posts' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            作品 ({userData.posts})
          </button>
          <button
            onClick={() => setActiveTab('nfts')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'nfts' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            NFT
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'collections' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            收藏
          </button>
        </div>

        {/* Content */}
        {activeTab === 'posts' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {mockUserPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-aura-purple/50 transition-all cursor-pointer hover:scale-105"
              >
                <div className="aspect-square bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 flex items-center justify-center text-6xl">
                  {post.thumbnail}
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-sm mb-2 line-clamp-1">{post.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>❤️ {post.likes}</span>
                    <span>👁️ {post.views}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'nfts' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-gray-400">该用户暂无NFT</p>
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⭐</div>
            <p className="text-gray-400">该用户暂无收藏</p>
          </div>
        )}
      </div>
    </div>
  )
}
