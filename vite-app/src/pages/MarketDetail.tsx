import { FC, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'

const mockRecommended = [
  { id: '201', title: '类似商品1', type: 'nft', thumbnail: '🎨', price: 95 },
  { id: '202', title: '类似商品2', type: 'nft', thumbnail: '🖼️', price: 110 },
  { id: '203', title: '类似商品3', type: 'nft', thumbnail: '📷', price: 80 },
  { id: '204', title: '类似商品4', type: 'nft', thumbnail: '🎭', price: 120 },
]

export const MarketDetail: FC = () => {
  const { type, id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const item = location.state?.item

  const [bidAmount, setBidAmount] = useState('')
  const [showFractionalizeModal, setShowFractionalizeModal] = useState(false)
  const [totalFragments, setTotalFragments] = useState('1000')
  const [pricePerFragment, setPricePerFragment] = useState('10')
  const [fragmentsToBuy, setFragmentsToBuy] = useState('10')
  
  // Mock fractionalization data
  const [isFractionalized, setIsFractionalized] = useState(false)
  const mockFractionalData = {
    totalFragments: 1000,
    fragmentsSold: 650,
    pricePerFragment: 10,
    totalRevenue: 6500,
    holders: 45,
  }

  if (!item) {
    return (
      <div className="min-h-screen pt-20 pb-32 px-4 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold mb-2">内容未找到</h2>
          <button
            onClick={() => navigate('/market')}
            className="mt-4 px-6 py-2 bg-gradient-aura rounded-lg text-white font-semibold"
          >
            返回市场
          </button>
        </div>
      </div>
    )
  }

  // NFT Detail
  if (type === 'nft') {
    return (
      <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>返回</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* NFT Image */}
            <div className="bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 rounded-2xl aspect-square flex items-center justify-center text-9xl">
              {item.thumbnail}
            </div>

            {/* NFT Info */}
            <div>
              <h1 className="text-3xl font-bold mb-4">{item.title}</h1>
              
              {/* Author */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-aura rounded-full flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <div className="text-sm text-gray-400">创作者</div>
                  <div className="font-semibold">@{item.author}</div>
                </div>
              </div>

              {/* Fractionalization Status */}
              {isFractionalized && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🔹</span>
                    <span className="font-semibold">已碎片化</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-xs text-gray-400">总碎片</div>
                      <div className="text-lg font-bold">{mockFractionalData.totalFragments}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-xs text-gray-400">已售出</div>
                      <div className="text-lg font-bold text-green-500">{mockFractionalData.fragmentsSold}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-xs text-gray-400">碎片价格</div>
                      <div className="text-lg font-bold text-purple-500">{mockFractionalData.pricePerFragment} $ORA</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-xs text-gray-400">持有人</div>
                      <div className="text-lg font-bold text-blue-500">{mockFractionalData.holders}</div>
                    </div>
                  </div>
                  <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-aura"
                      style={{ width: `${(mockFractionalData.fragmentsSold / mockFractionalData.totalFragments) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    {((mockFractionalData.fragmentsSold / mockFractionalData.totalFragments) * 100).toFixed(1)}% 已售
                  </div>
                </div>
              )}

              {/* Price card */}
              {!isFractionalized ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                  <div className="text-sm text-gray-400 mb-2">
                    {item.type === 'auction' ? '当前出价' : '售价'}
                  </div>
                  <div className="text-4xl font-bold text-aura-purple mb-4">
                    {item.price} $ORA
                  </div>

                  {item.type === 'auction' && (
                    <>
                      <div className="flex justify-between text-sm mb-4">
                        <span className="text-gray-400">出价次数</span>
                        <span className="font-semibold">{item.bids}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-4">
                        <span className="text-gray-400">结束时间</span>
                        <span className="font-semibold text-red-500">{item.endTime}</span>
                      </div>

                      {/* Bid input */}
                      <div className="mb-4">
                        <input
                          type="number"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder="输入出价..."
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-aura-purple"
                          min={item.price + 1}
                        />
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (item.type === 'auction') {
                        alert(`出价 ${bidAmount} $ORA\n\n当前最高价：${item.price} $ORA\n你的出价：${bidAmount} $ORA\n\n（测试模式）`)
                      } else {
                        alert(`购买 NFT\n\n价格：${item.price} $ORA\n\n（测试模式）`)
                      }
                    }}
                    className="w-full py-3 bg-gradient-aura rounded-lg text-white font-bold hover:opacity-90"
                  >
                    {item.type === 'auction' ? '出价' : '立即购买'}
                  </button>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                  <div className="text-sm text-gray-400 mb-2">购买碎片</div>
                  <div className="text-2xl font-bold text-purple-500 mb-4">
                    {mockFractionalData.pricePerFragment} $ORA / 碎片
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">购买数量</label>
                    <input
                      type="number"
                      value={fragmentsToBuy}
                      onChange={(e) => setFragmentsToBuy(e.target.value)}
                      placeholder="输入碎片数量..."
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-aura-purple"
                      min="1"
                      max={mockFractionalData.totalFragments - mockFractionalData.fragmentsSold}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>可购买: {mockFractionalData.totalFragments - mockFractionalData.fragmentsSold} 碎片</span>
                      <span>总计: {Number(fragmentsToBuy) * mockFractionalData.pricePerFragment} $ORA</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      alert(`购买 NFT 碎片\n\n数量：${fragmentsToBuy} 碎片\n单价：${mockFractionalData.pricePerFragment} $ORA\n总价：${Number(fragmentsToBuy) * mockFractionalData.pricePerFragment} $ORA\n\n你将拥有 ${((Number(fragmentsToBuy) / mockFractionalData.totalFragments) * 100).toFixed(2)}% 的 NFT 权益\n\n（测试模式）`)
                    }}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-bold hover:opacity-90"
                  >
                    购买碎片
                  </button>
                </div>
              )}

              {/* Fractionalize Button (for owner) */}
              {!isFractionalized && (
                <button
                  onClick={() => setShowFractionalizeModal(true)}
                  className="w-full mb-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:border-purple-500/50 transition-all"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>🔹</span>
                    <span>碎片化此 NFT</span>
                  </div>
                </button>
              )}

              {/* Additional info */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">合约地址</span>
                  <span className="font-mono text-xs">CoreP...1111</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Token ID</span>
                  <span className="font-mono text-xs">#{id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">区块链</span>
                  <span>Solana</span>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Distribution (if fractionalized) */}
          {isFractionalized && (
            <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">💰 收益分配</h3>
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">总收益池</span>
                    <span className="text-2xl font-bold text-green-500">{mockFractionalData.totalRevenue} $ORA</span>
                  </div>
                  <div className="text-xs text-gray-400">来自碎片销售和二次交易</div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">原创者</div>
                    <div className="text-lg font-bold text-purple-500">30%</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">碎片持有者</div>
                    <div className="text-lg font-bold text-blue-500">65%</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">平台</div>
                    <div className="text-lg font-bold text-gray-500">5%</div>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-gray-300">
                  💡 持有碎片即可按比例自动获得收益分成
                </div>

                <button
                  onClick={() => alert('认领收益\n\n根据你持有的碎片比例，你可以认领相应的收益\n\n（测试模式）')}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-white font-bold hover:opacity-90"
                >
                  认领我的收益
                </button>
              </div>
            </div>
          )}

          {/* Recommended Items */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">💡 相关推荐</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mockRecommended.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => navigate(`/market/${rec.type}/${rec.id}`)}
                  className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-aura-purple/50 transition-all cursor-pointer hover:scale-105"
                >
                  <div className="aspect-square bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 flex items-center justify-center text-5xl">
                    {rec.thumbnail}
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-sm mb-2 line-clamp-1">{rec.title}</h4>
                    <div className="text-lg font-bold text-aura-purple">{rec.price} $ORA</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fractionalize Modal */}
          {showFractionalizeModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">🔹 碎片化 NFT</h3>
                  <button
                    onClick={() => setShowFractionalizeModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">碎片总数</label>
                    <input
                      type="number"
                      value={totalFragments}
                      onChange={(e) => setTotalFragments(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="输入碎片总数..."
                      min="100"
                      max="1000000"
                    />
                    <p className="text-xs text-gray-500 mt-1">建议 100-10000 碎片</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">每碎片价格 ($ORA)</label>
                    <input
                      type="number"
                      value={pricePerFragment}
                      onChange={(e) => setPricePerFragment(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="输入碎片价格..."
                      min="0.01"
                      step="0.01"
                    />
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">💡 碎片化说明</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• NFT 将被托管在智能合约中</li>
                      <li>• 碎片持有者按比例分享收益</li>
                      <li>• 可通过投票决定商业授权</li>
                      <li>• 赎回全部碎片可取回 NFT</li>
                    </ul>
                  </div>

                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-400">总估值</span>
                      <span className="text-2xl font-bold text-purple-500">
                        {Number(totalFragments) * Number(pricePerFragment)} $ORA
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>碎片数量</span>
                      <span>{totalFragments} 个</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>单价</span>
                      <span>{pricePerFragment} $ORA</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    alert(`碎片化 NFT\n\n碎片总数：${totalFragments}\n每碎片价格：${pricePerFragment} $ORA\n总估值：${Number(totalFragments) * Number(pricePerFragment)} $ORA\n\n你的 NFT 将被锁定在智能合约中，投资者可以购买碎片来共同拥有这个 NFT。\n\n（测试模式）`)
                    setShowFractionalizeModal(false)
                    setIsFractionalized(true)
                  }}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-bold hover:opacity-90"
                >
                  确认碎片化
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Mystery Box Detail
  if (type === 'mysterybox') {
    return (
      <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>返回</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box visual */}
            <div className={`bg-gradient-to-br ${item.color} rounded-2xl aspect-square flex items-center justify-center relative overflow-hidden`}>
              <div className="text-9xl animate-pulse">{item.thumbnail}</div>
              <div className="absolute inset-0 bg-white/10 blur-3xl animate-pulse"></div>
            </div>

            {/* Box info */}
            <div>
              <h1 className="text-3xl font-bold mb-2">{item.title || item.name}</h1>
              <p className="text-gray-400 mb-6">by @{item.creator}</p>

              {/* Progress */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">已售出</span>
                  <span className="font-semibold">{item.sold} / {item.total}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-aura"
                    style={{ width: `${(item.sold / item.total) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Rarity breakdown */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <h3 className="font-semibold mb-3">稀有度分布</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg">
                    <span className="text-yellow-500 font-semibold">🌟 传说</span>
                    <span className="text-yellow-500">1%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded-lg">
                    <span className="text-purple-500 font-semibold">💜 史诗</span>
                    <span className="text-purple-500">5%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg">
                    <span className="text-blue-500 font-semibold">💙 稀有</span>
                    <span className="text-blue-500">15%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-500/10 rounded-lg">
                    <span className="text-gray-400 font-semibold">⚪ 普通</span>
                    <span className="text-gray-400">79%</span>
                  </div>
                </div>
              </div>

              {/* Purchase */}
              <div className="bg-gradient-aura/20 border border-aura-purple/30 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">价格</div>
                <div className="text-4xl font-bold mb-6">{item.price} $ORA</div>
                
                <button
                  onClick={() => {
                    alert(`🎁 开启盲盒：${item.title}\n\n价格：${item.price} $ORA\n\n正在开启...\n\n🎉 恭喜！你获得了一个稀有 NFT！\n\n（测试模式）`)
                  }}
                  className="w-full py-4 bg-gradient-aura rounded-lg text-white font-bold text-lg hover:opacity-90"
                >
                  🎁 开启盲盒
                </button>
              </div>
            </div>
          </div>

          {/* Recent openings */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4">最近开出</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎨</span>
                    <div>
                      <div className="font-semibold text-sm">艺术作品 #{i}</div>
                      <div className="text-xs text-gray-400">@User{i}.sol</div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    i === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                    i === 2 ? 'bg-purple-500/20 text-purple-500' :
                    'bg-blue-500/20 text-blue-500'
                  }`}>
                    {i === 1 ? '传说' : i === 2 ? '史诗' : '稀有'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Mystery Boxes */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">💡 其他盲盒</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {mockRecommended.slice(0, 3).map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => navigate(`/market/mysterybox/${rec.id}`)}
                  className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-yellow-500/50 transition-all cursor-pointer hover:scale-105"
                >
                  <div className="aspect-square bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center text-6xl">
                    🎁
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-sm mb-2 line-clamp-1">{rec.title}</h4>
                    <div className="text-lg font-bold text-yellow-500">{rec.price} $ORA</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Bounty Detail
  if (type === 'bounty') {
    return (
      <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>返回</span>
          </button>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold mb-4">{item.title}</h1>
                <div className="flex items-center gap-2 text-gray-400">
                  <span>👤 @{item.creator}</span>
                  <span>•</span>
                  <span>⏰ {item.deadline}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">赏金</div>
                <div className="text-4xl font-bold text-aura-orange">{item.reward} $ORA</div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-green-500 font-semibold">✅ 进行中</span>
                <span className="text-sm text-gray-400">{item.submissions} 个提交</span>
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">任务要求</h3>
              <div className="bg-white/5 rounded-xl p-4 text-gray-300 text-sm">
                <p>这是一个示例悬赏任务。实际任务会包含详细的需求说明、交付标准和评选规则。</p>
              </div>
            </div>

            {/* Submit button */}
            <button
              onClick={() => {
                alert(`提交作品\n\n悬赏：${item.title}\n赏金：${item.reward} $ORA\n\n请上传：\n• 作品文件或链接\n• 项目说明\n• 联系方式\n\n（测试模式）`)
              }}
              className="w-full py-4 bg-gradient-aura rounded-xl text-white font-bold text-lg hover:opacity-90"
            >
              提交我的作品
            </button>
          </div>

          {/* Submissions */}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">已提交作品 ({item.submissions})</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-aura rounded-full flex items-center justify-center">
                        {i === 1 ? '🎨' : i === 2 ? '🎬' : '📝'}
                      </div>
                      <div>
                        <div className="font-semibold">提交 #{i}</div>
                        <div className="text-xs text-gray-400">@Submitter{i}.sol</div>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20">
                      查看
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Bounties */}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">💡 其他悬赏</h3>
            <div className="space-y-3">
              {mockRecommended.slice(0, 3).map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => navigate(`/market/bounty/${rec.id}`)}
                  className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{rec.thumbnail}</span>
                      <div>
                        <div className="font-semibold">{rec.title}</div>
                        <div className="text-xs text-gray-400">{rec.type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">赏金</div>
                      <div className="text-xl font-bold text-green-400">{rec.price * 50} $ORA</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
