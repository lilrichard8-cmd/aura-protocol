import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchFilter } from '../components/SearchFilter'

// 所有市场商品混合
const allMarketItems = [
  // NFT
  { id: 'nft-1', type: 'nft', subtype: 'fixed', title: '限量艺术#001', author: 'Artist.sol', price: 100, thumbnail: '🎨', color: 'from-purple-500 to-pink-500', height: 'tall' },
  { id: 'nft-2', type: 'nft', subtype: 'auction', title: '音乐NFT', author: 'Music.sol', price: 50, thumbnail: '🎵', color: 'from-orange-500 to-red-500', bids: 12, endTime: '2h', height: 'medium' },
  { id: 'nft-3', type: 'nft', subtype: 'fixed', title: '摄影:日落', author: 'Photo.sol', price: 75, thumbnail: '📷', color: 'from-pink-500 to-rose-500', height: 'short' },
  { id: 'nft-4', type: 'nft', subtype: 'auction', title: '抽象艺术', author: 'Abstract.sol', price: 120, thumbnail: '🖼️', color: 'from-indigo-500 to-purple-500', bids: 8, endTime: '5h', height: 'tall' },
  { id: 'nft-5', type: 'nft', subtype: 'fixed', title: '数字雕塑', author: 'Sculptor.sol', price: 200, thumbnail: '🗿', color: 'from-cyan-500 to-blue-500', height: 'medium' },
  { id: 'nft-6', type: 'nft', subtype: 'fixed', title: '像素艺术', author: 'Pixel.sol', price: 45, thumbnail: '👾', color: 'from-green-500 to-teal-500', height: 'short' },
  
  // 盲盒
  { id: 'box-1', type: 'box', title: '创世艺术盲盒', creator: 'AURA', price: 50, sold: 67, total: 100, thumbnail: '🎁', color: 'from-purple-500 to-pink-500', height: 'medium' },
  { id: 'box-2', type: 'box', title: '音乐盲盒', creator: 'Music', price: 30, sold: 145, total: 200, thumbnail: '🎁', color: 'from-orange-500 to-red-500', height: 'short' },
  { id: 'box-3', type: 'box', title: '摄影盲盒', creator: 'Photo', price: 80, sold: 12, total: 50, thumbnail: '🎁', color: 'from-blue-500 to-cyan-500', height: 'medium' },
  
  // 悬赏
  { id: 'bounty-1', type: 'bounty', title: '宣传视频制作', creator: 'Team', reward: 5000, deadline: '7天', submissions: 3, thumbnail: '🎬', height: 'medium' },
  { id: 'bounty-2', type: 'bounty', title: '治理文档', creator: 'DAO', reward: 1000, deadline: '3天', submissions: 8, thumbnail: '📝', height: 'short' },
  { id: 'bounty-3', type: 'bounty', title: 'Logo设计', creator: 'Brand', reward: 3000, deadline: '5天', submissions: 15, thumbnail: '🎨', height: 'tall' },
  
  // 更多混合
  { id: 'nft-7', type: 'nft', subtype: 'fixed', title: '3D作品', author: '3D.sol', price: 90, thumbnail: '🎭', color: 'from-violet-500 to-purple-500', height: 'tall' },
  { id: 'box-4', type: 'box', title: '限量盲盒', creator: 'Rare', price: 150, sold: 3, total: 20, thumbnail: '🎁', color: 'from-pink-500 to-red-500', height: 'short' },
  { id: 'nft-8', type: 'nft', subtype: 'fixed', title: '插画集', author: 'Draw.sol', price: 60, thumbnail: '✏️', color: 'from-yellow-500 to-orange-500', height: 'medium' },
  { id: 'bounty-4', type: 'bounty', title: '教程制作', creator: 'Edu', reward: 8000, deadline: '10天', submissions: 5, thumbnail: '📚', height: 'medium' },
]

