import { FC } from 'react'
import { useNavigate } from 'react-router-dom'

export const LandingV2: FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - Patreon style */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="text-2xl font-bold text-gray-900">AURA</div>
            <div className="hidden md:flex gap-6">
              <a href="#" className="text-gray-600 hover:text-gray-900 font-medium">探索</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 font-medium">创作者</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 font-medium">关于</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-6 py-2 text-gray-700 font-semibold hover:bg-gray-50 rounded-full transition-colors">
              登录
            </button>
            <button 
              onClick={() => navigate('/v2/explore')}
              className="px-6 py-2 bg-[#FF424D] text-white font-semibold rounded-full hover:bg-[#E5222E] transition-colors"
            >
              开始创作
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Patreon style */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6">
            真正拥有
            <br />
            你的创作
          </h1>
          <p className="text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
            去中心化创作者平台。永久存储，95%收益，完全透明。
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => navigate('/v2/explore')}
              className="px-8 py-4 bg-[#FF424D] text-white text-lg font-semibold rounded-full hover:bg-[#E5222E] transition-all hover:scale-105"
            >
              开始探索
            </button>
            <button className="px-8 py-4 bg-white text-gray-900 text-lg font-semibold rounded-full border-2 border-gray-200 hover:border-gray-300 transition-all">
              了解更多
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">95%</div>
              <div className="text-gray-600">创作者收益</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">永久</div>
              <div className="text-gray-600">内容存储</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">0</div>
              <div className="text-gray-600">审查风险</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Patreon style cards */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">
            为创作者设计的平台
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">永久所有权</h3>
              <p className="text-gray-600 leading-relaxed">
                内容存储在Arweave，永不丢失，真正属于你。
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">95% 收益</h3>
              <p className="text-gray-600 leading-relaxed">
                行业最高分成比例，创作者优先。
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">🗳️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">DAO 治理</h3>
              <p className="text-gray-600 leading-relaxed">
                社区共同决定平台未来方向。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#FF424D]">
        <div className="max-w-4xl mx-auto px-6 text-center text-white">
          <h2 className="text-5xl font-bold mb-6">准备好开始了吗？</h2>
          <p className="text-xl mb-10 opacity-90">
            加入AURA，与全球创作者一起构建真正去中心化的内容平台
          </p>
          <button 
            onClick={() => navigate('/v2/explore')}
            className="px-10 py-5 bg-white text-[#FF424D] text-xl font-bold rounded-full hover:scale-105 transition-transform"
          >
            立即开始
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-xl font-bold mb-4">AURA</div>
              <p className="text-gray-400 text-sm">
                去中心化创作者平台
              </p>
            </div>
            <div>
              <div className="font-semibold mb-4">产品</div>
              <div className="space-y-2 text-sm text-gray-400">
                <div>探索</div>
                <div>创作</div>
                <div>市场</div>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-4">资源</div>
              <div className="space-y-2 text-sm text-gray-400">
                <div>文档</div>
                <div>白皮书</div>
                <div>API</div>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-4">社区</div>
              <div className="space-y-2 text-sm text-gray-400">
                <div>Discord</div>
                <div>Twitter</div>
                <div>GitHub</div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            © 2026 AURA Platform. Built with ❤️ for creators.
          </div>
        </div>
      </footer>
    </div>
  )
}
