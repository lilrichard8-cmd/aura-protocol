import { FC } from 'react'
import { useNavigate } from 'react-router-dom'

export const Landing: FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Background animated gradients */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-aura-purple/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-aura-pink/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-aura-orange/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main content */}
      <div className="text-center px-4 max-w-4xl mx-auto">
        {/* Logo */}
        <div className="mb-12 animate-fade-in">
          <div className="w-32 h-32 mx-auto mb-6 bg-gradient-aura rounded-3xl flex items-center justify-center shadow-2xl">
            <span className="text-white font-bold text-6xl">A</span>
          </div>
        </div>

        {/* Slogan */}
        <h1 className="text-7xl md:text-9xl font-bold mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <span className="bg-gradient-aura bg-clip-text text-transparent animate-gradient">
            定格你的灵光
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-2xl md:text-3xl text-gray-300 mb-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          去中心化创作者平台
        </p>

        <p className="text-xl md:text-2xl text-gray-400 mb-16 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.6s' }}>
          永久存储 · 真正所有权 · 公平经济
        </p>

        {/* Enter button */}
        <button
          onClick={() => navigate('/explore')}
          className="group relative px-12 py-6 bg-gradient-aura rounded-full text-white text-2xl font-bold hover:scale-110 transition-all duration-300 shadow-2xl animate-fade-in"
          style={{ animationDelay: '0.8s' }}
        >
          <span className="relative z-10">进入 AURA</span>
          <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
        </button>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in" style={{ animationDelay: '1s' }}>
          <div className="text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-2 text-white">永久存储</h3>
            <p className="text-gray-400">基于 Arweave</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-xl font-semibold mb-2 text-white">95% 收益</h3>
            <p className="text-gray-400">创作者优先</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-4">🗳️</div>
            <h3 className="text-xl font-semibold mb-2 text-white">DAO 治理</h3>
            <p className="text-gray-400">社区共治</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
