import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockPosts } from '../data/mockPosts'

export const ExploreV2: FC = () => {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const filters = [
    { value: 'all', label: '全部' },
    { value: 'image', label: '图片' },
    { value: 'video', label: '视频' },
    { value: 'audio', label: '音频' },
    { value: 'text', label: '文本' },
  ]

  const filteredPosts = mockPosts.filter(post => {
    if (filter === 'all') return true
    return post.type === filter
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation - Patreon style */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button 
                onClick={() => navigate('/v2')}
                className="text-2xl font-bold text-gray-900"
              >
                AURA
              </button>
              <div className="hidden md:flex gap-6">
                <button className="text-gray-900 font-semibold">探索</button>
                <button onClick={() => navigate('/v2/create')} className="text-gray-600 hover:text-gray-900">创作</button>
                <button className="text-gray-600 hover:text-gray-900">市场</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-700 font-semibold">登录</button>
              <button className="px-6 py-2 bg-[#FF424D] text-white font-semibold rounded-full hover:bg-[#E5222E]">
                注册
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">探索创作者</h1>
          <p className="text-xl text-gray-600">发现你喜欢的内容和创作者</p>
        </div>

        {/* Search and Filters - Patreon style */}
        <div className="mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <input
              type="text"
              placeholder="搜索创作者、内容..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF424D] focus:border-transparent text-gray-900"
            />
            
            <div className="flex gap-2 mt-4">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    filter === f.value
                      ? 'bg-[#FF424D] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Grid - Patreon style cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {filteredPosts.slice(0, 12).map((post) => (
            <div
              key={post.id}
              onClick={() => navigate(`/v2/post/${post.id}`, { state: { post } })}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
            >
              {/* Cover Image */}
              <div className={`aspect-video bg-gradient-to-br ${post.coverColor} flex items-center justify-center relative`}>
                <div className="text-7xl">{String(post.coverImage)}</div>
                
                {/* Price Badge */}
                {post.price > 0 && (
                  <div className="absolute top-4 right-4 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-full font-bold text-gray-900">
                    {post.price} $ORA
                  </div>
                )}
              </div>

              {/* Content Info */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {String(post.title)}
                </h3>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{post.authorAvatar}</span>
                  <span className="text-gray-600 font-medium">@{post.author}</span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>❤️ {post.likes.toLocaleString()}</span>
                  <span>👁️ {post.views.toLocaleString()}</span>
                  <span>💬 {post.comments}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-12">
          <button className="px-8 py-3 bg-white border-2 border-gray-200 rounded-full font-semibold text-gray-700 hover:border-gray-300 hover:shadow-md transition-all">
            加载更多
          </button>
        </div>
      </div>
    </div>
  )
}
