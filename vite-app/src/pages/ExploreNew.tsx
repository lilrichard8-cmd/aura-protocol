import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchFilter } from '../components/SearchFilter'
import { mockPosts } from '../data/mockPosts'

// 使用导入的100个mock posts
/*
const oldMockPosts = [
  {
    id: '1',
    title: '我的第一个 NFT 艺术品',
    author: 'Alice.sol',
    authorAvatar: '👩‍🎨',
    description: '这是我在 AURA 上发布的第一个数字艺术作品，灵感来自于落日时分的天空色彩。',
    type: 'image',
    coverImage: '🎨',
    coverColor: 'from-purple-500 to-pink-500',
    price: 10,
    isPaid: false,
    isUnlocked: false,
    likes: 42,
    views: 156,
    comments: 23,
    height: 'tall',
    onMarket: true,
  },
  {
    id: '2',
    title: '独家摄影作品：巴黎之夜',
    author: 'Photographer.sol',
    authorAvatar: '📸',
    description: '巴黎街头的深夜，灯光与阴影的完美融合。',
    type: 'image',
    coverImage: '🌃',
    coverColor: 'from-indigo-500 to-purple-500',
    price: 50,
    isPaid: true,
    isUnlocked: false,
    likes: 234,
    views: 567,
    comments: 89,
    height: 'medium',
    onMarket: true,
  },
  {
    id: '3',
    title: '关于去中心化的思考',
    author: 'Bob.sol',
    authorAvatar: '🧑‍💻',
    description: 'Web3 如何改变内容创作的未来',
    type: 'text',
    coverImage: '📝',
    coverColor: 'from-blue-500 to-cyan-500',
    price: 0,
    isPaid: false,
    isUnlocked: true,
    likes: 87,
    views: 234,
    comments: 45,
    height: 'short',
    onMarket: false,
  },
  {
    id: '4',
    title: '音乐创作：夏日之歌',
    author: 'Charlie.sol',
    authorAvatar: '🎼',
    description: '原创音乐作品，完全链上。捕捉夏日午后的慵懒时光，用旋律讲述故事。',
    type: 'audio',
    coverImage: '🎵',
    coverColor: 'from-orange-500 to-red-500',
    price: 5,
    isPaid: false,
    isUnlocked: false,
    likes: 65,
    views: 189,
    comments: 12,
    height: 'medium',
    onMarket: true,
  },
  {
    id: '5',
    title: 'VIP视频教程：Solana开发完整指南',
    author: 'Dev.sol',
    authorAvatar: '👨‍💻',
    description: '从零开始学习 Solana 智能合约开发，包含完整的代码示例和最佳实践。',
    type: 'video',
    coverImage: '🎬',
    coverColor: 'from-green-500 to-teal-500',
    price: 100,
    isPaid: true,
    isUnlocked: false,
    likes: 456,
    views: 1234,
    comments: 123,
    height: 'tall',
    onMarket: true,
  },
  {
    id: '6',
    title: 'DAO 治理提案',
    author: 'Governance.sol',
    authorAvatar: '🏛️',
    description: '关于平台发展的重要提案，让我们一起讨论未来的方向。',
    type: 'text',
    coverImage: '🗳️',
    coverColor: 'from-indigo-500 to-purple-500',
    price: 0,
    isPaid: false,
    isUnlocked: true,
    likes: 234,
    views: 567,
    comments: 89,
    height: 'short',
    onMarket: false,
  },
]
*/

export const ExploreNew: FC = () => {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const exploreFilters = [
    { value: 'all', label: '全部' },
    { value: 'text', label: '📝 文本' },
    { value: 'image', label: '🎨 图片' },
    { value: 'video', label: '🎬 视频' },
    { value: 'audio', label: '🎵 音频' },
  ]

  const filteredPosts = mockPosts.filter(post => {
    if (filter === 'all') return true
    return post.type === filter
  })

  const getHeightClass = (height: string) => {
    switch (height) {
      case 'short':
        return 'h-48'
      case 'medium':
        return 'h-64'
      case 'tall':
        return 'h-80'
      default:
        return 'h-64'
    }
  }

  const viewPostDetail = (post: typeof mockPosts[0]) => {
    if (post.isPaid && !post.isUnlocked) {
      navigate(`/paid-confirm/${post.id}`, { state: { post } })
      return
    }
    navigate(`/post/${post.id}`, { state: { post } })
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">
            <span className="bg-gradient-aura bg-clip-text text-transparent">
              探索内容
            </span>
          </h1>

          {/* Integrated Search and Filter */}
          <SearchFilter
            filters={exploreFilters}
            activeFilter={filter}
            onFilterChange={setFilter}
            placeholder="搜索内容、创作者..."
          />
        </div>

        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="break-inside-avoid mb-4 group"
            >
              <div 
                onClick={() => viewPostDetail(post)}
                className="relative bg-white/5 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
              >
                <div className={`bg-gradient-to-br ${post.coverColor} ${getHeightClass(post.height as string)} flex flex-col items-center justify-center p-6 relative`}>
                  {post.isPaid && !post.isUnlocked && (
                    <div className="absolute top-3 left-3 px-3 py-1.5 bg-yellow-500 rounded-full text-xs font-bold text-white shadow-lg flex items-center gap-1 animate-pulse">
                      <span>💎</span>
                      <span>付费内容</span>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white">
                    {post.type === 'image' && '📷'}
                    {post.type === 'video' && '🎬'}
                    {post.type === 'audio' && '🎵'}
                    {post.type === 'text' && '📝'}
                  </div>

                  {post.type === 'text' ? (
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-white mb-3">{String(post.title)}</h3>
                      <p className="text-white/80 text-sm line-clamp-3">{String(post.description)}</p>
                    </div>
                  ) : (
                    <div className="text-8xl">{String(post.coverImage)}</div>
                  )}

                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                    {/* Top: Author */}
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{post.authorAvatar}</span>
                      <span className="text-white text-sm font-semibold">@{post.author}</span>
                    </div>

                    {/* Middle: Title and Stats */}
                    <div className="flex-1 flex flex-col justify-center">
                      {post.type !== 'text' && (
                        <h3 className="text-white text-base font-bold text-center mb-3 px-2">
                          {String(post.title)}
                        </h3>
                      )}

                      <div className="flex items-center justify-center gap-4 text-white text-sm mb-4">
                        <div className="flex items-center gap-1">
                          <span>❤️</span>
                          <span>{post.likes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>👁️</span>
                          <span>{post.views}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>💬</span>
                          <span>{post.comments}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Action Button */}
                    <div className="w-full">
                      {post.isPaid && !post.isUnlocked ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            viewPostDetail(post)
                          }}
                          className="w-full px-4 py-2 bg-yellow-500 rounded-lg text-white font-bold text-sm hover:bg-yellow-600 transition-colors shadow-lg">
                          💎 {post.price} $ORA 解锁
                        </button>
                      ) : post.onMarket && post.price > 0 ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            viewPostDetail(post)
                          }}
                          className="w-full px-4 py-2 bg-gradient-aura rounded-lg text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                          购买 {post.price} $ORA
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            viewPostDetail(post)
                          }}
                          className="w-full px-4 py-2 bg-white/20 rounded-lg text-white font-semibold text-sm hover:bg-white/30 transition-colors">
                          查看详情
                        </button>
                      )}
                    </div>
                  </div>

                  {post.onMarket && post.price > 0 && !post.isPaid && (
                    <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
                      {post.price} $ORA
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
