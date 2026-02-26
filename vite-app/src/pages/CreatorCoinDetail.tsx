import { FC, useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'

// Mock transaction history
const mockTransactions = [
  { id: '1', type: 'buy', user: 'user1.sol', amount: 100, price: 0.0005, total: 0.05, time: '2分钟前' },
  { id: '2', type: 'sell', user: 'user2.sol', amount: 50, price: 0.0005, total: 0.025, time: '5分钟前' },
  { id: '3', type: 'buy', user: 'user3.sol', amount: 200, price: 0.0004, total: 0.08, time: '15分钟前' },
  { id: '4', type: 'buy', user: 'user4.sol', amount: 150, price: 0.0004, total: 0.06, time: '30分钟前' },
  { id: '5', type: 'sell', user: 'user5.sol', amount: 75, price: 0.0004, total: 0.03, time: '1小时前' },
]

// Mock price history for chart
const mockPriceHistory = [
  { time: '00:00', price: 0.0003 },
  { time: '04:00', price: 0.00035 },
  { time: '08:00', price: 0.0004 },
  { time: '12:00', price: 0.00045 },
  { time: '16:00', price: 0.00048 },
  { time: '20:00', price: 0.0005 },
]

export const CreatorCoinDetail: FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { connected } = useWallet()

  const [coin] = useState(location.state?.coin)
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [estimatedPrice, setEstimatedPrice] = useState(0)
  const [myHoldings, setMyHoldings] = useState(250) // Mock holdings
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!coin && id) {
      // In production, fetch coin data from blockchain
      // loadCoinData(id)
    }
  }, [id, coin])

  useEffect(() => {
    // Calculate estimated price based on amount
    if (amount && !isNaN(Number(amount))) {
      const amt = Number(amount)
      // Simple estimation - in production use actual bonding curve calculation
      const basePrice = coin?.price || 0.0005
      setEstimatedPrice(amt * basePrice * (activeTab === 'buy' ? 1.01 : 0.99))
    } else {
      setEstimatedPrice(0)
    }
  }, [amount, activeTab, coin])

  const handleTrade = async () => {
    if (!connected) {
      alert('请先连接钱包')
      return
    }

    if (!amount || Number(amount) <= 0) {
      alert('请输入有效金额')
      return
    }

    if (activeTab === 'sell' && Number(amount) > myHoldings) {
      alert('持仓不足')
      return
    }

    setLoading(true)
    try {
      // In production, call SDK to execute trade
      // if (activeTab === 'buy') {
      //   await sdk.creatorCoin.buy({ creatorAddress, amount: Number(amount) })
      // } else {
      //   await sdk.creatorCoin.sell({ creatorAddress, amount: Number(amount) })
      // }
      
      // Mock success
      await new Promise(resolve => setTimeout(resolve, 1500))
      alert(`${activeTab === 'buy' ? '购买' : '卖出'}成功！`)
      setAmount('')
      
      // Update holdings
      if (activeTab === 'buy') {
        setMyHoldings(prev => prev + Number(amount))
      } else {
        setMyHoldings(prev => prev - Number(amount))
      }
    } catch (error) {
      console.error('Trade error:', error)
      alert('交易失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (!coin) {
    return (
      <div className="min-h-screen pt-6 pb-32 px-4 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-gray-400">代币不存在</div>
          <button
            onClick={() => navigate('/creator-coin')}
            className="mt-4 px-6 py-2 bg-white/5 rounded-lg hover:bg-white/10"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/creator-coin')}
          className="mb-6 px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          ← 返回
        </button>

        {/* Header */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${coin.color} flex items-center justify-center text-4xl flex-shrink-0`}>
              {coin.avatar}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">
                {coin.name} <span className="text-gray-400">(${coin.symbol})</span>
              </h1>
              <p className="text-gray-400 mb-3">@{coin.creator}</p>
              <p className="text-gray-300">{coin.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold mb-1">{coin.price.toFixed(4)} SOL</div>
              <div
                className={`text-lg font-semibold ${
                  coin.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {coin.priceChange24h >= 0 ? '↗' : '↘'} {Math.abs(coin.priceChange24h)}%
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Stats & Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">市值</div>
                <div className="text-xl font-bold">{coin.reserveBalance.toFixed(2)} SOL</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">24h成交量</div>
                <div className="text-xl font-bold">{coin.volume24h.toFixed(2)} SOL</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">持有人</div>
                <div className="text-xl font-bold">{coin.holders}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">总供应量</div>
                <div className="text-xl font-bold">{coin.totalSupply.toLocaleString()}</div>
              </div>
            </div>

            {/* Price Chart */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">价格走势</h3>
              
              {/* Simple Chart Visualization */}
              <div className="h-64 flex items-end gap-2">
                {mockPriceHistory.map((point, index) => {
                  const maxPrice = Math.max(...mockPriceHistory.map(p => p.price))
                  const height = (point.price / maxPrice) * 100
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-aura-purple to-aura-pink rounded-t-lg transition-all hover:opacity-80 cursor-pointer relative group"
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap">
                          {point.price.toFixed(5)} SOL
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{point.time}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bonding Curve Info */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">联合曲线信息</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">曲线类型</div>
                  <div className="text-lg font-semibold">{coin.curveType}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">创作者费用</div>
                  <div className="text-lg font-semibold">{coin.creatorFeeBps / 100}%</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">储备金池</div>
                  <div className="text-lg font-semibold">{coin.reserveBalance.toFixed(2)} SOL</div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-300">
                  💡 {coin.curveType === 'Linear' && '线性曲线：价格随供应量线性增长'}
                  {coin.curveType === 'Quadratic' && '二次曲线：价格增长速度加快，适合长期投资'}
                  {coin.curveType === 'Cubic' && '三次曲线：价格增长最快，高风险高回报'}
                </p>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">交易历史</h3>
              <div className="space-y-2">
                {mockTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          tx.type === 'buy' ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      ></div>
                      <div>
                        <div className="font-semibold">
                          {tx.type === 'buy' ? '🟢 买入' : '🔴 卖出'}
                        </div>
                        <div className="text-sm text-gray-400">{tx.user}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {tx.amount.toLocaleString()} ${coin.symbol}
                      </div>
                      <div className="text-sm text-gray-400">{tx.total.toFixed(4)} SOL</div>
                    </div>
                    <div className="text-sm text-gray-400">{tx.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Trading Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-6">
              <h3 className="text-xl font-bold mb-4">交易</h3>

              {/* My Holdings */}
              {connected && (
                <div className="mb-4 p-4 bg-gradient-to-r from-aura-purple/20 to-aura-pink/20 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">我的持仓</div>
                  <div className="text-2xl font-bold">{myHoldings.toLocaleString()} ${coin.symbol}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    ≈ {(myHoldings * coin.price).toFixed(4)} SOL
                  </div>
                </div>
              )}

              {/* Buy/Sell Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('buy')}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    activeTab === 'buy'
                      ? 'bg-green-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  买入
                </button>
                <button
                  onClick={() => setActiveTab('sell')}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    activeTab === 'sell'
                      ? 'bg-red-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  卖出
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  数量 (${coin.symbol})
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="输入数量"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                  min="0"
                  step="1"
                />
                {activeTab === 'sell' && myHoldings > 0 && (
                  <button
                    onClick={() => setAmount(myHoldings.toString())}
                    className="mt-2 text-sm text-aura-purple hover:underline"
                  >
                    最大: {myHoldings}
                  </button>
                )}
              </div>

              {/* Estimated Price */}
              {estimatedPrice > 0 && (
                <div className="mb-4 p-4 bg-white/5 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">预估价格</span>
                    <span className="text-lg font-bold">{estimatedPrice.toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">创作者费用 ({coin.creatorFeeBps / 100}%)</span>
                    <span className="text-gray-400">
                      {(estimatedPrice * coin.creatorFeeBps / 10000).toFixed(4)} SOL
                    </span>
                  </div>
                </div>
              )}

              {/* Trade Button */}
              <button
                onClick={handleTrade}
                disabled={!connected || loading || !amount || Number(amount) <= 0}
                className={`w-full py-4 rounded-lg font-bold text-white transition-all ${
                  !connected || loading || !amount || Number(amount) <= 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : activeTab === 'buy'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {!connected
                  ? '请先连接钱包'
                  : loading
                  ? '处理中...'
                  : activeTab === 'buy'
                  ? '确认买入'
                  : '确认卖出'}
              </button>

              {/* Warning */}
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-200">
                  ⚠️ 提示：Creator Coin 价格由联合曲线决定，请理性投资，注意风险。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
