import { FC, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { SearchFilter } from '../components/SearchFilter'

// Mock data for Creator Coins
const mockCreatorCoins = [
  {
    id: '1',
    creator: 'artist.sol',
    creatorAddress: 'Cre4t0rAddress1111111111111111111111111111',
    symbol: 'ART',
    name: 'Artist Coin',
    avatar: '🎨',
    totalSupply: 10000,
    reserveBalance: 5.2,
    price: 0.0005,
    priceChange24h: 12.5,
    holders: 156,
    volume24h: 23.4,
    curveType: 'Linear',
    creatorFeeBps: 500, // 5%
    description: '支持数字艺术创作',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: '2',
    creator: 'musician.sol',
    creatorAddress: 'Cre4t0rAddress2222222222222222222222222222',
    symbol: 'MUSIC',
    name: 'Musician Coin',
    avatar: '🎵',
    totalSupply: 25000,
    reserveBalance: 12.8,
    price: 0.0008,
    priceChange24h: -5.2,
    holders: 234,
    volume24h: 45.6,
    curveType: 'Quadratic',
    creatorFeeBps: 300,
    description: '独立音乐人代币',
    color: 'from-orange-500 to-red-500',
  },
  {
    id: '3',
    creator: 'writer.sol',
    creatorAddress: 'Cre4t0rAddress3333333333333333333333333333',
    symbol: 'WRITE',
    name: 'Writer Coin',
    avatar: '✍️',
    totalSupply: 15000,
    reserveBalance: 8.5,
    price: 0.0006,
    priceChange24h: 8.3,
    holders: 189,
    volume24h: 34.2,
    curveType: 'Linear',
    creatorFeeBps: 400,
    description: '文学创作者代币',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: '4',
    creator: 'photographer.sol',
    creatorAddress: 'Cre4t0rAddress4444444444444444444444444444',
    symbol: 'PHOTO',
    name: 'Photo Coin',
    avatar: '📷',
    totalSupply: 20000,
    reserveBalance: 15.3,
    price: 0.0009,
    priceChange24h: 18.7,
    holders: 312,
    volume24h: 67.8,
    curveType: 'Quadratic',
    creatorFeeBps: 350,
    description: '摄影师专属代币',
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: '5',
    creator: 'developer.sol',
    creatorAddress: 'Cre4t0rAddress5555555555555555555555555555',
    symbol: 'DEV',
    name: 'Developer Coin',
    avatar: '💻',
    totalSupply: 30000,
    reserveBalance: 22.1,
    price: 0.0012,
    priceChange24h: 25.4,
    holders: 445,
    volume24h: 89.3,
    curveType: 'Cubic',
    creatorFeeBps: 250,
    description: '开发者社区代币',
    color: 'from-green-500 to-teal-500',
  },
  {
    id: '6',
    creator: 'designer.sol',
    creatorAddress: 'Cre4t0rAddress6666666666666666666666666666',
    symbol: 'DESIGN',
    name: 'Designer Coin',
    avatar: '🎨',
    totalSupply: 18000,
    reserveBalance: 10.7,
    price: 0.0007,
    priceChange24h: -2.1,
    holders: 201,
    volume24h: 38.9,
    curveType: 'Linear',
    creatorFeeBps: 450,
    description: 'UI/UX设计师代币',
    color: 'from-indigo-500 to-purple-500',
  },
]

export const CreatorCoin: FC = () => {
  const navigate = useNavigate()
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('volume')
  const [creatorCoins] = useState(mockCreatorCoins)
  const [loading] = useState(false)

  const filters = [
    { value: 'all', label: '🌟 全部' },
    { value: 'trending', label: '🔥 热门' },
    { value: 'new', label: '✨ 新币' },
    { value: 'myholdings', label: '💼 我的持仓' },
  ]

  const sortOptions = [
    { value: 'volume', label: '成交量' },
    { value: 'price', label: '价格' },
    { value: 'holders', label: '持有人数' },
    { value: 'change', label: '涨跌幅' },
  ]

  useEffect(() => {
    // In production, fetch real creator coins from blockchain
    // loadCreatorCoins()
  }, [connection, publicKey])

  const filteredAndSortedCoins = creatorCoins
    .filter((coin) => {
      if (filter === 'all') return true
      if (filter === 'trending') return coin.volume24h > 40
      if (filter === 'new') return parseInt(coin.id) > 4
      if (filter === 'myholdings') return connected // Mock: show all if connected
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume24h - a.volume24h
        case 'price':
          return b.price - a.price
        case 'holders':
          return b.holders - a.holders
        case 'change':
          return b.priceChange24h - a.priceChange24h
        default:
          return 0
      }
    })

  const formatPrice = (price: number) => {
    return price.toFixed(4)
  }

  const formatSOL = (amount: number) => {
    return amount.toFixed(2)
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                <span className="bg-gradient-aura bg-clip-text text-transparent">Creator Coin</span>
              </h1>
              <p className="text-gray-400">发现并投资你喜欢的创作者</p>
            </div>
            <button
              onClick={() => navigate('/create-creator-coin')}
              className="px-6 py-3 bg-gradient-aura text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              ➕ 创建代币
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">总代币数</div>
              <div className="text-2xl font-bold">{creatorCoins.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">总市值</div>
              <div className="text-2xl font-bold">
                {formatSOL(creatorCoins.reduce((sum, c) => sum + c.reserveBalance, 0))} SOL
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">24h成交量</div>
              <div className="text-2xl font-bold">
                {formatSOL(creatorCoins.reduce((sum, c) => sum + c.volume24h, 0))} SOL
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">总持有人</div>
              <div className="text-2xl font-bold">
                {creatorCoins.reduce((sum, c) => sum + c.holders, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <SearchFilter
          filters={filters}
          activeFilter={filter}
          onFilterChange={setFilter}
          placeholder="搜索创作者代币..."
        />

        {/* Sort Options */}
        <div className="flex items-center gap-3 mt-6 mb-6">
          <span className="text-gray-400 text-sm">排序：</span>
          <div className="flex gap-2 flex-wrap">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  sortBy === option.value
                    ? 'bg-gradient-aura text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Creator Coins List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⏳</div>
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : filteredAndSortedCoins.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔍</div>
            <div className="text-gray-400">暂无数据</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedCoins.map((coin) => (
              <div
                key={coin.id}
                onClick={() => navigate(`/creator-coin/${coin.id}`, { state: { coin } })}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:bg-white/10 transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${coin.color} flex items-center justify-center text-3xl flex-shrink-0`}>
                    {coin.avatar}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="text-xl font-bold mb-1 group-hover:text-aura-purple transition-colors">
                          {coin.name} (${coin.symbol})
                        </h3>
                        <p className="text-sm text-gray-400">@{coin.creator}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{formatPrice(coin.price)} SOL</div>
                        <div
                          className={`text-sm font-semibold ${
                            coin.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {coin.priceChange24h >= 0 ? '↗' : '↘'} {Math.abs(coin.priceChange24h)}%
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-400 text-sm mb-3">{coin.description}</p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="bg-white/5 rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-400 mb-1">总供应量</div>
                        <div className="text-sm font-semibold">{coin.totalSupply.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-400 mb-1">储备金</div>
                        <div className="text-sm font-semibold">{formatSOL(coin.reserveBalance)} SOL</div>
                      </div>
                      <div className="bg-white/5 rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-400 mb-1">持有人</div>
                        <div className="text-sm font-semibold">{coin.holders}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-400 mb-1">24h成交量</div>
                        <div className="text-sm font-semibold">{formatSOL(coin.volume24h)} SOL</div>
                      </div>
                      <div className="bg-white/5 rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-400 mb-1">曲线类型</div>
                        <div className="text-sm font-semibold">{coin.curveType}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-gradient-to-r from-aura-purple/10 to-aura-pink/10 border border-aura-purple/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3">💡 什么是 Creator Coin？</h3>
          <div className="text-gray-300 text-sm space-y-2">
            <p>
              Creator Coin 是一种基于联合曲线（Bonding Curve）的创作者代币，允许粉丝投资支持他们喜欢的创作者。
            </p>
            <p>
              • <strong>购买</strong>：价格随着供应量增加而上涨（基于数学曲线）
            </p>
            <p>
              • <strong>出售</strong>：随时可以卖回获得 SOL，价格由曲线决定
            </p>
            <p>
              • <strong>创作者费用</strong>：每笔交易创作者获得一定比例的手续费
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
