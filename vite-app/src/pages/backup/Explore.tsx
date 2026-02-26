import { FC, useState } from 'react'

// Mock data for demonstration
const mockPosts = [
  {
    id: '1',
    title: '我的第一个 NFT 艺术品',
    author: 'Alice.sol',
    description: '这是我在 AURA 上发布的第一个数字艺术作品',
    type: 'image',
    price: 10,
    likes: 42,
    views: 156,
    thumbnail: '🎨',
  },
  {
    id: '2',
    title: '关于去中心化的思考',
    author: 'Bob.sol',
    description: 'Web3 如何改变内容创作的未来',
    type: 'text',
    price: 0,
    likes: 87,
    views: 234,
    thumbnail: '📝',
  },
  {
    id: '3',
    title: '音乐创作：夏日之歌',
    author: 'Charlie.sol',
    description: '原创音乐作品，完全链上',
    type: 'audio',
    price: 5,
    likes: 65,
    views: 189,
    thumbnail: '🎵',
  },
  {
    id: '4',
    title: 'Solana 开发教程',
    author: 'Dev.sol',
    description: '从零开始学习 Solana 智能合约开发',
    type: 'video',
    price: 15,
    likes: 123,
    views: 456,
    thumbnail: '🎬',
  },
  {
    id: '5',
    title: '摄影作品集',
    author: 'Photographer.sol',
    description: '用镜头记录美好瞬间',
    type: 'image',
    price: 20,
    likes: 98,
    views: 312,
    thumbnail: '📷',
  },
  {
    id: '6',
    title: 'DAO 治理提案',
    author: 'Governance.sol',
    description: '关于平台发展的重要提案',
    type: 'text',
    price: 0,
    likes: 234,
    views: 567,
    thumbnail: '🗳️',
  },
]

export const Explore: FC = () => {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('latest')

  const filteredPosts = mockPosts.filter(post => {
    if (filter === 'all') return true
    return post.type === filter
  })

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sort === 'popular') return b.likes - a.likes
    if (sort === 'views') return b.views - a.views
    return 0 // latest (default order)
  })

  return (
    <div className="min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            探索内容
          </span>
        </h1>
        <p className="text-gray-400 mb-12">
          发现来自全球创作者的优质内容
        </p>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('text')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'text'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              📝 文本
            </button>
            <button
              onClick={() => setFilter('image')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'image'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              🎨 图片
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'video'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              🎬 视频
            </button>
            <button
              onClick={() => setFilter('audio')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'audio'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              🎵 音频
            </button>
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
          >
            <option value="latest">最新</option>
            <option value="popular">最热门</option>
            <option value="views">最多浏览</option>
          </select>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-aura-purple/50 transition-all hover:scale-105 cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 flex items-center justify-center text-6xl">
                {post.thumbnail}
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">@{post.author}</span>
                  {post.price > 0 && (
                    <span className="px-2 py-1 bg-aura-orange/20 text-aura-orange text-xs rounded">
                      {post.price} $ORA
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-semibold mb-2 line-clamp-1">
                  {post.title}
                </h3>

                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {post.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <span>❤️</span>
                    <span>{post.likes}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>👁️</span>
                    <span>{post.views}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button 
                  onClick={() => {
                    const message = `📄 内容详情（测试模式）

📌 标题：${post.title}
👤 作者：@${post.author}
📝 描述：${post.description}
📁 类型：${post.type}
${post.price > 0 ? `💰 价格：${post.price} $ORA\n` : '🆓 免费内容\n'}❤️ 点赞：${post.likes}
👁️ 浏览：${post.views}

${post.price > 0 ? '💡 实际购买需要连接钱包并支付 $ORA 代币' : '💡 在实际版本中，这里会显示完整内容'}`
                    alert(message)
                  }}
                  className="w-full mt-4 px-4 py-2 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90 transition-opacity">
                  {post.price > 0 ? '购买查看' : '查看详情'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {sortedPosts.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-semibold mb-2">没有找到内容</h2>
            <p className="text-gray-400">尝试调整筛选条件</p>
          </div>
        )}

        {/* Load More */}
        {sortedPosts.length > 0 && (
          <div className="text-center mt-12">
            <button className="px-8 py-3 bg-white/10 rounded-lg text-white font-semibold hover:bg-white/20 transition-colors border border-white/20">
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
