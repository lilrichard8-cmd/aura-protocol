import { FC } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'

export const Home: FC = () => {
  const { connected } = useWallet()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          {/* Animated gradient title */}
          <h1 className="text-6xl md:text-8xl font-bold mb-6">
            <span className="bg-gradient-aura bg-clip-text text-transparent animate-gradient">
              定格你的灵光
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            去中心化创作者平台 · 永久存储 · 真正所有权
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/create"
              className="px-8 py-4 bg-gradient-aura rounded-lg text-white font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              开始创作
            </Link>
            <Link
              to="/explore"
              className="px-8 py-4 bg-white/10 rounded-lg text-white font-semibold text-lg hover:bg-white/20 transition-colors border border-white/20"
            >
              探索内容
            </Link>
          </div>

          <p className="mt-6 text-gray-400">
            {connected ? '已连接钱包，开始你的创作之旅' : '测试模式：无需连接钱包即可体验所有功能'}
          </p>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-aura-purple/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-aura-pink/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-aura-orange/20 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-black/40">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            为什么选择 <span className="bg-gradient-aura bg-clip-text text-transparent">AURA</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-purple/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-purple to-aura-pink rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">永久存储</h3>
              <p className="text-gray-400">
                基于 Arweave 的去中心化存储，内容永不丢失，无人可删除
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-pink/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-pink to-aura-orange rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">95% 收益</h3>
              <p className="text-gray-400">
                创作者获得 95% 收益，平台仅收取 5% 手续费
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-orange/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-orange to-aura-purple rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">🗳️</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">DAO 治理</h3>
              <p className="text-gray-400">
                5 个专业委员会管理，社区共同决策平台未来
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-purple/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-purple to-aura-orange rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">高性能</h3>
              <p className="text-gray-400">
                基于 Solana 区块链，TPS 3000+，交易费用低廉
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-pink/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-pink to-aura-purple rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">🎨</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">NFT 市场</h3>
              <p className="text-gray-400">
                一键铸造 NFT，支持一口价、拍卖等多种交易方式
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-orange/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-orange to-aura-pink rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">🛡️</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">版权保护</h3>
              <p className="text-gray-400">
                7 天收益锁定期，仲裁委员会可追回被盗内容收益
              </p>
            </div>

            {/* Feature 7 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-purple/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-purple to-aura-pink rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">📺</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">广告分成</h3>
              <p className="text-gray-400">
                50% 广告费直接给观众，革命性的注意力经济模型
              </p>
            </div>

            {/* Feature 8 */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-aura-pink/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-aura-pink to-aura-orange rounded-lg mb-4 flex items-center justify-center">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">二创许可</h3>
              <p className="text-gray-400">
                自动分账系统，原创和二创者共同受益
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Token Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            <span className="bg-gradient-aura bg-clip-text text-transparent">$ORA</span> 代币经济
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
              <div className="text-5xl font-bold mb-4 bg-gradient-aura bg-clip-text text-transparent">
                20亿
              </div>
              <div className="text-gray-300 mb-2">总供应量</div>
              <div className="text-sm text-gray-500">软顶设计</div>
            </div>

            <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
              <div className="text-5xl font-bold mb-4 bg-gradient-aura bg-clip-text text-transparent">
                对数递减
              </div>
              <div className="text-gray-300 mb-2">分发模式</div>
              <div className="text-sm text-gray-500">早期创作者获益更多</div>
            </div>

            <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
              <div className="text-5xl font-bold mb-4 bg-gradient-aura bg-clip-text text-transparent">
                多重销毁
              </div>
              <div className="text-gray-300 mb-2">通缩机制</div>
              <div className="text-sm text-gray-500">NFT 铸造 100%，交易费 2.5%，广告费 50%</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            准备好开始创作了吗？
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            加入 AURA，与全球创作者一起构建真正去中心化的内容平台
          </p>
          <Link
            to="/create"
            className="inline-block px-8 py-4 bg-gradient-aura rounded-lg text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            立即开始
          </Link>
        </div>
      </section>
    </div>
  )
}
