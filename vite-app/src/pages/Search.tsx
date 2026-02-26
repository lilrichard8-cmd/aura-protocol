import { FC, useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

// 模拟所有可搜索内容
const allContent = [
  { type: 'user', id: 'Alice.sol', name: 'Alice.sol', displayName: 'Alice Chen', avatar: '👩‍🎨', followers: 15234 },
  { type: 'user', id: 'Bob.sol', name: 'Bob.sol', displayName: 'Bob Johnson', avatar: '🧑‍💻', followers: 8901 },
  { type: 'post', id: '1', title: '数字艺术作品', author: 'Alice.sol', thumbnail: '🎨', likes: 234 },
  { type: 'post', id: '2', title: 'Solana开发教程', author: 'Bob.sol', thumbnail: '📝', likes: 567 },
  { type: 'post', id: '3', title: 'NFT创作指南', author: 'Charlie.sol', thumbnail: '🎨', likes: 345 },
  { type: 'post', id: '4', title: 'Web3音乐制作', author: 'Musician.sol', thumbnail: '🎵', likes: 456 },
]

export const Search: FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') || ''
  
  const [results, setResults] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'posts'>('all')

  useEffect(() => {
    if (query) {
      // 简单的前端搜索（后续替换为后端API）
      const searchResults = allContent.filter(item => {
        const searchText = query.toLowerCase()
        if (item.type === 'user') {
          return item.name?.toLowerCase().includes(searchText) || 
                 item.displayName?.toLowerCase().includes(searchText)
        } else {
          return item.title?.toLowerCase().includes(searchText) ||
                 item.author?.toLowerCase().includes(searchText)
        }
      })
      setResults(searchResults)
    } else {
      setResults([])
    }
  }, [query])

  const filteredResults = results.filter(r => {
    if (activeTab === 'all') return true
    if (activeTab === 'users') return r.type === 'user'
    if (activeTab === 'posts') return r.type === 'post'
    return true
  })

  const userResults = results.filter(r => r.type === 'user')
  const postResults = results.filter(r => r.type === 'post')

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

        {/* Search header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-aura bg-clip-text text-transparent">
              搜索结果
            </span>
          </h1>
          <p className="text-gray-400">
            搜索 "{query}" 找到 {results.length} 个结果
          </p>
        </div>

        {/* Result tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'all' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            全部 ({results.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'users' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            用户 ({userResults.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'posts' ? 'bg-gradient-aura text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            内容 ({postResults.length})
          </button>
        </div>

        {/* Results */}
        {filteredResults.length > 0 ? (
          <div className="space-y-3">
            {filteredResults.map((result) => (
              <div key={result.id}>
                {result.type === 'user' && (
                  <div
                    onClick={() => navigate(`/user/${result.id}`)}
                    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-aura-purple/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-aura rounded-full flex items-center justify-center text-3xl">
                        {result.avatar}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">{result.displayName}</h3>
                        <p className="text-gray-400 text-sm mb-2">@{result.name}</p>
                        <div className="text-sm text-gray-400">
                          👥 {result.followers.toLocaleString()} 粉丝
                        </div>
                      </div>
                      <button className="px-6 py-2 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90">
                        查看
                      </button>
                    </div>
                  </div>
                )}

                {result.type === 'post' && (
                  <div
                    onClick={() => navigate(`/post/${result.id}`)}
                    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-aura-purple/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 rounded-xl flex items-center justify-center text-4xl">
                        {result.thumbnail}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1">{result.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span>@{result.author}</span>
                          <span>❤️ {result.likes}</span>
                        </div>
                      </div>
                      <button className="px-6 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20">
                        查看
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold mb-2">未找到结果</h2>
            <p className="text-gray-400">试试其他关键词</p>
          </div>
        )}
      </div>
    </div>
  )
}
