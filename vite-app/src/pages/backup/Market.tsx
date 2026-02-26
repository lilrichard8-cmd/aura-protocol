import { FC, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// NFT 商品
const nftItems = [
  {
    id: 'nft-1',
    type: 'nft',
    subtype: 'fixed',
    title: '限量版数字艺术 #001',
    author: 'Artist.sol',
    price: 100,
    thumbnail: '🎨',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'nft-2',
    type: 'nft',
    subtype: 'auction',
    title: '音乐 NFT - 夏日回忆',
    author: 'Musician.sol',
    price: 50,
    thumbnail: '🎵',
    color: 'from-orange-500 to-red-500',
    bids: 12,
    endTime: '2小时后',
  },
  {
    id: 'nft-3',
    type: 'nft',
    subtype: 'fixed',
    title: '摄影作品：日落',
    author: 'Photo.sol',
    price: 75,
    thumbnail: '📷',
    color: 'from-pink-500 to-rose-500',
  },
]

// 盲盒（长条状展示）
const mysteryBoxes = [
  {
    id: 'box-1',
    type: 'mysterybox',
    title: '创世纪艺术盲盒',
    creator: 'AURA.official',
    price: 50,
    total: 100,
    sold: 67,
    thumbnail: '🎁',
    color: 'from-purple-500 to-pink-500',
    featured: true,
  },
  {
    id: 'box-2',
    type: 'mysterybox',
    title: '音乐收藏盲盒',
    creator: 'MusicDAO',
    price: 30,
    total: 200,
    sold: 145,
    thumbnail: '🎁',
    color: 'from-orange-500 to-red-500',
    featured: false,
  },
  {
    id: 'box-3',
    type: 'mysterybox',
    title: '摄影大师盲盒',
    creator: 'PhotoArt',
    price: 80,
    total: 50,
    sold: 12,
    thumbnail: '🎁',
    color: 'from-blue-500 to-cyan-500',
    featured: false,
  },
]

// 悬赏任务（大卡片展示）
const bounties = [
  {
    id: 'bounty-1',
    type: 'bounty',
    title: 'AURA 平台宣传视频制作',
    description: '需要一个3-5分钟的专业宣传视频，展示平台核心功能和优势',
    creator: 'Team.sol',
    creatorAvatar: '🏢',
    reward: 5000,
    deadline: '7天后',
    submissions: 3,
    thumbnail: '🎬',
    color: 'from-green-500 to-teal-500',
  },
  {
    id: 'bounty-2',
    type: 'bounty',
    title: '治理提案文档撰写',
    description: '撰写一份详细的治理规则文档，包含所有委员会职责',
    creator: 'DAO.sol',
    creatorAvatar: '🏛️',
    reward: 1000,
    deadline: '3天后',
    submissions: 8,
    thumbnail: '📝',
    color: 'from-blue-500 to-indigo-500',
  },
]

export const Market: FC = () => {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // 监听鼠标位置
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setShowFilters(e.clientY < 100)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const viewDetail = (item: any) => {
    navigate(`/market/${item.type}/${item.id}`, { state: { item } })
  }

  const shouldShow = (type: string) => {
    return filter === 'all' || filter === type
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-6">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            AURA 市场
          </span>
        </h1>

        {/* Filters - 自动隐藏/显示 */}
        <div 
          className={`transition-all duration-300 overflow-hidden ${
            showFilters ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('nft')}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                filter === 'nft'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              🎨 NFT
            </button>
            <button
              onClick={() => setFilter('mysterybox')}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                filter === 'mysterybox'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              🎁 盲盒
            </button>
            <button
              onClick={() => setFilter('bounty')}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                filter === 'bounty'
                  ? 'bg-gradient-aura text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              💼 悬赏
            </button>
          </div>
        </div>

        {/* Filter hint */}
        {!showFilters && (
          <div className="text-xs text-gray-500 text-center py-2 mb-4">
            💡 移动鼠标到屏幕顶部显示筛选选项
          </div>
        )}

        {/* 悬赏任务区域 - 大卡片，更明显 */}
        {shouldShow('bounty') && bounties.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>💼</span>
              <span>悬赏任务</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-500 text-sm rounded-full">
                {bounties.length} 个进行中
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bounties.map((bounty) => (
                <div
                  key={bounty.id}
                  onClick={() => viewDetail(bounty)}
                  className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border-2 border-green-500/30 rounded-2xl p-6 hover:border-green-500/60 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${bounty.color} rounded-2xl flex items-center justify-center text-3xl shadow-lg`}>
                      {bounty.thumbnail}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 bg-green-500/30 text-green-400 text-xs font-bold rounded-full">
                          💼 悬赏任务
                        </span>
                        <span className="text-xs text-gray-400">⏰ {bounty.deadline}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{bounty.title}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2">{bounty.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{bounty.creatorAvatar}</span>
                      <span className="text-sm text-gray-400">@{bounty.creator}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 mb-1">赏金</div>
                      <div className="text-3xl font-bold text-green-400">{bounty.reward} $ORA</div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-gray-400 text-center">
                    📝 已有 {bounty.submissions} 个提交
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 盲盒区域 - 长条状展示 */}
        {shouldShow('mysterybox') && mysteryBoxes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>🎁</span>
              <span>神秘盲盒</span>
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-500 text-sm rounded-full">
                限时抢购
              </span>
            </h2>
            <div className="space-y-4">
              {mysteryBoxes.map((box) => (
                <div
                  key={box.id}
                  onClick={() => viewDetail(box)}
                  className={`bg-white/5 border ${box.featured ? 'border-yellow-500/50' : 'border-white/10'} rounded-2xl overflow-hidden hover:border-aura-purple/50 transition-all cursor-pointer hover:scale-[1.01]`}
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Left: Visual */}
                    <div className={`md:w-48 h-48 bg-gradient-to-br ${box.color} flex items-center justify-center relative`}>
                      <div className="text-7xl animate-bounce">{box.thumbnail}</div>
                      <div className="absolute inset-0 bg-white/10 blur-2xl animate-pulse"></div>
                      {box.featured && (
                        <div className="absolute top-3 left-3 px-3 py-1 bg-yellow-500 rounded-full text-xs font-bold text-white shadow-lg">
                          ⭐ 热门
                        </div>
                      )}
                    </div>

                    {/* Right: Info */}
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold mb-2">{box.title}</h3>
                          <p className="text-sm text-gray-400 mb-4">by @{box.creator}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400 mb-1">价格</div>
                          <div className="text-3xl font-bold text-yellow-500">{box.price} $ORA</div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                          <span>已售 {box.sold}</span>
                          <span>剩余 {box.total - box.sold}</span>
                          <span>总量 {box.total}</span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                            style={{ width: `${(box.sold / box.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Quick stats */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full">
                          🌟 传说 1%
                        </div>
                        <div className="px-3 py-1 bg-purple-500/10 text-purple-500 rounded-full">
                          💜 史诗 5%
                        </div>
                        <div className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full">
                          💙 稀有 15%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NFT 市场 - 网格展示 */}
        {shouldShow('nft') && nftItems.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>🎨</span>
              <span>NFT 市场</span>
            </h2>
            <div className="grid grid-cols-1 sm:columns-2 lg:columns-3 gap-4">
              {nftItems.map((nft) => (
                <div
                  key={nft.id}
                  onClick={() => viewDetail(nft)}
                  className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-aura-purple/50 transition-all hover:scale-105 cursor-pointer"
                >
                  <div className={`aspect-square bg-gradient-to-br ${nft.color} flex items-center justify-center text-8xl relative`}>
                    {nft.thumbnail}
                    {nft.subtype === 'auction' && (
                      <div className="absolute top-3 right-3 px-3 py-1 bg-red-500 rounded-full text-xs font-bold text-white animate-pulse">
                        🔥 拍卖
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <p className="text-xs text-gray-400 mb-2">@{nft.author}</p>
                    <h3 className="font-semibold mb-3 line-clamp-1">{nft.title}</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-400">{nft.subtype === 'auction' ? '当前出价' : '价格'}</div>
                        <div className="text-xl font-bold text-aura-purple">{nft.price} $ORA</div>
                      </div>
                      {nft.subtype === 'auction' && (
                        <div className="text-right">
                          <div className="text-xs text-gray-400">结束</div>
                          <div className="text-sm font-semibold text-red-500">{nft.endTime}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