export const MarketNew: FC = () => {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const marketFilters = [
    { value: 'all', label: '🌟 全部' },
    { value: 'nft', label: '🎨 NFT' },
    { value: 'box', label: '🎁 盲盒' },
    { value: 'bounty', label: '💼 悬赏' },
  ]

  const filteredItems = allMarketItems.filter(item => {
    if (filter === 'all') return true
    return item.type === filter
  })

  const getHeightClass = (height: string) => {
    switch (height) {
      case 'short': return 'h-48'
      case 'medium': return 'h-64'
      case 'tall': return 'h-80'
      default: return 'h-64'
    }
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          <span className="bg-gradient-aura bg-clip-text text-transparent">AURA 市场</span>
        </h1>

        {/* Integrated Search and Filter */}
        <SearchFilter
          filters={marketFilters}
          activeFilter={filter}
          onFilterChange={setFilter}
          placeholder="搜索商品、创作者..."
        />

        {/* 瀑布流布局 - 效仿探索页 */}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 mt-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="break-inside-avoid mb-4 group"
            >
              {/* NFT Card */}
              {item.type === 'nft' && (
                <div
                  onClick={() => navigate(`/market/nft/${item.id}`, { state: { item } })}
                  className="relative bg-white/5 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className={`bg-gradient-to-br ${item.color} ${getHeightClass(item.height)} flex items-center justify-center relative`}>
                    <div className="text-8xl">{item.thumbnail}</div>
                    
                    {item.subtype === 'auction' && (
                      <div className="absolute top-3 right-3 px-3 py-1 bg-red-500 rounded-full text-xs font-bold text-white animate-pulse">
                        🔥 拍卖
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                      <span className="text-white text-sm font-semibold">@{item.author}</span>
                      <h3 className="text-white text-lg font-bold text-center">{item.title}</h3>
                      {item.subtype === 'auction' && (
                        <span className="text-sm text-gray-300">{item.bids} 个出价</span>
                      )}
                    </div>

                    <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
                      {item.price} $ORA
                    </div>
                  </div>
                </div>
              )}

              {/* Mystery Box Card */}
              {item.type === 'box' && (
                <div
                  onClick={() => navigate(`/market/mysterybox/${item.id}`, { state: { item } })}
                  className="relative bg-white/5 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className={`bg-gradient-to-br ${item.color} ${getHeightClass(item.height)} flex items-center justify-center relative`}>
                    <div className="text-8xl animate-bounce">{item.thumbnail}</div>
                    <div className="absolute inset-0 bg-white/10 blur-2xl animate-pulse"></div>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                      <span className="text-white text-sm font-semibold">@{item.creator}</span>
                      <h3 className="text-white text-lg font-bold text-center">{item.title}</h3>
                      <div className="text-sm text-gray-300">
                        {item.sold}/{item.total} 已售
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/50">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                        style={{ width: `${item.sold && item.total ? (item.sold / item.total) * 100 : 0}%` }}
                      ></div>
                    </div>

                    <div className="absolute top-3 right-3 px-3 py-1 bg-yellow-500 rounded-full text-xs font-bold text-white">
                      {item.price} $ORA
                    </div>
                  </div>
                </div>
              )}

              {/* Bounty Card */}
              {item.type === 'bounty' && (
                <div
                  onClick={() => navigate(`/market/bounty/${item.id}`, { state: { item } })}
                  className="relative bg-gradient-to-br from-green-500/10 to-teal-500/10 border-2 border-green-500/30 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-green-500/60"
                >
                  <div className={`${getHeightClass(item.height)} flex flex-col items-center justify-center p-6`}>
                    <div className="text-6xl mb-3">{item.thumbnail}</div>
                    <h3 className="text-lg font-bold text-center mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400 mb-3">@{item.creator}</p>
                    <div className="text-3xl font-bold text-green-400">{item.reward} $ORA</div>
                    <div className="text-xs text-gray-400 mt-2">⏰ {item.deadline} · 📝 {item.submissions} 提交</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
