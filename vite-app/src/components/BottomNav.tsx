import { FC } from 'react'
import { Link, useLocation } from 'react-router-dom'

export const BottomNav: FC = () => {
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
          <div className="flex items-center justify-around py-3 px-2">
            {/* Explore */}
            <Link
              to="/explore"
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${
                isActive('/explore') ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className="text-2xl">{isActive('/explore') ? '🔍' : '🔎'}</span>
              <span className={`text-xs ${isActive('/explore') ? 'text-white font-semibold' : 'text-gray-400'}`}>
                探索
              </span>
            </Link>

            {/* Market */}
            <Link
              to="/market"
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${
                isActive('/market') ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className="text-2xl">{isActive('/market') ? '🏪' : '🏬'}</span>
              <span className={`text-xs ${isActive('/market') ? 'text-white font-semibold' : 'text-gray-400'}`}>
                市场
              </span>
            </Link>

            {/* Create - Center button with animation */}
            <Link
              to="/create"
              className="relative -mt-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-aura rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative w-16 h-16 bg-gradient-aura rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                  <span className="text-3xl text-white font-bold">+</span>
                </div>
              </div>
            </Link>

            {/* Governance */}
            <Link
              to="/governance"
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${
                isActive('/governance') ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className="text-2xl">{isActive('/governance') ? '🗳️' : '📊'}</span>
              <span className={`text-xs ${isActive('/governance') ? 'text-white font-semibold' : 'text-gray-400'}`}>
                治理
              </span>
            </Link>

            {/* Profile */}
            <Link
              to="/profile"
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${
                isActive('/profile') ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className="text-2xl">{isActive('/profile') ? '👤' : '👥'}</span>
              <span className={`text-xs ${isActive('/profile') ? 'text-white font-semibold' : 'text-gray-400'}`}>
                我的
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
